import asyncio
import io
import time
from pathlib import Path
import pytest
from pydantic import ValidationError
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from docx import Document as WordDocument
from pptx import Presentation
from fastapi import HTTPException
from backend.app import config, llm, main, schemas
from backend.app.extract import extract_pages
from backend.app.retrieval import chunk_pages, top_k, material_chunks, sources_for
from backend.app.db import Attempt, StudySet
from .conftest import LESSON, upload, content


def make_pdf(path, text=True):
    writer = PdfWriter(); page = writer.add_blank_page(width=600, height=800)
    if text:
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
        stream = DecodedStreamObject(); stream.set_data(f'BT /F1 12 Tf 40 700 Td ({LESSON}) Tj ET'.encode())
        page[NameObject('/Contents')] = writer._add_object(stream)
    writer.write(path)


@pytest.mark.parametrize('extension', ['txt', 'md', 'docx', 'pptx', 'pdf'])
def test_extraction(tmp_path, extension):
    path = tmp_path / ('lesson.' + extension)
    if extension in ('txt', 'md'):
        path.write_text(LESSON, encoding='utf-8')
    elif extension == 'docx':
        doc = WordDocument(); doc.add_paragraph(LESSON); doc.save(path)
    elif extension == 'pptx':
        prs = Presentation(); slide = prs.slides.add_slide(prs.slide_layouts[1]); slide.placeholders[1].text = LESSON; prs.save(path)
    else:
        make_pdf(path)
    pages = extract_pages(path)
    assert 'Photosynthesis' in pages[0]['text']
    assert pages[0]['page'] == 1


def test_scanned_and_corrupt_pdf(tmp_path):
    path = tmp_path / 'scanned.pdf'; make_pdf(path, False)
    with pytest.raises(ValueError, match='No readable text'):
        extract_pages(path)
    path.write_bytes(b'not a pdf')
    with pytest.raises(ValueError, match='could not be read'):
        extract_pages(path)


def test_retrieval_and_sampling():
    chunks = chunk_pages([{'page': 1, 'text': LESSON * 10}, {'page': 2, 'text': 'Volcanoes erupt with lava.' * 30}])
    assert top_k(chunks, 'chlorophyll')[0]['page'] == 1
    assert top_k(chunks, 'unrelatedxyz') == []
    assert top_k([{'text': LESSON, 'page': 1}], 'photosynthesis')
    with pytest.raises(ValueError):
        chunk_pages([], 10, 10)
    sampled = material_chunks(chunks * 100)
    assert len(sampled) < len(chunks * 100)
    assert sum(len(c['text']) + 100 for c in sampled) <= config.CONTEXT_CHARS


def test_auth_csrf_and_logout(clients):
    one, two, _ = clients
    assert one.get('/api/auth/me').json()['email'] == 'one@example.com'
    assert one.delete('/api/data', headers={'X-CSRF-Token': ''}).status_code == 403
    assert one.post('/api/auth/login', json={'email': 'one@example.com', 'password': 'wrong-password'}).status_code == 401
    assert one.post('/api/auth/login', headers={'Origin': 'https://evil.example'}, json={'email': 'one@example.com', 'password': 'strong-password-2026'}).status_code == 403
    assert one.post('/api/auth/logout').status_code == 200
    assert one.get('/api/documents').status_code == 401
    login = one.post('/api/auth/login', json={'email': 'one@example.com', 'password': 'strong-password-2026'})
    assert login.status_code == 200
    assert 'HttpOnly' in login.headers['set-cookie']


def test_document_limits_and_cleanup(clients, monkeypatch):
    one, _, _ = clients
    assert one.post('/api/documents', files={'file': ('x.exe', LESSON)}).status_code == 400
    assert one.post('/api/documents', files={'file': ('x.txt', 'short')}).status_code == 400
    monkeypatch.setattr(config, 'MAX_UPLOAD_BYTES', 100)
    assert one.post('/api/documents', files={'file': ('x.txt', LESSON)}).status_code == 413
    assert list(config.UPLOAD_DIR.iterdir()) == []


def test_document_isolation_rename_delete(clients):
    one, two, _ = clients
    identity = upload(one)
    assert two.get('/api/documents').json() == []
    assert two.delete(f'/api/documents/{identity}').status_code == 404
    assert two.patch(f'/api/documents/{identity}', json={'filename': 'stolen'}).status_code == 404
    assert one.patch(f'/api/documents/{identity}', json={'filename': 'Cell biology'}).json()['filename'] == 'Cell biology'
    assert two.post('/api/generate', json={'kind': 'summary', 'document_ids': [identity]}).status_code == 404
    assert one.delete(f'/api/documents/{identity}').status_code == 200
    assert one.get('/api/documents').json() == []


def test_missing_ai_key(clients):
    one, _, _ = clients; identity = upload(one)
    assert one.get('/api/health').json()['ai_configured'] is False
    assert one.post('/api/chat', json={'document_ids': [identity], 'question': 'Explain'}).status_code == 503
    assert one.post('/api/generate', json={'document_ids': [identity], 'kind': 'summary'}).status_code == 503


def test_question_validation():
    valid = content('quiz', 3)['questions'][0]
    schemas.Question.model_validate(valid)
    for changes in [{'choices': ['A', 'B']}, {'answer': 'not in choices'}, {'choices': None}, {'source_ids': []}]:
        with pytest.raises(ValidationError):
            schemas.Question.model_validate({**valid, **changes})


