from fastapi.testclient import TestClient
from backend.app.main import app


def test_account_owned_tour_progress_and_terminal_state(clients):
    one, two, _ = clients
    initial = one.get('/api/onboarding')
    assert initial.status_code == 200
    assert initial.json()['dashboard']['status'] == 'not_started'
    payload = {'section': 'dashboard', 'guide_version': 1, 'step': 1, 'status': 'in_progress'}
    assert one.patch('/api/onboarding', json=payload).status_code == 200
    assert one.get('/api/onboarding').json()['dashboard']['step'] == 1
    assert two.get('/api/onboarding').json()['dashboard']['status'] == 'not_started'
    payload.update(status='completed', step=3)
    assert one.patch('/api/onboarding', json=payload).status_code == 200
    payload.update(status='in_progress', step=0)
    assert one.patch('/api/onboarding', json=payload).json()['dashboard']['status'] == 'completed'
    assert one.get('/api/onboarding').json()['library']['status'] == 'not_started'


def test_tour_validation_and_csrf(clients):
    one, _, _ = clients
    payload = {'section': 'library', 'guide_version': 1, 'step': 3, 'status': 'skipped'}
    assert one.patch('/api/onboarding', json=payload).status_code == 200
    for invalid in ({'section': 'other'}, {'step': 9}, {'guide_version': 200}, {'status': 'bogus'}):
        assert one.patch('/api/onboarding', json={**payload, **invalid}).status_code == 422
    token = one.headers.pop('X-CSRF-Token')
    assert one.patch('/api/onboarding', json=payload).status_code == 403
    one.headers['X-CSRF-Token'] = token
    with TestClient(app) as anonymous:
        assert anonymous.get('/api/onboarding').status_code == 401
