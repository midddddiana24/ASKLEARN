from .conftest import upload, content
from backend.app.db import StudySet


def test_profile_and_password_change(clients):
    one, two, _ = clients
    assert one.get('/api/profile').json()['avatar'] == 'sage'
    result = one.patch('/api/profile', json={'name': 'Returning Student', 'avatar': 'mint', 'companion': False})
    assert result.status_code == 200
    assert one.get('/api/auth/me').json()['name'] == 'Returning Student'
    assert two.get('/api/profile').json()['name'] == 'Student'
    assert one.post('/api/auth/change-password', json={'current_password': 'wrong', 'new_password': 'new-strong-password'}).status_code == 401
    assert one.post('/api/auth/change-password', json={'current_password': 'strong-password-2026', 'new_password': 'new-strong-password'}).status_code == 200
    assert one.get('/api/auth/me').status_code == 401
    assert one.post('/api/auth/login', json={'email': 'one@example.com', 'password': 'new-strong-password'}).status_code == 200


def test_workspace_resume_ownership_and_conflicts(clients):
    one, two, _ = clients; doc = upload(one)
    assert one.get('/api/workspace').json()['version'] == 0
    state = {'document_ids': [doc], 'tab': 'summary', 'chat_id': None, 'study_set_id': None, 'attempt_id': None}
    saved = one.put('/api/workspace', json={'version': 0, 'data': state})
    assert saved.status_code == 200
    assert one.get('/api/workspace').json()['data']['tab'] == 'summary'
    assert one.put('/api/workspace', json={'version': 0, 'data': state}).status_code == 409
    assert two.put('/api/workspace', json={'version': 0, 'data': state}).status_code == 404
    assert one.get('/api/workspace').json()['version'] == 1


def test_flashcard_progress_survives_reopen_and_validates(clients):
    one, two, factory = clients; doc = upload(one)
    with factory() as db:
        study = StudySet(user_id=1, document_ids=[doc], kind='flashcards', content={**content('flashcards', 3), 'sources': []})
        db.add(study); db.commit(); sid = study.id
    url = f'/api/study-sets/{sid}/progress'
    data = {'order': [2, 0, 1], 'index': 1, 'flipped': False, 'known': 1, 'again': []}
    assert one.put(url, json={'version': 0, 'data': data}).status_code == 200
    assert one.get(url).json()['data'] == data
    assert two.get(url).status_code == 404
    assert one.put(url, json={'version': 0, 'data': data}).status_code == 409
    assert one.put(url, json={'version': 1, 'data': {**data, 'order': [99]}}).status_code == 422
    assert one.delete(f'/api/documents/{doc}').status_code == 200
    assert one.get(url).status_code == 404


def test_history_search_and_data_delete(clients):
    one, two, _ = clients; doc = upload(one)
    page = one.get('/api/history?q=biology&type=document&limit=1').json()
    assert len(page['items']) == 1
    assert page['items'][0]['id'] == doc
    assert two.get('/api/history').json()['items'] == []
    one.put('/api/workspace', json={'version': 0, 'data': {'document_ids': [doc], 'tab': 'chat'}})
    assert one.delete('/api/data').status_code == 200
    assert one.get('/api/history').json()['items'] == []
    assert one.get('/api/workspace').json()['data']['document_ids'] == []


def test_assessment_answer_conflict_preserves_newer_answer(clients):
    one, _, factory = clients; doc = upload(one)
    with factory() as db:
        study = StudySet(user_id=1, document_ids=[doc], kind='test', content={**content('test', 20), 'sources': []})
        db.add(study); db.commit(); sid = study.id
    started = one.post('/api/attempts', json={'study_set_id': sid}).json()
    assert started['version'] == 0
    url = f"/api/attempts/{started['id']}/answers"
    first = one.put(url, json={'index': 0, 'answer': 'Oxygen', 'version': 0})
    assert first.status_code == 200 and first.json()['version'] == 1
    assert one.put(url, json={'index': 0, 'answer': 'Nitrogen', 'version': 0}).status_code == 409
    assert one.get(f"/api/attempts/{started['id']}").json()['answers']['0'] == 'Oxygen'


def test_concurrent_activity_updates_are_not_progress_conflicts(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import Session
    from sqlalchemy import select
    from backend.app.db import Base, User, Activity, make_engine
    from backend.app.progress import touch
    engine = make_engine(f'sqlite:///{tmp_path / "activity.db"}')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(User(id=1, name='Fixture', email='fixture@example.com', password_hash='fixture')); db.commit()
    barrier = Barrier(2)
    def write():
        with Session(engine) as db:
            barrier.wait(timeout=5)
            touch(db, 1, 'study', 99); db.commit()
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: write(), range(2)))
    with Session(engine) as db:
        assert len(list(db.scalars(select(Activity)))) == 1
    engine.dispose()
