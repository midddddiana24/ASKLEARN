import asyncio
import json
from backend.scripts import check_ai


def test_missing_key_never_contacts_provider(monkeypatch, capsys):
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    assert asyncio.run(check_ai.check()) == 2
    assert json.loads(capsys.readouterr().out)['status'] == 'unconfigured'


def test_diagnostic_checks_stream_and_structured_sources(monkeypatch, capsys):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-secret-do-not-print')
    async def stream(*args, **kwargs):
        yield 'Plants use light energy. [S1]'
    async def generate(req, material, source_ids, **kwargs):
        assert req.kind == 'summary' and source_ids == {'S1'}
        assert 'Photosynthesis' in material
        return {'title': 'Energy', 'summary': 'Plants use light.', 'key_points': ['Light'], 'source_ids': ['S1']}
    monkeypatch.setattr(check_ai.llm, 'stream_chat', stream)
    monkeypatch.setattr(check_ai.llm, 'generate', generate)
    assert asyncio.run(check_ai.check()) == 0
    output = capsys.readouterr().out
    assert json.loads(output)['status'] == 'valid'
    assert 'test-secret' not in output


def test_diagnostic_sanitizes_failure_and_does_not_retry(monkeypatch, capsys):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-secret-do-not-print')
    calls = []
    async def stream(*args, **kwargs):
        calls.append(1)
        error = RuntimeError('test-secret-do-not-print')
        error.code = 403
        raise error
        yield ''
    monkeypatch.setattr(check_ai.llm, 'stream_chat', stream)
    assert asyncio.run(check_ai.check()) == 1
    output = capsys.readouterr().out
    assert json.loads(output)['status'] == 'authentication_error'
    assert 'test-secret' not in output and calls == [1]
