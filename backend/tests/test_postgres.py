import os
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select
from backend.app.db import Base, User, Document, StudySet, Attempt, StudyProgress, make_engine
from backend.migrate_data import transfer


@pytest.mark.skipif(not os.getenv('TEST_POSTGRES_URL'), reason='An isolated TEST_POSTGRES_URL is required for live Postgres integration.')
def test_postgres_transfer_json_progress_and_id_sequences():
    target = make_engine(os.environ['TEST_POSTGRES_URL'])
    assert target.url.database == 'asklearn_test', 'Only the dedicated disposable test database is accepted.'
    source = make_engine('sqlite://')
    Base.metadata.create_all(source)
    with Session(source) as db:
        db.add(User(id=7, name='Migration fixture', email='fixture@example.com', password_hash='fixture-hash')); db.flush()
        db.add(Document(id=11, user_id=7, filename='Fixture.txt', file_type='txt', pages=1, char_count=100)); db.flush()
        db.add(StudySet(id=13, user_id=7, document_ids=[11], kind='flashcards', content={'cards': [{'front': 'Question', 'back': 'Answer'}]})); db.flush()
        db.add(StudyProgress(user_id=7, study_set_id=13, data={'order': [0], 'index': 0, 'flipped': False, 'known': 0, 'again': []})); db.commit()
    try:
        assert transfer(source, target, False)['verified_counts']['users'] == 1
        assert transfer(source, target, False)['already_migrated']
        with Session(target) as db:
            assert db.scalar(select(StudyProgress)).data['order'] == [0]
            user = User(name='Next fixture', email='next@example.com', password_hash='fixture')
            db.add(user); db.commit(); assert user.id == 8
    finally:
        source.dispose(); target.dispose()
