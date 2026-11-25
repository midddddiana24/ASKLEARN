from .conftest import upload


def test_deleting_unselected_material_preserves_workspace(clients):
    one, _, _ = clients
    keep, remove = upload(one), upload(one)
    saved = one.put('/api/workspace', json={'version': 0, 'data': {'document_ids': [keep], 'tab': 'summary'}})
    assert saved.status_code == 200
    before = one.get('/api/workspace').json()
    assert one.delete(f'/api/documents/{remove}').status_code == 200
    assert one.get('/api/workspace').json() == before
    assert [d['id'] for d in one.get('/api/documents').json()] == [keep]


def test_deleting_selected_material_resets_workspace_and_preserves_other_files(clients):
    one, _, _ = clients
    remove, keep = upload(one), upload(one)
    assert one.put('/api/workspace', json={'version': 0, 'data': {'document_ids': [remove, keep], 'tab': 'chat'}}).status_code == 200
    assert one.delete(f'/api/documents/{remove}').status_code == 200
    state = one.get('/api/workspace').json()
    assert state['version'] == 2
    assert state['data']['document_ids'] == []
    assert [d['id'] for d in one.get('/api/documents').json()] == [keep]


def test_rename_preserves_workspace_and_file_type_and_checks_ownership(clients):
    one, two, _ = clients
    identity = upload(one)
    assert one.put('/api/workspace', json={'version': 0, 'data': {'document_ids': [identity], 'tab': 'chat'}}).status_code == 200
    before = one.get('/api/workspace').json()
    renamed = one.patch(f'/api/documents/{identity}', json={'filename': '  Cell energy  '})
    assert renamed.status_code == 200
    assert renamed.json()['filename'] == 'Cell energy'
    assert renamed.json()['file_type'] == 'txt'
    assert one.get('/api/workspace').json() == before
    for invalid in (' ', 'a/b', 'a\\b', 'a' * 256):
        assert one.patch(f'/api/documents/{identity}', json={'filename': invalid}).status_code in (400, 422)
    assert two.patch(f'/api/documents/{identity}', json={'filename': 'Other account'}).status_code == 404
    assert two.delete(f'/api/documents/{identity}').status_code == 404
