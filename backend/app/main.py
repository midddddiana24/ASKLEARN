import asyncio
import json
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from argon2.exceptions import VerificationError
from fastapi import FastAPI, Depends, File, HTTPException, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, delete, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from . import config, llm, prompts, schemas
from .auth import current_user, hasher, rate_limit, sign_in
from .db import Base, engine, get_db, SessionLocal, User, LoginSession, Document, Chunk, Chat, Message, StudySet, Attempt
from .extract import ALLOWED, extract_pages
from .retrieval import chunk_pages, top_k, sample_chunks, material_chunks, sources_for, source_text
from .progress import router as progress_router, clear_workspace, touch
from .db import StudyProgress, Activity, WorkspaceState
from .migrations import migrate
from .onboarding import router as onboarding_router


@asynccontextmanager
async def lifespan(app):
    if os.getenv('CLOUD_PILOT') == 'true' and engine.dialect.name == 'sqlite':
        raise RuntimeError('Cloud pilot requires a managed Postgres DATABASE_URL; local SQLite is not durable on free hosting.')
    if os.getenv('CLOUD_PILOT') == 'true' and (not config.COOKIE_SECURE or not (os.getenv('PUBLIC_ORIGIN') or os.getenv('RENDER_EXTERNAL_URL', '')).startswith('https://')):
        raise RuntimeError('Cloud pilot requires secure cookies and an explicit HTTPS PUBLIC_ORIGIN.')
    migrate(engine)
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title='ASKLearn', lifespan=lifespan)
app.include_router(progress_router)
app.include_router(onboarding_router)


