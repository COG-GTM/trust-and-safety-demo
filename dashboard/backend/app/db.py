"""Postgres connection helpers and bootstrap migration runner."""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import psycopg2
import psycopg2.extras

from .config import get_settings

logger = logging.getLogger(__name__)

_MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / 'migrations'


@contextmanager
def get_connection() -> Iterator[Any]:
    """Yield a short-lived psycopg2 connection in autocommit mode."""
    settings = get_settings()
    conn = psycopg2.connect(settings.postgres_dsn)
    conn.autocommit = True
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_dict_cursor() -> Iterator[Any]:
    """Yield a dict cursor for read queries."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur


def apply_migrations() -> None:
    """Execute every .sql file in `migrations/` in lexical order. Idempotent."""
    if not _MIGRATIONS_DIR.exists():
        logger.warning('Migrations directory not found at %s', _MIGRATIONS_DIR)
        return

    sql_files = sorted(_MIGRATIONS_DIR.glob('*.sql'))
    if not sql_files:
        logger.info('No migration SQL files found in %s', _MIGRATIONS_DIR)
        return

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                for sql_file in sql_files:
                    logger.info('Applying migration: %s', sql_file.name)
                    cur.execute(sql_file.read_text())
    except Exception as e:
        logger.warning('Failed to apply migrations: %s', e)


def table_exists(table_name: str) -> bool:
    """Return True if a public-schema table with the given name exists."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = %s
                    )
                    """,
                    (table_name,),
                )
                row = cur.fetchone()
                return bool(row[0]) if row else False
    except Exception as e:
        logger.warning('table_exists(%s) failed: %s', table_name, e)
        return False


def is_postgres_reachable() -> bool:
    """Quick health check used by /health endpoint."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')
                cur.fetchone()
        return True
    except Exception:
        return False


# Allow ad-hoc invocation: `python -m app.db` for manual migration runs.
if __name__ == '__main__':
    logging.basicConfig(level=os.environ.get('LOG_LEVEL', 'INFO'))
    apply_migrations()
