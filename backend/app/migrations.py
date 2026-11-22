"""Additive schema migrations: learning progress (1/2), onboarding (3)."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session
from .db import Base, SchemaVersion


def migrate(engine):
    tables = inspect(engine).get_table_names()
    versions = []
    if 'schema_versions' in tables:
        with Session(engine) as db:
            versions = list(db.scalars(select(SchemaVersion.version)))
        if versions and max(versions) > 3:
            raise RuntimeError('Database schema is newer than this application.')
        if 3 in versions:
            return
    if engine.dialect.name == 'sqlite' and engine.url.database and engine.url.database != ':memory:':
        source = Path(engine.url.database).resolve()
        if source.exists() and 'users' in tables:
            folder = source.parent / '.backups'
            folder.mkdir(exist_ok=True)
            name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
            with sqlite3.connect(source) as original, sqlite3.connect(folder / f'before-progress-{name}.db') as backup:
                original.backup(backup)
    Base.metadata.create_all(engine)
    if 'version' not in {c['name'] for c in inspect(engine).get_columns('attempts')}:
        with engine.begin() as connection:
            connection.execute(text('ALTER TABLE attempts ADD COLUMN version INTEGER NOT NULL DEFAULT 0'))
    with Session(engine) as db:
        for version in (1, 2, 3):
            if db.get(SchemaVersion, version) is None:
                db.add(SchemaVersion(version=version))
        db.commit()