@app.middleware('http')
async def security_headers(request: Request, call_next):
    if request.url.path == '/api/documents' and request.method == 'POST':
        length = request.headers.get('content-length', '')
        if length.isdigit() and int(length) > config.MAX_UPLOAD_BYTES + 1048576:
            return JSONResponse({'detail': 'File too large. Use a smaller document.'}, status_code=413)
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin = request.headers.get('origin')
        allowed_origin = (os.getenv('PUBLIC_ORIGIN') or os.getenv('RENDER_EXTERNAL_URL') or str(request.base_url)).rstrip('/')
        if origin and origin.rstrip('/') != allowed_origin:
            return JSONResponse({'detail': 'Cross-origin requests are not allowed.'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'same-origin'
    response.headers['X-Frame-Options'] = 'DENY'
    if request.url.path.startswith('/api'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Do not reflect input values (including passwords) in validation responses.
    return JSONResponse(status_code=422, content={'detail': 'Please check the form values and try again.'})


@app.exception_handler(Exception)
async def server_error(request, exc):
    return JSONResponse(status_code=500, content={'detail': 'The request could not be completed. Please try again.'})


@app.get('/api/health')
def health():
    return {'status': 'ok', **llm.health()}


@app.post('/api/auth/register')
def register(req: schemas.Registration, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit('register:' + request.client.host, 10, 600)
    user = User(name=req.name, email=req.email, password_hash=hasher.hash(req.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'An account with this email already exists. Sign in instead.')
    return sign_in(db, user, response)


@app.post('/api/auth/login')
def login(req: schemas.Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit('login:' + request.client.host, 15, 300)
    user = db.scalar(select(User).where(User.email == req.email))
    try:
        if not user:
            # Equal-cost password verification for unknown email addresses.
            hasher.hash(req.password)
            raise HTTPException(401, 'Email or password is incorrect.')
        hasher.verify(user.password_hash, req.password)
    except VerificationError:
        raise HTTPException(401, 'Email or password is incorrect.')
    return sign_in(db, user, response)


@app.get('/api/auth/me')
def me(request: Request, user: User = Depends(current_user)):
    return {'id': user.id, 'name': user.name, 'email': user.email, 'csrf': request.state.login_session.csrf}


@app.post('/api/auth/logout')
def logout(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(request.state.login_session)
    db.commit()
    response.delete_cookie('asklearn_session', path='/')
    return {'ok': True}


def own(db: Session, model, identity: int, user: User):
    row = db.scalar(select(model).where(model.id == identity, model.user_id == user.id))
    if not row:
        raise HTTPException(404, 'This item was not found.')
    return row


def document_dict(doc):
    return {key: getattr(doc, key) for key in ('id', 'filename', 'file_type', 'pages', 'char_count', 'created_at')}


def load_chunks(db, ids, user):
    ids = list(dict.fromkeys(ids))
    docs = db.scalars(select(Document).where(Document.id.in_(ids), Document.user_id == user.id)).all()
    if len(docs) != len(ids):
        raise HTTPException(404, 'One or more selected documents were not found.')
    names = {doc.id: doc.filename for doc in docs}
    chunks = db.scalars(select(Chunk).where(Chunk.document_id.in_(ids)).order_by(Chunk.document_id, Chunk.id)).all()
    return [{'document_id': c.document_id, 'filename': names[c.document_id], 'page': c.page, 'text': c.text} for c in chunks]


@app.get('/api/documents')
def documents(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [document_dict(d) for d in db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.id.desc()))]


@app.post('/api/documents')
async def upload(file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(f'upload:{user.id}', 15)
    name = Path((file.filename or 'material').replace('\\', '/')).name[:255]
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, 'Unsupported file type. Use PDF, DOCX, PPTX, TXT or MD.')
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = config.UPLOAD_DIR / (uuid.uuid4().hex + ext)
    size = 0
    try:
        with path.open('wb') as target:
            while block := await file.read(65536):
                size += len(block)
                if size > config.MAX_UPLOAD_BYTES:
                    raise HTTPException(413, f'File too large. Maximum {config.MAX_UPLOAD_BYTES // 1048576} MB.')
                target.write(block)
        pages = await asyncio.to_thread(extract_pages, path)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    finally:
        path.unlink(missing_ok=True)
        await file.close()
    doc = Document(user_id=user.id, filename=name, file_type=ext[1:], pages=len(pages),
                   char_count=sum(len(p['text']) for p in pages))
    db.add(doc)
    db.flush()
    db.add_all([Chunk(document_id=doc.id, **c) for c in chunk_pages(pages)])
    db.commit()
    return document_dict(doc)


@app.patch('/api/documents/{identity}')
def rename(identity: int, req: schemas.RenameRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = own(db, Document, identity, user)
    name = req.filename.strip()
    if not name or '/' in name or '\\' in name:
        raise HTTPException(400, 'Enter a document name without slashes.')
    doc.filename = name
    db.commit()
    return document_dict(doc)


@app.delete('/api/documents/{identity}')
def remove_document(identity: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = own(db, Document, identity, user)
    # Generated material and chat excerpts contain source text too: delete dependent records.
    for chat in db.scalars(select(Chat).where(Chat.user_id == user.id)).all():
        if identity in chat.document_ids:
            db.execute(delete(Activity).where(Activity.user_id == user.id, Activity.kind == 'chat', Activity.resource_id == chat.id))
            db.execute(delete(Message).where(Message.chat_id == chat.id))
            db.delete(chat)
    for study in db.scalars(select(StudySet).where(StudySet.user_id == user.id)).all():
        if identity in study.document_ids:
            db.execute(delete(Activity).where(Activity.user_id == user.id, Activity.kind == 'study', Activity.resource_id == study.id))
            attempt_ids = select(Attempt.id).where(Attempt.study_set_id == study.id)
            db.execute(delete(Activity).where(Activity.user_id == user.id, Activity.kind == 'attempt', Activity.resource_id.in_(attempt_ids)))
            db.execute(delete(Attempt).where(Attempt.study_set_id == study.id))
            db.execute(delete(StudyProgress).where(StudyProgress.study_set_id == study.id))
            db.delete(study)
    db.execute(delete(Chunk).where(Chunk.document_id == identity))
    db.delete(doc)
    db.execute(delete(Activity).where(Activity.user_id == user.id, Activity.kind == 'document', Activity.resource_id == identity))
    clear_workspace(db, user.id)
    db.commit()
    return {'ok': True}


@app.get('/api/chats')
def chats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{'id': c.id, 'title': c.title, 'document_ids': c.document_ids} for c in
            db.scalars(select(Chat).where(Chat.user_id == user.id).order_by(Chat.id.desc()))]


@app.get('/api/chats/{identity}')
def chat_history(identity: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    chat = own(db, Chat, identity, user)
    messages = db.scalars(select(Message).where(Message.chat_id == identity).order_by(Message.id)).all()
    return {'id': chat.id, 'document_ids': chat.document_ids, 'messages': [
        {'role': m.role, 'content': m.content, 'sources': m.sources, 'status': m.status} for m in messages]}


def event(kind, data):
    return (f'event: {kind}\n' if kind else '') + f'data: {json.dumps(data)}\n\n'


@app.post('/api/chat')
async def chat(req: schemas.ChatRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(f'ai:{user.id}', 8)
    chunks = load_chunks(db, req.document_ids, user)
    if not req.question.strip():
        raise HTTPException(400, 'Type a question first.')
    llm.ensure_configured()
    sources = sources_for(top_k(chunks, req.question) or sample_chunks(chunks, 6))
    if req.chat_id:
        conversation = own(db, Chat, req.chat_id, user)
        if set(conversation.document_ids) != set(req.document_ids):
            raise HTTPException(400, 'Start a new chat when changing selected documents.')
    else:
        conversation = Chat(user_id=user.id, title=req.question[:100], document_ids=req.document_ids)
        db.add(conversation)
        db.flush()
    old = db.scalars(select(Message).where(Message.chat_id == conversation.id, Message.status == 'complete')
                     .order_by(Message.id.desc()).limit(8)).all()
    history = [{'role': m.role, 'content': m.content[:6000]} for m in reversed(old)]
    db.add(Message(chat_id=conversation.id, role='user', content=req.question, sources=[]))
    db.commit()
    chat_id = conversation.id

    async def events():
        text, status = '', 'interrupted'
        yield event('meta', {'chat_id': chat_id})
        yield event('sources', sources)
        try:
            async for token in llm.stream_chat(prompts.CHAT_SYSTEM + '\nSOURCES:\n' + source_text(sources), history, req.question):
                if await request.is_disconnected():
                    break
                text += token
                yield event('', token)
            else:
                status = 'complete'
                if not text.strip():
                    raise ValueError('Empty answer')
                allowed = {s['id'] for s in sources}
                cited = set(re.findall(r'\[(S\d+)\]', text))
                missing = not cited and "couldn't find that in your uploaded materials" not in text.lower()
                if not cited.issubset(allowed) or missing:
                    status = 'error'
                    yield event('error', 'The answer has missing or invalid citations. Verify it against the source excerpts.')
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            status = 'error'
            yield event('error', llm.friendly_error(exc))
        finally:
            with SessionLocal() as storage:
                if storage.get(Chat, chat_id):
                    storage.add(Message(chat_id=chat_id, role='assistant', content=text, sources=sources, status=status))
                    touch(storage, user.id, 'chat', chat_id)
                    storage.commit()
        yield event('done', {'status': status})
    return StreamingResponse(events(), media_type='text/event-stream', headers={'X-Accel-Buffering': 'no'})


def public_study(study):
    content = study.content
    if study.kind in ('quiz', 'test'):
        content = {'questions': [{k: v for k, v in q.items() if k in ('type', 'question', 'choices')} for q in content['questions']]}
    return {'id': study.id, 'kind': study.kind, 'document_ids': study.document_ids,
            'content': content, 'created_at': study.created_at}


@app.post('/api/generate')
async def generate(req: schemas.GenerateRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(f'ai:{user.id}', 8)
    chunks = material_chunks(load_chunks(db, req.document_ids, user))
    sources = sources_for(chunks)
    if req.kind == 'test':
        req.types = ['mcq', 'true_false', 'identification']
    try:
        content = await llm.generate(req, source_text(sources), {s['id'] for s in sources})
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(503, llm.friendly_error(exc))
    content['sources'] = sources
    # A student may delete a material while the provider request is in flight.
    load_chunks(db, req.document_ids, user)
    content['sampled'] = len(chunks) < len(load_chunks(db, req.document_ids, user))
    study = StudySet(user_id=user.id, document_ids=req.document_ids, kind=req.kind, content=content)
    db.add(study)
    db.commit()
    return public_study(study)


@app.get('/api/study-sets')
def study_sets(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{'id': s.id, 'kind': s.kind, 'document_ids': s.document_ids, 'created_at': s.created_at}
            for s in db.scalars(select(StudySet).where(StudySet.user_id == user.id).order_by(StudySet.id.desc()))]


@app.get('/api/study-sets/{identity}')
def study_set(identity: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return public_study(own(db, StudySet, identity, user))


def normalize(value):
    return value.strip().casefold()


def correct(question, answer):
    return normalize(answer) == normalize(question['answer'])


def finish(db, attempt, study):
    for _ in range(4):
        db.refresh(attempt)
        if attempt.submitted_at is not None:
            return
        score = sum(correct(q, attempt.answers.get(str(i), '')) for i, q in enumerate(study.content['questions']))
        result = db.execute(update(Attempt).where(Attempt.id == attempt.id, Attempt.version == attempt.version, Attempt.submitted_at.is_(None))
                            .values(score=score, submitted_at=time.time(), version=attempt.version + 1))
        if result.rowcount == 1:
            db.commit(); db.refresh(attempt); return
        db.rollback()
    raise HTTPException(409, 'Answers changed while submitting. Load the latest attempt and submit again.')


def attempt_dict(attempt, study):
    result = {'id': attempt.id, 'study_set_id': study.id, 'kind': study.kind, 'deadline': attempt.deadline,
              'version': attempt.version,
              'server_time': time.time(), 'answers': attempt.answers, 'total': attempt.total,
              'submitted': attempt.submitted_at is not None}
    if attempt.submitted_at:
        result.update(score=attempt.score, questions=study.content['questions'], sources=study.content['sources'])
    elif study.kind == 'quiz':
        result['feedback'] = {i: {**study.content['questions'][int(i)], 'correct': correct(study.content['questions'][int(i)], a)}
                              for i, a in attempt.answers.items()}
        result['sources'] = study.content['sources']
    return result


@app.post('/api/attempts')
def start_attempt(req: schemas.StartAttempt, user: User = Depends(current_user), db: Session = Depends(get_db)):
    study = own(db, StudySet, req.study_set_id, user)
    if study.kind not in ('quiz', 'test'):
        raise HTTPException(400, 'Choose a quiz or practice test.')
    prior = db.scalar(select(Attempt).where(Attempt.study_set_id == study.id, Attempt.user_id == user.id,
                                           Attempt.submitted_at.is_(None)))
    if prior:
        if time.time() >= prior.deadline:
            finish(db, prior, study)
        return attempt_dict(prior, study)
    attempt = Attempt(user_id=user.id, study_set_id=study.id, total=len(study.content['questions']),
                      deadline=time.time() + (req.minutes * 60 if study.kind == 'test' else 86400))
    db.add(attempt)
    db.commit()
    return attempt_dict(attempt, study)


@app.get('/api/attempts')
def attempts(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Attempt).where(Attempt.user_id == user.id).order_by(Attempt.id.desc())).all()
    result = []
    for attempt in rows:
        study = own(db, StudySet, attempt.study_set_id, user)
        if time.time() >= attempt.deadline:
            finish(db, attempt, study)
        result.append(attempt_dict(attempt, study))
    return result


@app.get('/api/attempts/{identity}')
def get_attempt(identity: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    attempt = own(db, Attempt, identity, user)
    study = own(db, StudySet, attempt.study_set_id, user)
    if time.time() >= attempt.deadline:
        finish(db, attempt, study)
    return attempt_dict(attempt, study)


@app.put('/api/attempts/{identity}/answers')
def answer(identity: int, req: schemas.AnswerRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    attempt = own(db, Attempt, identity, user)
    study = own(db, StudySet, attempt.study_set_id, user)
    if time.time() >= attempt.deadline:
        finish(db, attempt, study)
    if attempt.submitted_at:
        return attempt_dict(attempt, study)
    if req.index >= attempt.total:
        raise HTTPException(400, 'Question not found.')
    if study.kind == 'quiz' and str(req.index) in attempt.answers:
        raise HTTPException(409, 'This quiz answer is already checked. Continue to the next question.')
    version = attempt.version if req.version is None else req.version
    result = db.execute(update(Attempt).where(Attempt.id == identity, Attempt.user_id == user.id,
                        Attempt.version == version, Attempt.submitted_at.is_(None))
                        .values(answers={**attempt.answers, str(req.index): req.answer}, version=version + 1))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, 'Answers changed on another device. Load the latest answers before continuing.')
    db.commit()
    db.refresh(attempt)
    return attempt_dict(attempt, study)


@app.post('/api/attempts/{identity}/submit')
def submit(identity: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    attempt = own(db, Attempt, identity, user)
    study = own(db, StudySet, attempt.study_set_id, user)
    finish(db, attempt, study)
    return attempt_dict(attempt, study)


@app.delete('/api/data')
def delete_data(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ids = select(Document.id).where(Document.user_id == user.id)
    db.execute(delete(Chunk).where(Chunk.document_id.in_(ids)))
    chats = select(Chat.id).where(Chat.user_id == user.id)
    db.execute(delete(Message).where(Message.chat_id.in_(chats)))
    for model in (StudyProgress, Activity, Attempt, StudySet, Chat, Document):
        db.execute(delete(model).where(model.user_id == user.id))
    clear_workspace(db, user.id)
    db.commit()
    return {'ok': True}


DIST = config.ROOT / 'frontend' / 'dist'
if DIST.exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')

    @app.get('/{path:path}')
    def frontend(path: str):
        if path.startswith('api/'):
            raise HTTPException(404, 'Endpoint not found.')
        candidate = (DIST / path).resolve()
        if candidate.is_relative_to(DIST.resolve()) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / 'index.html')
