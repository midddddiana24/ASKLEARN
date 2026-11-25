import time
from typing import Literal
from argon2.exceptions import VerificationError
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from .auth import current_user, hasher, rate_limit
from .db import User, UserProfile, WorkspaceState, StudyProgress, Activity, Document, Chat, StudySet, Attempt, LoginSession, get_db

router = APIRouter(prefix='/api')
EMPTY_WORKSPACE = {'document_ids': [], 'tab': 'chat', 'chat_id': None, 'study_set_id': None, 'attempt_id': None}


def owned(db, model, identity, user):
    result = db.scalar(select(model).where(model.id == identity, model.user_id == user.id))
    if not result:
        raise HTTPException(404, 'This saved item was not found.')
    return result


def touch(db, user_id, kind, identity):
    # Workspace and study progress can touch the same item concurrently.
    insert = sqlite_insert if db.bind.dialect.name == 'sqlite' else postgres_insert
    stamp = time.time()
    statement = insert(Activity).values(user_id=user_id, kind=kind, resource_id=identity, updated_at=stamp)
    db.execute(statement.on_conflict_do_update(index_elements=['user_id', 'kind', 'resource_id'], set_={'updated_at': stamp}))


class ProfilePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    avatar: Literal['sage', 'mint', 'ocean', 'sunrise'] | None = None
    companion: bool | None = None


def profile_value(db, user):
    row = db.get(UserProfile, user.id)
    return {'id': user.id, 'name': user.name, 'email': user.email,
            'avatar': row.avatar if row else 'sage', 'companion': row.companion if row else True}


