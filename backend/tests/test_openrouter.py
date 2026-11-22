import asyncio
import json
import httpx
import pytest
from fastapi import HTTPException
from backend.app import llm, openrouter, schemas
from .conftest import content, upload


@pytest.fixture
def router(monkeypatch):
    monkeypatch.setenv('OPENROUTER_API_KEY', 'router-test-secret')
    monkeypatch.setenv('AI_PROVIDER', 'openrouter')
    monkeypatch.setenv('OPENROUTER_MODEL', 'openrouter/free')
    def install(handler):
        monkeypatch.setattr(openrouter, 'http_client', lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    return install


@pytest.mark.parametrize('kind', ['summary', 'reviewer', 'flashcards', 'quiz', 'test'])
def test_router_study_tools_keep_validation_and_strict_schemas(router, kind):
    def handler(request):
        assert request.url == openrouter.URL
        assert request.headers['authorization'] == 'Bearer router-test-secret'
        payload = json.loads(request.content)
        assert payload['provider']['require_parameters'] is True
        schema = payload['response_format']['json_schema']
        assert schema['strict'] and schema['schema']['additionalProperties'] is False
        data = content(kind, 20 if kind == 'test' else 3)
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(data)}}]})
    router(handler)
    result = asyncio.run(llm.generate(schemas.GenerateRequest(kind=kind, n=3, document_ids=[1]), '[S1] lesson', {'S1'}))
    assert result
    if kind == 'test': assert len(result['questions']) == 20


def test_stream_reads_comments_usage_unicode_and_done(router):
    raw = ': keepalive\n\ndata: ' + json.dumps({'choices': [{'delta': {'content': 'Study 🌿 [S1]'}, 'finish_reason': None}]}, ensure_ascii=False) + '\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: {"choices":[],"usage":{}}\n\ndata: [DONE]\n\n'
    router(lambda request: httpx.Response(200, text=raw, headers={'content-type': 'text/event-stream'}))
    async def collect(): return [token async for token in llm.stream_chat('system', [], 'question')]
    assert asyncio.run(collect()) == ['Study 🌿 [S1]']


def test_router_failure_hides_raw_provider_details(router):
    router(lambda request: httpx.Response(401, json={'error': {'message': 'router-test-secret'}}))
    with pytest.raises(openrouter.ProviderError) as error:
        asyncio.run(llm.generate(schemas.GenerateRequest(kind='summary', document_ids=[1]), '[S1] lesson', {'S1'}))
    assert error.value.code == 401
    assert 'router-test-secret' not in str(error.value)
    assert 'authentication' in llm.friendly_error(error.value)


def test_unknown_citations_never_return_as_valid(router):
    calls = []
    def handler(request):
        calls.append(1)
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({**content('summary'), 'source_ids': ['S999']})}}]})
    router(handler)
    with pytest.raises(HTTPException) as error:
        asyncio.run(llm.generate(schemas.GenerateRequest(kind='summary', document_ids=[1]), '[S1] lesson', {'S1'}))
    assert error.value.status_code == 502 and len(calls) == 2


@pytest.mark.parametrize('partial,code,backup', [(False,429,True),(True,429,False),(False,401,False)])
def test_stream_fallback_only_before_output_and_on_temporary_errors(monkeypatch, partial, code, backup):
    monkeypatch.setenv('GEMINI_API_KEY', 'gemini-test-secret')
    monkeypatch.setenv('OPENROUTER_API_KEY', 'router-test-secret')
    monkeypatch.setenv('AI_FALLBACK_PROVIDER', 'auto')
    calls = []
    async def first(*args):
        if partial: yield 'Partial'
        raise openrouter.ProviderError('gemini', code)
    async def second(*args):
        calls.append(1); yield 'Backup [S1]'
    monkeypatch.setattr(llm, '_stream_gemini', first)
    monkeypatch.setattr(openrouter, 'stream', second)
    async def collect(): return [token async for token in llm.stream_chat('system', [], 'question')]
    if backup: assert asyncio.run(collect()) == ['Backup [S1]']
    else:
        with pytest.raises(openrouter.ProviderError): asyncio.run(collect())
    assert bool(calls) == backup


