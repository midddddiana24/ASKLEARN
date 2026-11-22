import os
from pathlib import Path
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['GEMINI_API_KEY'] = ''
os.environ['OPENROUTER_API_KEY'] = ''
os.environ['AI_PROVIDER'] = 'gemini'
os.environ['AI_FALLBACK_PROVIDER'] = 'none'
os.environ['GEMINI_MODEL'] = 'gemini-3.1-flash-lite'
os.environ['OPENROUTER_MODEL'] = 'openrouter/free'

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from backend.app.main import app
from backend.app import main, auth, config
from backend.app.db import Base, get_db
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def clients(tmp_path, monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    def dependency():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = dependency
    monkeypatch.setattr(main, 'SessionLocal', factory)
    monkeypatch.setattr(config, 'UPLOAD_DIR', tmp_path / 'uploads')
    auth._requests.clear()
    with TestClient(app) as one, TestClient(app) as two:
        for client, email in [(one, 'one@example.com'), (two, 'two@example.com')]:
            result = client.post('/api/auth/register', json={'name': 'Student', 'email': email, 'password': 'strong-password-2026'})
            assert result.status_code == 200, result.text
            client.headers['X-CSRF-Token'] = result.json()['csrf']
        yield one, two, factory
    app.dependency_overrides.clear()
    engine.dispose()


LESSON = ('Photosynthesis converts light energy into chemical energy stored in glucose. '
          'Plants use sunlight, water and carbon dioxide to produce glucose and oxygen. '
          'Chlorophyll is a pigment that absorbs light. ')


def upload(client, text=LESSON):
    result = client.post('/api/documents', files={'file': ('Biology.txt', text.encode(), 'text/plain')})
    assert result.status_code == 200, result.text
    return result.json()['id']


def content(kind, n=10):
    if kind == 'summary':
        return {'title': 'Photosynthesis: light into life', 'summary': 'Plants convert light energy into chemical energy stored in glucose. [S1]',
                'key_points': ['Sunlight supplies energy.', 'Water and carbon dioxide are used.', 'Glucose and oxygen are produced.'], 'source_ids': ['S1']}
    if kind == 'reviewer':
        return {'title': 'Photosynthesis study guide', 'sections': [{'heading': 'The energy connection',
            'points': ['Light energy becomes chemical energy.', 'Glucose stores chemical energy.'], 'source_ids': ['S1']}],
            'key_terms': [{'term': 'Chlorophyll', 'definition': 'A pigment that absorbs light.'}]}
    if kind == 'flashcards':
        return {'cards': [{'front': f'{i + 1}. What does photosynthesis convert?', 'back': 'Light energy into chemical energy.', 'source_ids': ['S1']} for i in range(n)]}
    questions = []
    for i in range(n):
        typ = ['mcq', 'true_false', 'identification'][i % 3]
        questions.append({'type': typ, 'question': f'{i + 1}. ' + {'mcq': 'Which gas is produced by photosynthesis?',
            'true_false': 'Photosynthesis converts light energy into chemical energy.', 'identification': 'Name the pigment that absorbs light.'}[typ],
            'choices': ['Oxygen', 'Nitrogen', 'Helium', 'Hydrogen'] if typ == 'mcq' else None,
            'answer': {'mcq': 'Oxygen', 'true_false': 'True', 'identification': 'Chlorophyll'}[typ],
            'explanation': 'The sample lesson explains the materials and energy changes in photosynthesis.', 'source_ids': ['S1']})
    return {'questions': questions}
