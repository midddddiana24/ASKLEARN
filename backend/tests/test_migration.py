import sqlite3
import pytest
from sqlalchemy import create_engine, text, select
from backend.app.migrations import migrate
from backend.app.db import User, SchemaVersion
from backend.migrate_data import transfer


def test_version_two_upgrade_adds_onboarding_without_changing_users(tmp_path):
    engine = create_engine(f'sqlite:///{tmp_path / "version-two.db"}')
    migrate(engine)
    with engine.begin() as db:
        db.execute(text("INSERT INTO users (id, name, email, password_hash) VALUES (9, 'Returning student', 'return@example.com', 'original')"))
        db.execute(text('DELETE FROM schema_versions WHERE version = 3'))
        db.execute(text('DROP TABLE onboarding_progress'))
    migrate(engine)
    migrate(engine)
    with engine.connect() as db:
        assert db.execute(text('SELECT name FROM users WHERE id=9')).scalar() == 'Returning student'
        assert db.execute(text('SELECT count(*) FROM onboarding_progress')).scalar() == 0
        assert db.execute(text('SELECT max(version) FROM schema_versions')).scalar() == 3
    assert len(list((tmp_path / '.backups').glob('*.db'))) == 1
    engine.dispose()


def test_legacy_upgrade_backup_and_repeatable_copy(tmp_path):
    path = tmp_path / 'legacy.db'
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(80), email VARCHAR(254) UNIQUE, password_hash TEXT)')
        db.execute("INSERT INTO users VALUES (7, 'Original student', 'original@example.com', 'original-hash')")
    source = create_engine(f'sqlite:///{path}')
    with pytest.raises(ValueError, match='different databases'):
        transfer(source, source, False)
    migrate(source); migrate(source)
    backups = list((tmp_path / '.backups').glob('*.db'))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as db:
        assert db.execute('SELECT password_hash FROM users').fetchone()[0] == 'original-hash'
    with source.connect() as db:
        assert db.execute(select(User.password_hash)).scalar() == 'original-hash'
        assert db.execute(select(SchemaVersion.version)).all()
    target = create_engine(f'sqlite:///{tmp_path / "managed.db"}')
    assert transfer(source, target)['source_counts']['users'] == 1
    assert transfer(source, target, False)['verified_counts']['users'] == 1
    assert transfer(source, target, False)['already_migrated']
    with target.begin() as db:
        db.execute(text("UPDATE users SET name='Changed remotely'"))
    with pytest.raises(ValueError, match='different records'):
        transfer(source, target, False)
    source.dispose(); target.dispose()
