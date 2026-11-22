import time
from sqlalchemy import create_engine, ForeignKey, String, Text, JSON, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)


class LoginSession(Base):
    __tablename__ = 'login_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    csrf: Mapped[str] = mapped_column(String(64))
    expires: Mapped[float]


class Document(Base):
    __tablename__ = 'documents'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(12))
    pages: Mapped[int]
    char_count: Mapped[int]
    created_at: Mapped[float] = mapped_column(default=time.time)


class Chunk(Base):
    __tablename__ = 'chunks'
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey('documents.id'), index=True)
    page: Mapped[int]
    text: Mapped[str] = mapped_column(Text)


class Chat(Base):
    __tablename__ = 'chat_sessions'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    title: Mapped[str] = mapped_column(String(120))
    document_ids: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[float] = mapped_column(default=time.time)


class Message(Base):
    __tablename__ = 'messages'
    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey('chat_sessions.id'), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default='complete')


class StudySet(Base):
    __tablename__ = 'study_sets'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    document_ids: Mapped[list] = mapped_column(JSON)
    kind: Mapped[str] = mapped_column(String(20))
    content: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[float] = mapped_column(default=time.time)


class Attempt(Base):
    __tablename__ = 'attempts'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    study_set_id: Mapped[int] = mapped_column(ForeignKey('study_sets.id'), index=True)
    started_at: Mapped[float] = mapped_column(default=time.time)
    deadline: Mapped[float]
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    submitted_at: Mapped[float | None] = mapped_column(default=None)
    score: Mapped[int] = mapped_column(default=0)
    total: Mapped[int]
    version: Mapped[int] = mapped_column(default=0, server_default='0')


class UserProfile(Base):
    __tablename__ = 'user_profiles'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    avatar: Mapped[str] = mapped_column(String(20), default='sage')
    companion: Mapped[bool] = mapped_column(default=True)


class OnboardingProgress(Base):
    __tablename__ = 'onboarding_progress'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    section: Mapped[str] = mapped_column(String(16), primary_key=True)
    guide_version: Mapped[int] = mapped_column(default=1)
    step: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(20), default='in_progress')
    updated_at: Mapped[float] = mapped_column(default=time.time)


class WorkspaceState(Base):
    __tablename__ = 'workspace_states'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    version: Mapped[int] = mapped_column(default=1)
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[float] = mapped_column(default=time.time)


class StudyProgress(Base):
    __tablename__ = 'study_progress'
    __table_args__ = (UniqueConstraint('user_id', 'study_set_id'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    study_set_id: Mapped[int] = mapped_column(ForeignKey('study_sets.id'), index=True)
    version: Mapped[int] = mapped_column(default=1)
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[float] = mapped_column(default=time.time)


class Activity(Base):
    __tablename__ = 'activity'
    __table_args__ = (UniqueConstraint('user_id', 'kind', 'resource_id'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    resource_id: Mapped[int]
    updated_at: Mapped[float] = mapped_column(default=time.time)


class SchemaVersion(Base):
    __tablename__ = 'schema_versions'
    version: Mapped[int] = mapped_column(primary_key=True)
    applied_at: Mapped[float] = mapped_column(default=time.time)


def make_engine(url):
    if url.startswith(('postgres://', 'postgresql://')):
        url = 'postgresql+psycopg://' + url.split('://', 1)[1]
    options = {'connect_args': {'check_same_thread': False}} if url.startswith('sqlite:') else {'pool_pre_ping': True, 'pool_recycle': 300}
    return create_engine(url, **options)


engine = make_engine(DATABASE_URL)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        yield db
