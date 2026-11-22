from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from backend.app.db import Base, User


def test_sqlite_survives_engine_restart(tmp_path):
    url = f'sqlite:///{tmp_path / "persistent.db"}'
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(User(name='Saved student', email='saved@example.com', password_hash='test-fixture'))
        db.commit()
    engine.dispose()
    restarted = create_engine(url)
    with Session(restarted) as db:
        assert db.scalar(select(User)).name == 'Saved student'
    restarted.dispose()
