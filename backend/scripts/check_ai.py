"""Run: .venv/Scripts/python.exe -m backend.scripts.check_ai

Checks Gemini/OpenRouter streaming and structured generation with synthetic content.
Never prints credentials, provider response bodies, or private study materials.
"""
import asyncio
import argparse
import json
from fastapi import HTTPException
from backend.app import config, llm, schemas  # config loads the server's .env


async def check(provider=None, full=False):
    selected = provider or llm.primary()
    if not llm.configured(selected):
        print(json.dumps({'provider': selected, 'status': 'unconfigured', 'remediation': f'Set {llm.PROVIDERS[selected]} in the server environment or backend/.env, then rerun this command.'}))
        return 2
    options = {'provider': selected}
    checked = []
    try:
        answer = ''.join([piece async for piece in llm.stream_chat(
            'Answer using only source S1. Include the exact citation [S1] in the answer.', [],
            '[S1] Photosynthesis converts light energy into chemical energy stored in glucose. What energy change occurs?', **options)])
        if not answer.strip() or '[S1]' not in answer:
            raise ValueError('Empty or uncited stream')
        checked.append('streaming')
        for kind in (['summary', 'reviewer', 'flashcards', 'quiz', 'test'] if full else ['summary']):
            await llm.generate(schemas.GenerateRequest(kind=kind, document_ids=[1], n=3),
                               '[S1] Photosynthesis converts light energy into chemical energy stored in glucose. Plants use sunlight, water and carbon dioxide to produce glucose and oxygen. Chlorophyll absorbs light.', {'S1'}, **options)
            checked.append(kind)
    except Exception as error:
        code = getattr(error, 'code', None) or getattr(error, 'status_code', None)
        status, remediation = {
            401: ('authentication_error', 'Replace GEMINI_API_KEY with a valid Gemini key.'),
            403: ('authentication_error', 'Check key restrictions, Gemini API access, and project permissions in Google AI Studio.'),
            404: ('model_error', 'Set GEMINI_MODEL to a model available to this project.'),
            429: ('quota_error', 'Check project quota and billing in Google AI Studio before retrying.'),
        }.get(code, ('failed', 'Check network access and model configuration. No credentials or provider details were logged.'))
        if selected == 'openrouter':
            remediation = {401: 'Check OPENROUTER_API_KEY in OpenRouter settings.', 403: 'Check OpenRouter key permissions and provider data-policy settings.', 402: 'Check OpenRouter credit availability and key spending limits.', 404: 'Set OPENROUTER_MODEL to an available model with structured outputs.', 429: 'Check OpenRouter rate limits and wait before retrying.'}.get(code, 'Check OpenRouter model availability, structured-output support, and network access.')
            if code == 402: status = 'credit_error'
        print(json.dumps({'provider': selected, 'status': status, 'completed_checks': checked, 'remediation': remediation}))
        return 1
    print(json.dumps({'provider': selected, 'status': 'valid', 'checks': ['streaming', 'structured_generation', 'source_reference_validation'], 'study_tools': checked[1:]}))
    return 0


async def main():
    parser = argparse.ArgumentParser(description='Verify AI with synthetic content; never print keys.')
    parser.add_argument('--provider', choices=['gemini', 'openrouter', 'all'])
    parser.add_argument('--full', action='store_true', help='Verify every study generator, including a 20-question practice test.')
    args = parser.parse_args()
    if args.provider == 'all':
        results = [await check(provider, args.full) for provider in llm.PROVIDERS]
        return max(results)
    try:
        return await check(args.provider, args.full)
    except HTTPException:
        print(json.dumps({'status': 'configuration_error', 'remediation': 'Check AI_PROVIDER and the selected model setting.'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