def test_generation_falls_back_once_but_explicit_provider_does_not(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'gemini-test-secret')
    monkeypatch.setenv('OPENROUTER_API_KEY', 'router-test-secret')
    monkeypatch.setenv('AI_FALLBACK_PROVIDER', 'auto')
    calls = []
    async def generate(req, material, ids, provider):
        calls.append(provider)
        if provider == 'gemini': raise openrouter.ProviderError(provider, 503)
        return content('summary')
    monkeypatch.setattr(llm, '_generate', generate)
    req = schemas.GenerateRequest(kind='summary', document_ids=[1])
    assert asyncio.run(llm.generate(req, '[S1]', {'S1'}))['title']
    assert calls == ['gemini', 'openrouter']
    calls.clear()
    with pytest.raises(openrouter.ProviderError): asyncio.run(llm.generate(req, '[S1]', {'S1'}, provider='gemini'))
    assert calls == ['gemini']


def test_openrouter_only_health_and_chat_route(clients, monkeypatch):
    monkeypatch.setenv('OPENROUTER_API_KEY', 'router-test-secret')
    monkeypatch.setenv('AI_PROVIDER', 'openrouter')
    one, _, _ = clients
    metadata = one.get('/api/health').json()
    assert metadata['ai_configured'] and metadata['provider'] == 'openrouter'
    assert 'router-test-secret' not in json.dumps(metadata)
    doc = upload(one)
    async def stream(*args): yield 'A lesson explanation [S1]'
    monkeypatch.setattr(llm, 'stream_chat', stream)
    result = one.post('/api/chat', json={'document_ids': [doc], 'question': 'Explain this lesson.'})
    assert result.status_code == 200 and 'A lesson explanation' in result.text


def test_stream_cancellation_closes_upstream(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'gemini-test-secret')
    closed = []
    async def stream(*args):
        try:
            yield 'first'
            await asyncio.sleep(5)
        finally: closed.append(True)
    monkeypatch.setattr(llm, '_stream_gemini', stream)
    async def run():
        source = llm.stream_chat('system', [], 'question')
        assert await anext(source) == 'first'
        await source.aclose()
    asyncio.run(run())
    assert closed == [True]


@pytest.mark.parametrize('frame', [
    'data: {"error":{"code":429,"message":"private detail"}}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
    'data: {"choices":"bad-shape"}\n\n',
    'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
])
def test_stream_errors_and_truncation_never_look_complete(router, frame):
    router(lambda request: httpx.Response(200, text=frame))
    async def collect(): return [token async for token in llm.stream_chat('system', [], 'question')]
    with pytest.raises(openrouter.ProviderError) as error: asyncio.run(collect())
    assert 'private detail' not in str(error.value)


def test_configuration_errors_are_not_silently_retried():
    assert not llm.retryable(HTTPException(503, 'Invalid model setting'))
    assert not llm.retryable(openrouter.ProviderError('openrouter', 402))
    assert not llm.retryable(openrouter.ProviderError('openrouter', 403))
    assert llm.retryable(openrouter.ProviderError('openrouter', 503))


def test_model_settings_cannot_expose_a_misplaced_secret(monkeypatch):
    monkeypatch.setenv('OPENROUTER_MODEL', 'sk-or-v1-private-test-value')
    metadata = llm.health()
    assert 'sk-or' not in json.dumps(metadata)


def test_bad_backup_model_does_not_disable_working_primary(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'gemini-test-secret')
    monkeypatch.setenv('OPENROUTER_API_KEY', 'router-test-secret')
    monkeypatch.setenv('OPENROUTER_MODEL', 'sk-or-v1-misplaced-test-value')
    monkeypatch.setenv('AI_FALLBACK_PROVIDER', 'auto')
    metadata = llm.health()
    assert metadata['ai_configured'] and metadata['provider'] == 'gemini'
    assert metadata['fallback_provider'] is None
    assert 'misplaced-test-value' not in json.dumps(metadata)
