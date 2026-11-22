import asyncio
import json
import os
import re
from pydantic import ValidationError
from fastapi import HTTPException
from google import genai
from google.genai import types
from . import prompts, schemas, openrouter


def client():
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if not key:
        raise HTTPException(503, 'Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the server.')
    return genai.Client(api_key=key, http_options=types.HttpOptions(timeout=60000))


PROVIDERS = {'gemini': 'GEMINI_API_KEY', 'openrouter': 'OPENROUTER_API_KEY'}


def primary():
    value = os.getenv('AI_PROVIDER', 'gemini').strip().lower()
    if value not in PROVIDERS: raise HTTPException(503, 'Set AI_PROVIDER to gemini or openrouter.')
    return value


def configured(provider):
    return provider in PROVIDERS and bool(os.getenv(PROVIDERS[provider], '').strip())


def provider_chain(provider=None):
    first = provider or primary()
    if first not in PROVIDERS: raise HTTPException(503, 'Select gemini or openrouter.')
    fallback = 'none' if provider else os.getenv('AI_FALLBACK_PROVIDER', 'auto').strip().lower()
    if fallback == 'auto': fallback = 'openrouter' if first == 'gemini' else 'gemini'
    if fallback not in (*PROVIDERS, 'none', ''): raise HTTPException(503, 'Set AI_FALLBACK_PROVIDER to auto, none, gemini, or openrouter.')
    return list(dict.fromkeys(p for p in [first, fallback] if configured(p)))


def model(provider=None):
    selected = provider or next(iter(provider_chain()), primary())
    value = os.getenv('OPENROUTER_MODEL', 'openrouter/free') if selected == 'openrouter' else os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite')
    value = value.strip()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}', value) or value.startswith(('sk-', 'AIza')) or (selected == 'openrouter' and '/' not in value):
        raise HTTPException(503, 'Set a valid model ID in the selected provider model setting.')
    return value


def health():
    try:
        chain = provider_chain()
        details = []
        for selected in PROVIDERS:
            entry = {'id': selected, 'configured': configured(selected)}
            try: entry['model'] = model(selected)
            except HTTPException as error:
                entry.update(model=None, configuration_error=error.detail)
            details.append(entry)
        active = chain[0] if chain else primary()
        active_info = next(entry for entry in details if entry['id'] == active)
        backup = chain[1] if len(chain) > 1 else None
        if backup and not next(entry['model'] for entry in details if entry['id'] == backup): backup = None
        result = {'ai_configured': bool(chain) and active_info['model'] is not None, 'provider': active,
                  'model': active_info['model'], 'providers': details, 'fallback_provider': backup}
        if active_info.get('configuration_error'): result['configuration_error'] = active_info['configuration_error']
        return result
    except HTTPException as error:
        return {'ai_configured': False, 'provider': None, 'model': None, 'providers': [], 'configuration_error': error.detail}


def ensure_configured():
    if not provider_chain(): raise HTTPException(503, 'AI is not configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY in the server environment and restart.')


def retryable(error):
    if isinstance(error, HTTPException):
        return error.status_code == 502  # Invalid generated content, not bad local settings.
    code = getattr(error, 'code', None) or getattr(error, 'status_code', None)
    return isinstance(error, TimeoutError) or code in (408, 429) or isinstance(code, int) and 500 <= code <= 599



def friendly_error(exc: Exception) -> str:
    if isinstance(exc, HTTPException): return str(exc.detail)
    provider = getattr(exc, 'provider', 'gemini')
    name = 'OpenRouter' if provider == 'openrouter' else 'Gemini'
    code = getattr(exc, 'code', None)
    if code in (401, 403): return f'{name} authentication failed. Contact the person managing ASKLearn to check the key and API permissions.'
    if code == 402: return 'OpenRouter credits are insufficient. Contact the person managing ASKLearn.'
    if code == 404: return f'{name} model is unavailable. Contact the person managing ASKLearn to check the model setting.'
    if code == 429: return f'{name} quota reached. Wait for your quota to reset and try again.'
    return 'The AI service could not complete this request. Please try again shortly.'


