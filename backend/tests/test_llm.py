"""Exercise the real validation/retry wrapper without external API calls."""
import asyncio
import json
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from backend.app import llm, schemas
from .conftest import content


@pytest.fixture(autouse=True)
def configured_gemini(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-only-not-a-real-key')


class Provider:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = 0
        self.aio = self
        self.models = self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def generate_content(self, **kwargs):
        self.calls += 1
        return SimpleNamespace(text=next(self.responses))


def test_generation_retries_invalid_json_once(monkeypatch):
    provider = Provider(['not json', json.dumps(content('summary'))])
    monkeypatch.setattr(llm, 'client', lambda: provider)
    result = asyncio.run(llm.generate(schemas.GenerateRequest(kind='summary', document_ids=[1]), '[S1] lesson', {'S1'}))
    assert result['source_ids'] == ['S1'] and provider.calls == 2


def test_generation_rejects_unknown_sources_and_stops(monkeypatch):
    wrong = {**content('summary'), 'source_ids': ['S999']}
    provider = Provider([json.dumps(wrong)] * 2)
    monkeypatch.setattr(llm, 'client', lambda: provider)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(llm.generate(schemas.GenerateRequest(kind='summary', document_ids=[1]), '[S1] lesson', {'S1'}))
    assert exc.value.status_code == 502 and provider.calls == 2


def test_invalid_questions_are_dropped_and_short_test_rejected(monkeypatch):
    data = content('test', 20)
    data['questions'][0]['answer'] = 'not a choice'
    provider = Provider([json.dumps(data)] * 2)
    monkeypatch.setattr(llm, 'client', lambda: provider)
    with pytest.raises(HTTPException):
        asyncio.run(llm.generate(schemas.GenerateRequest(kind='test', document_ids=[1]), '[S1] lesson', {'S1'}))
    assert provider.calls == 2


def test_quota_error_message_hides_provider_details():
    error = RuntimeError('sensitive-provider-detail'); error.code = 429
    assert 'quota' in llm.friendly_error(error)
    assert 'sensitive-provider-detail' not in llm.friendly_error(error)