@router.get('/profile')
def profile(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return profile_value(db, user)


@router.patch('/profile')
def edit_profile(req: ProfilePatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(UserProfile, user.id)
    if row is None:
        row = UserProfile(user_id=user.id); db.add(row)
    if req.name is not None:
        if not req.name.strip():
            raise HTTPException(422, 'Enter your name.')
        user.name = req.name.strip()
    if req.avatar is not None:
        row.avatar = req.avatar
    if req.companion is not None:
        row.companion = req.companion
    db.commit()
    return profile_value(db, user)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


@router.post('/auth/change-password')
def change_password(req: PasswordChange, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(f'password:{user.id}', 5, 300)
    try:
        hasher.verify(user.password_hash, req.current_password)
    except VerificationError:
        raise HTTPException(401, 'The current password is incorrect.')
    user.password_hash = hasher.hash(req.new_password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.commit()
    response.delete_cookie('asklearn_session', path='/')
    return {'ok': True, 'message': 'Password changed. Sign in again on your devices.'}


class WorkspaceData(BaseModel):
    document_ids: list[int] = Field(default_factory=list, max_length=20)
    tab: Literal['chat', 'summary', 'reviewer', 'flashcards', 'quiz', 'test'] = 'chat'
    chat_id: int | None = None
    study_set_id: int | None = None
    attempt_id: int | None = None


class WorkspaceWrite(BaseModel):
    version: int = Field(ge=0)
    data: WorkspaceData


class ProgressWrite(BaseModel):
    version: int = Field(ge=0)
    data: dict


def envelope(row, default):
    return {'version': row.version if row else 0, 'data': row.data if row else default,
            'updated_at': row.updated_at if row else None}


def write_state(db, model, conditions, keys, version, data):
    try:
        if version == 0:
            if db.scalar(select(model).where(*conditions)):
                raise HTTPException(409, 'Saved progress changed on another device. Load the latest version.')
            row = model(**keys, version=1, data=data, updated_at=time.time())
            db.add(row); db.flush()
        else:
            result = db.execute(update(model).where(*conditions, model.version == version)
                                .values(data=data, version=version + 1, updated_at=time.time()))
            if result.rowcount != 1:
                raise HTTPException(409, 'Saved progress changed on another device. Load the latest version.')
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Saved progress changed on another device. Load the latest version.')
    return envelope(db.scalar(select(model).where(*conditions).execution_options(populate_existing=True)), None)


@router.get('/workspace')
def workspace(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return envelope(db.get(WorkspaceState, user.id), EMPTY_WORKSPACE)


@router.put('/workspace')
def save_workspace(req: WorkspaceWrite, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = req.data
    for identity in data.document_ids:
        owned(db, Document, identity, user)
        touch(db, user.id, 'document', identity)
    for model, identity, kind in [(Chat, data.chat_id, 'chat'), (StudySet, data.study_set_id, 'study'), (Attempt, data.attempt_id, 'attempt')]:
        if identity is not None:
            item = owned(db, model, identity, user)
            if model in (Chat, StudySet) and set(item.document_ids) != set(data.document_ids):
                raise HTTPException(422, 'Saved materials do not match this workspace.')
            if model == StudySet and item.kind != data.tab:
                raise HTTPException(422, 'Saved study tool does not match the selected tab.')
            if model == Attempt and item.study_set_id != data.study_set_id:
                raise HTTPException(422, 'Saved attempt does not match the study tool.')
            touch(db, user.id, kind, identity)
    return write_state(db, WorkspaceState, [WorkspaceState.user_id == user.id], {'user_id': user.id}, req.version, data.model_dump())


@router.get('/study-sets/{identity}/progress')
def study_progress(identity: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned(db, StudySet, identity, user)
    row = db.scalar(select(StudyProgress).where(StudyProgress.user_id == user.id, StudyProgress.study_set_id == identity))
    return envelope(row, None)


class DeckProgress(BaseModel):
    order: list[int] = Field(min_length=1, max_length=40)
    index: int = Field(ge=0, le=40)
    flipped: bool
    known: int = Field(ge=0, le=40)
    again: list[int] = Field(max_length=40)


class AssessmentProgress(BaseModel):
    attempt_id: int
    index: int = Field(ge=0, le=39)


@router.put('/study-sets/{identity}/progress')
def save_progress(identity: int, req: ProgressWrite, user: User = Depends(current_user), db: Session = Depends(get_db)):
    study = owned(db, StudySet, identity, user)
    from pydantic import ValidationError
    try:
        if study.kind == 'flashcards':
            p = DeckProgress.model_validate(req.data)
            count = len(study.content['cards'])
            if (len(set(p.order)) != len(p.order) or any(i < 0 or i >= count for i in p.order) or
                p.index > len(p.order) or p.known > p.index or len(set(p.again)) != len(p.again) or
                not set(p.again).issubset(p.order) or len(p.again) + p.known != p.index):
                raise ValueError('Invalid deck state')
        elif study.kind in ('quiz', 'test'):
            p = AssessmentProgress.model_validate(req.data)
            attempt = owned(db, Attempt, p.attempt_id, user)
            if attempt.study_set_id != identity or p.index >= attempt.total:
                raise ValueError('Invalid assessment position')
        else:
            raise ValueError('This tool does not have interactive progress')
    except (ValidationError, ValueError):
        raise HTTPException(422, 'The saved study position is invalid.')
    touch(db, user.id, 'study', identity)
    return write_state(db, StudyProgress, [StudyProgress.user_id == user.id, StudyProgress.study_set_id == identity],
                       {'user_id': user.id, 'study_set_id': identity}, req.version, p.model_dump())


@router.get('/history')
def history(q: str = Query(default='', max_length=100), type: Literal['all', 'document', 'chat', 'study', 'attempt'] = 'all',
            offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=50),
            user: User = Depends(current_user), db: Session = Depends(get_db)):
    activity = {(r.kind, r.resource_id): r.updated_at for r in db.scalars(select(Activity).where(Activity.user_id == user.id))}
    items = []
    def add(resource_type, row, title, **extra):
        stamp = getattr(row, 'created_at', None) or getattr(row, 'submitted_at', None) or getattr(row, 'started_at', 0)
        items.append({'type': resource_type, 'id': row.id, 'title': title, 'updated_at': max(activity.get((resource_type, row.id), 0), stamp), **extra})
    for row in db.scalars(select(Document).where(Document.user_id == user.id)):
        add('document', row, row.filename, document_ids=[row.id])
    for row in db.scalars(select(Chat).where(Chat.user_id == user.id)):
        add('chat', row, row.title, document_ids=row.document_ids)
    studies = {r.id: r for r in db.scalars(select(StudySet).where(StudySet.user_id == user.id))}
    for row in studies.values():
        add('study', row, row.content.get('title', row.kind.capitalize()), kind=row.kind, document_ids=row.document_ids)
    for row in db.scalars(select(Attempt).where(Attempt.user_id == user.id)):
        study = studies.get(row.study_set_id)
        if study:
            add('attempt', row, 'Practice test' if study.kind == 'test' else 'Quiz', study_set_id=study.id,
                kind=study.kind, document_ids=study.document_ids, score=row.score if row.submitted_at else None,
                total=row.total, submitted=row.submitted_at is not None)
    counts = {kind: sum(i['type'] == kind for i in items) for kind in ('document', 'chat', 'study', 'attempt')}
    counts['completed'] = sum(i.get('submitted', False) for i in items)
    items = [i for i in items if (type == 'all' or i['type'] == type) and q.casefold() in i['title'].casefold()]
    items.sort(key=lambda i: (i['updated_at'], i['type'], i['id']), reverse=True)
    return {'items': items[offset:offset + limit], 'total': len(items), 'counts': counts,
            'next_offset': offset + limit if offset + limit < len(items) else None}


def clear_workspace(db, user_id, document_id=None):
    row = db.get(WorkspaceState, user_id)
    if row and (document_id is None or document_id in row.data.get('document_ids', [])):
        row.data = dict(EMPTY_WORKSPACE); row.version += 1; row.updated_at = time.time()