async def stream_chat(system: str, history: list[dict], question: str, *, provider=None):
    chain = provider_chain(provider)
    if not chain: ensure_configured(); raise HTTPException(503, 'The selected AI provider is not configured.')
    for index, selected in enumerate(chain):
        emitted = False
        try:
            async with asyncio.timeout(90):
                source = openrouter.stream(model(selected), system, history, question) if selected == 'openrouter' else _stream_gemini(system, history, question)
                try:
                    async for token in source:
                        if token:
                            emitted = True
                            yield token
                finally:
                    await source.aclose()
                if not emitted: raise openrouter.ProviderError(selected, 502)
            return
        except Exception as error:
            if emitted or index == len(chain) - 1 or not retryable(error): raise


async def _stream_gemini(system: str, history: list[dict], question: str):
    contents = [types.Content(role='model' if m['role'] == 'assistant' else 'user',
                              parts=[types.Part(text=m['content'])]) for m in history]
    contents.append(types.Content(role='user', parts=[types.Part(text=question)]))
    async with client().aio as ai:
        async with asyncio.timeout(90):
            stream = await ai.models.generate_content_stream(
                model=model('gemini'), contents=contents,
                config=types.GenerateContentConfig(system_instruction=system, max_output_tokens=4096))
            async for chunk in stream:
                if chunk.text:
                    yield chunk.text


async def generate(req: schemas.GenerateRequest, material: str, source_ids: set[str], *, provider=None):
    chain = provider_chain(provider)
    if not chain: ensure_configured(); raise HTTPException(503, 'The selected AI provider is not configured.')
    for index, selected in enumerate(chain):
        try: return await _generate(req, material, source_ids, selected)
        except Exception as error:
            if index == len(chain) - 1 or not retryable(error): raise


async def _generate(req: schemas.GenerateRequest, material: str, source_ids: set[str], provider):
    schema = {'summary': schemas.Summary, 'reviewer': schemas.Reviewer,
              'flashcards': schemas.Flashcards, 'quiz': schemas.Quiz, 'test': schemas.Quiz}[req.kind]
    count = max(20, req.n) if req.kind == 'test' else req.n
    instruction = (f'Create a {req.style} {req.kind}. For cards or questions create exactly {count}. '
                   f'Difficulty: {req.difficulty}. Allowed question types: {", ".join(req.types)}. '
                   + ('Include all three question types. ' if req.kind == 'test' else '') + '\nSOURCES:\n' + material)
    for attempt in range(2):
        async with asyncio.timeout(90):
            if provider == 'openrouter':
                text = await openrouter.generate(model(provider), prompts.GEN_SYSTEM, instruction, schema)
            else:
                async with client().aio as ai:
                    response = await ai.models.generate_content(
                        model=model('gemini'), contents=instruction,
                        config=types.GenerateContentConfig(system_instruction=prompts.GEN_SYSTEM,
                            response_mime_type='application/json', response_json_schema=schema.model_json_schema(),
                            max_output_tokens=16000))
                    text = response.text
        try:
            raw = json.loads(text or '')
            if req.kind in ('quiz', 'test'):
                good = []
                for question in raw.get('questions', []):
                    try:
                        good.append(schemas.Question.model_validate(question).model_dump())
                    except ValidationError:
                        pass
                raw['questions'] = good
            data = schema.model_validate(raw).model_dump()
            items = data.get('cards', data.get('questions'))
            if items is not None and len(items) != count:
                raise ValueError('Not enough valid items.')
            if req.kind in ('quiz', 'test'):
                found = {q['type'] for q in items}
                if not found.issubset(set(req.types)) or (req.kind == 'test' and len(found) != 3):
                    raise ValueError('Question types do not match.')
            def verify(value):
                if isinstance(value, dict):
                    if 'source_ids' in value and not set(value['source_ids']).issubset(source_ids):
                        raise ValueError('Invalid source references.')
                    for child in value.values():
                        verify(child)
                elif isinstance(value, list):
                    for child in value:
                        verify(child)
            verify(data)
            return data
        except (ValidationError, ValueError, TypeError, AttributeError):
            if attempt:
                raise HTTPException(502, 'The AI returned incomplete or invalid study material. Please generate again.')
            instruction += '\nYour previous output failed validation. Supply the exact requested count, valid answers and source IDs.'
