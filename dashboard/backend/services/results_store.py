"""Reads stored ``ExecutionResult`` payloads for the per-event drill-down.

The execution result store is selected by the worker via
``OSPREY_EXECUTION_RESULT_STORAGE_BACKEND``. The dashboard supports the same
backends the demo docker-compose ships with (MinIO, Postgres) plus a graceful
``none`` mode that returns ``None`` so the UI can show an empty drill-down.

The MinIO backend mirrors how the worker writes results: one object per
action, JSON encoded, named ``<action_id>.json`` under a configurable bucket.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from sqlalchemy import create_engine, text

from ..config import Settings

logger = logging.getLogger(__name__)


class ResultsStore:
    """Adapter over the configured execution result storage backend."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._minio = None
        self._engine = None

        if settings.results_store_type == 'minio':
            try:
                from minio import Minio  # type: ignore[import-not-found]

                self._minio = Minio(
                    settings.minio_endpoint,
                    access_key=settings.minio_access_key,
                    secret_key=settings.minio_secret_key,
                    secure=settings.minio_secure,
                )
            except Exception as exc:
                logger.warning('Failed to construct MinIO client: %s', exc)
                self._minio = None
        elif settings.results_store_type == 'postgres':
            self._engine = create_engine(settings.postgres_url, pool_pre_ping=True, future=True)

    # ------------------------------------------------------------------

    def get(self, action_id: int) -> Optional[Dict[str, Any]]:
        if self._settings.results_store_type == 'minio' and self._minio is not None:
            return self._get_from_minio(action_id)
        if self._settings.results_store_type == 'postgres' and self._engine is not None:
            return self._get_from_postgres(action_id)
        return None

    # ------------------------------------------------------------------
    # Backend implementations
    # ------------------------------------------------------------------

    def _get_from_minio(self, action_id: int) -> Optional[Dict[str, Any]]:
        assert self._minio is not None
        try:
            obj = self._minio.get_object(self._settings.minio_bucket, f'{action_id}.json')
            try:
                payload = obj.read()
            finally:
                obj.close()
                obj.release_conn()
            return json.loads(payload.decode('utf-8'))
        except Exception as exc:
            logger.info('MinIO get failed for action %s: %s', action_id, exc)
            return None

    def _get_from_postgres(self, action_id: int) -> Optional[Dict[str, Any]]:
        assert self._engine is not None
        try:
            with self._engine.connect() as conn:
                result = conn.execute(
                    text('SELECT payload FROM execution_results WHERE action_id = :aid'),
                    {'aid': action_id},
                )
                row = result.first()
                if not row:
                    return None
                payload = row[0]
                if isinstance(payload, (bytes, bytearray)):
                    return json.loads(payload.decode('utf-8'))
                if isinstance(payload, str):
                    return json.loads(payload)
                if isinstance(payload, dict):
                    return payload
                return None
        except Exception as exc:
            logger.info('Postgres execution_results lookup failed for %s: %s', action_id, exc)
            return None
