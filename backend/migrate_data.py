"""Copy a local database to an empty managed database; never modify the source."""
import argparse
import json
import os
from pathlib import Path
from sqlalchemy import select, text
from .app.db import Base, make_engine
from .app.migrations import migrate


def transfer(source, target, dry_run=True):
    same_file = (source.dialect.name == target.dialect.name == 'sqlite' and source.url.database and target.url.database and
                 Path(source.url.database).resolve() == Path(target.url.database).resolve())
    if source.url == target.url or same_file:
        raise ValueError('Source and target must be different databases.')
    tables = [t for t in Base.metadata.sorted_tables if t.name not in ('login_sessions', 'schema_versions')]
    # An old SQLite database may not have the new progress tables yet.
    from sqlalchemy import inspect
    inspector = inspect(source)
    available = set(inspector.get_table_names())
    with source.connect() as db:
        data = {}
        for table in tables:
            columns = {c['name'] for c in inspector.get_columns(table.name)} if table.name in available else set()
            rows = [dict(r) for r in db.execute(select(*(c for c in table.c if c.name in columns))).mappings()] if columns else []
            if table.name == 'attempts':
                rows = [{'version': 0, **row} for row in rows]
            data[table.name] = rows
    counts = {name: len(rows) for name, rows in data.items()}
    if dry_run:
        return {'dry_run': True, 'source_counts': counts}
    migrate(target)
    with target.begin() as db:
        current = {t.name: [dict(r) for r in db.execute(select(t)).mappings()] for t in tables}
        if any(current.values()):
            stable = lambda rows: sorted(json.dumps(r, sort_keys=True) for r in rows)
            if all(stable(current[t.name]) == stable(data[t.name]) for t in tables):
                return {'already_migrated': True, 'verified_counts': counts}
            raise ValueError('Target contains different records. No existing records were overwritten.')
        for table in tables:
            if data[table.name]:
                db.execute(table.insert(), data[table.name])
        for table in tables:
            count = len(list(db.execute(select(table)).mappings()))
            if count != counts[table.name]:
                raise ValueError('Verification failed; rolling back the copy.')
        if target.dialect.name == 'postgresql':
            for table in tables:
                if 'id' in table.c:
                    # Table identifiers come only from our declared metadata.
                    db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM {table.name}"))
    return {'verified_counts': counts, 'sessions': 'Not copied; students must sign in again.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    path = Path(args.source).resolve()
    if not path.is_file():
        parser.error('Source SQLite database was not found.')
    destination = os.getenv('MIGRATION_TARGET_URL', '')
    if not destination:
        parser.error('Set MIGRATION_TARGET_URL privately in your environment. Do not pass credentials as arguments.')
    source = target = None
    try:
        source = make_engine(f'sqlite:///{path}')
        target = make_engine(destination)
        print(json.dumps(transfer(source, target, args.dry_run), indent=2))
    except Exception:
        print('Migration did not complete. Check the database connection and confirm the destination is empty or an identical prior copy. Credentials and record contents are not printed.')
        raise SystemExit(1)
    finally:
        if source is not None:
            source.dispose()
        if target is not None:
            target.dispose()


if __name__ == '__main__':
    main()
