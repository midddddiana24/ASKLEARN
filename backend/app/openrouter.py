"""OpenRouter transport. Credentials only travel to the fixed HTTPS endpoint."""
import json
import os
import httpx

URL = 'https://openrouter.ai/api/v1/chat/completions'


class ProviderError(Exception):
    def __init__(self, provider, code=503):
        self.provider, self.code = provider, code
        super().__init__(f'{provider} request could not be completed.')


def http_client():
    return httpx.AsyncClient(timeout=httpx.Timeout(90, connect=15), follow_redirects=False, trust_env=False)


def headers():
    return {'Authorization': 'Bearer ' + os.getenv('OPENROUTER_API_KEY', '').strip(), 'Content-Type': 'application/json'}


def check_error(data):
    if isinstance(data, dict) and data.get('error'):
        error = data['error']
        code = error.get('code', 502) if isinstance(error, dict) else 502
        try: code = int(code)
        except (TypeError, ValueError): code = 502
        raise ProviderError('openrouter', code if 400 <= code <= 599 else 502)


async def stream(model, system, history, question):
    payload = {'model': model, 'messages': [{'role': 'system', 'content': system}, *history, {'role': 'user', 'content': question}], 'stream': True, 'max_tokens': 4096}
    try:
        async with http_client() as client:
            async with client.stream('POST', URL, headers=headers(), json=payload) as response:
                if response.status_code != 200: raise ProviderError('openrouter', response.status_code)
                lines, finished = [], False
                async def frames():
                    async for line in response.aiter_lines():
                        if line.startswith(':'): continue
                        if line.startswith('data:'):
                            lines.append(line[5:].lstrip())
                            if sum(map(len, lines)) > 2_000_000: raise ProviderError('openrouter', 502)
                        elif not line and lines:
                            yield '\n'.join(lines); lines.clear()
                    if lines: yield '\n'.join(lines)
                async for frame in frames():
                    if frame.strip() == '[DONE]': return
                    try: data = json.loads(frame)
                    except (ValueError, TypeError): raise ProviderError('openrouter', 502) from None
                    check_error(data)
                    if not isinstance(data, dict): raise ProviderError('openrouter', 502)
                    choices = data.get('choices', [])
                    if not isinstance(choices, list): raise ProviderError('openrouter', 502)
                    for choice in choices:
                        if not isinstance(choice, dict): raise ProviderError('openrouter', 502)
                        if choice.get('finish_reason') in ('length', 'content_filter', 'error'):
                            raise ProviderError('openrouter', 502)
                        finished = finished or choice.get('finish_reason') == 'stop'
                        delta = choice.get('delta') or {}
                        if not isinstance(delta, dict): raise ProviderError('openrouter', 502)
                        text = delta.get('content')
                        if isinstance(text, str) and text: yield text
                if not finished: raise ProviderError('openrouter', 502)
    except httpx.HTTPError:
        raise ProviderError('openrouter', 503) from None


async def generate(model, system, instruction, schema):
    # Closed objects and required nullable fields are accepted by strict-schema providers.
    def strict(value):
        if isinstance(value, dict):
            value = {key: strict(item) for key, item in value.items() if key != 'default'}
            if value.get('type') == 'object':
                value['additionalProperties'] = False
                value['required'] = list(value.get('properties', {}))
            return value
        if isinstance(value, list): return [strict(item) for item in value]
        return value
    payload = {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': instruction}],
               'stream': False, 'max_tokens': 16000, 'provider': {'require_parameters': True},
               'response_format': {'type': 'json_schema', 'json_schema': {'name': schema.__name__, 'strict': True, 'schema': strict(schema.model_json_schema())}}}
    try:
        async with http_client() as client:
            async with client.stream('POST', URL, headers=headers(), json=payload) as response:
                if response.status_code != 200: raise ProviderError('openrouter', response.status_code)
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw.extend(chunk)
                    if len(raw) > 4_000_000: raise ProviderError('openrouter', 502)
                try: data = json.loads(raw)
                except (ValueError, TypeError): raise ProviderError('openrouter', 502) from None
                check_error(data)
                try:
                    choice = data['choices'][0]
                    if choice.get('finish_reason') != 'stop': raise ProviderError('openrouter', 502)
                    text = choice['message']['content']
                    if not isinstance(text, str): raise ProviderError('openrouter', 502)
                    return text
                except (KeyError, IndexError, TypeError): raise ProviderError('openrouter', 502) from None
    except httpx.HTTPError:
        raise ProviderError('openrouter', 503) from None
