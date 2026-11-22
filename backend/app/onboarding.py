"""Small account-owned walkthrough preferences, independent of learning records."""
import time
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import case, select
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from .auth import current_user
from .db import OnboardingProgress, User, get_db

router = APIRouter(prefix='/api')
SECTIONS = ('dashboard', 'library', 'workspace')


class GuideWrite(BaseModel):
    section: Literal['dashboard', 'library', 'workspace']
    guide_version: Literal[1] = 1
    step: int = Field(ge=0, le=3)
    status: Literal['in_progress', 'completed', 'skipped']


def progress_value(db, user):
    result = {name: {'guide_version': 1, 'step': 0, 'status': 'not_started'} for name in SECTIONS}
    for row in db.scalars(select(OnboardingProgress).where(OnboardingProgress.user_id == user.id)):
        result[row.section] = {'guide_version': row.guide_version, 'step': row.step, 'status': row.status}
    return result


@router.get('/onboarding')
def get_progress(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return progress_value(db, user)


@router.patch('/onboarding')
def save_progress(req: GuideWrite, user: User = Depends(current_user), db: Session = Depends(get_db)):
    insert = sqlite_insert if db.bind.dialect.name == 'sqlite' else postgres_insert
    values = {**req.model_dump(), 'user_id': user.id, 'updated_at': time.time()}
    statement = insert(OnboardingProgress).values(**values)
    terminal = OnboardingProgress.status.in_(('completed', 'skipped'))
    # A delayed step write must not reopen a completed/dismissed walkthrough.
    db.execute(statement.on_conflict_do_update(index_elements=['user_id', 'section'], set_={
        key: case((terminal, getattr(OnboardingProgress, key)), else_=value)
        for key, value in values.items() if key not in ('user_id', 'section')
    }))
    db.commit()
    return progress_value(db, user)