@pytest.mark.parametrize('kind', ['summary', 'reviewer', 'flashcards', 'quiz', 'test'])
def test_generators_and_isolation(clients, monkeypatch, kind):
    one, two, _ = clients; identity = upload(one)
    async def fake(req, material, sources):
        assert '[S1]' in material
        return content(req.kind, 20 if req.kind == 'test' else req.n)
    monkeypatch.setattr(llm, 'generate', fake)
    result = one.post('/api/generate', json={'document_ids': [identity], 'kind': kind})
    assert result.status_code == 200, result.text
    study = result.json(); sid = study['id']
    assert one.get(f'/api/study-sets/{sid}').status_code == 200
    assert two.get(f'/api/study-sets/{sid}').status_code == 404
    if kind in ('quiz', 'test'):
        assert 'answer' not in str(study['content'])
        assert 'explanation' not in str(study['content'])
    one.delete(f'/api/documents/{identity}')
    assert one.get('/api/study-sets').json() == []


def test_scoring_timer_and_answer_secrecy(clients):
    one, two, factory = clients
    doc = upload(one)
    with factory() as db:
        study = StudySet(user_id=1, document_ids=[doc], kind='test', content={**content('test', 21), 'sources': []})
        db.add(study); db.commit(); sid = study.id
    start = one.post('/api/attempts', json={'study_set_id': sid, 'minutes': 5}).json(); aid = start['id']
    assert 'questions' not in start and 'feedback' not in start
    assert two.get(f'/api/attempts/{aid}').status_code == 404
    assert one.post('/api/attempts', json={'study_set_id': sid}).json()['id'] == aid
    saved = one.put(f'/api/attempts/{aid}/answers', json={'index': 0, 'answer': 'Oxygen'}).json()
    assert 'questions' not in saved and 'feedback' not in saved
    one.put(f'/api/attempts/{aid}/answers', json={'index': 2, 'answer': ' chlorophyll '})
    with factory() as db:
        row = db.get(Attempt, aid); row.deadline = time.time() - 1; db.commit()
    late = one.put(f'/api/attempts/{aid}/answers', json={'index': 1, 'answer': 'True'}).json()
    assert late['submitted'] and late['score'] == 2
    assert '1' not in late['answers']
    assert one.post(f'/api/attempts/{aid}/submit').json()['score'] == 2
    assert len(late['questions']) == 21


def test_quiz_feedback_locked_and_delete_data(clients):
    one, two, factory = clients; doc = upload(one)
    with factory() as db:
        study = StudySet(user_id=1, document_ids=[doc], kind='quiz', content={**content('quiz', 3), 'sources': []})
        db.add(study); db.commit(); sid = study.id
    attempt = one.post('/api/attempts', json={'study_set_id': sid}).json()
    aid = attempt['id']
    assert one.put(f'/api/attempts/{aid}/answers', json={'index': 0, 'answer': 'Oxygen'}).json()['feedback']['0']['correct']
    assert one.put(f'/api/attempts/{aid}/answers', json={'index': 0, 'answer': 'Nitrogen'}).status_code == 409
    assert one.delete('/api/data').status_code == 200
    assert one.get('/api/attempts').json() == []
    assert one.get('/api/auth/me').status_code == 200


def test_streaming_history_sources_and_errors(clients, monkeypatch):
    one, two, _ = clients; doc = upload(one); monkeypatch.setenv('GEMINI_API_KEY', 'test-only')
    histories = []
    async def fake(system, history, question):
        assert '[S1]' in system; histories.append(history)
        yield 'Light becomes chemical energy. [S1]'
    monkeypatch.setattr(llm, 'stream_chat', fake)
    first = one.post('/api/chat', json={'document_ids': [doc], 'question': 'What is photosynthesis?'})
    assert 'event: sources' in first.text and 'event: done' in first.text
    cid = one.get('/api/chats').json()[0]['id']
    assert two.get(f'/api/chats/{cid}').status_code == 404
    followup = one.post('/api/chat', json={'document_ids': [doc], 'question': 'Explain that simply', 'chat_id': cid})
    assert 'event: done' in followup.text and len(histories[-1]) == 2
    async def fail(*args):
        raise RuntimeError('private provider detail')
        yield ''
    monkeypatch.setattr(llm, 'stream_chat', fail)
    failed = one.post('/api/chat', json={'document_ids': [doc], 'question': 'Why?', 'chat_id': cid})
    assert 'event: error' in failed.text and 'private provider detail' not in failed.text
    assert one.get(f'/api/chats/{cid}').json()['messages'][-1]['status'] == 'error'


@pytest.mark.parametrize('text,status', [
    ('A claim with an invented citation. [S999]', 'error'),
    ('A claim without any source reference.', 'error'),
    ("I couldn't find that in your uploaded materials.", 'complete'),
])
def test_chat_citation_verdicts(clients, monkeypatch, text, status):
    one, _, _ = clients; doc = upload(one); monkeypatch.setenv('GEMINI_API_KEY', 'test-only')
    async def fake(*args):
        yield text
    monkeypatch.setattr(llm, 'stream_chat', fake)
    result = one.post('/api/chat', json={'document_ids': [doc], 'question': 'Explain this lesson'})
    assert ('event: error' in result.text) == (status == 'error')
    cid = one.get('/api/chats').json()[0]['id']
    assert one.get(f'/api/chats/{cid}').json()['messages'][-1]['status'] == status
