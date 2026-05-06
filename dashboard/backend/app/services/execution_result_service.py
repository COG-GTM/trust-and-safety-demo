"""Reads full ExecutionResult records from MinIO.

Mirrors the encoding used by ``StoredExecutionResultMinIO`` in
``osprey_worker/src/osprey/worker/lib/storage/stored_execution_result.py``:
each result is a JSON document at key ``<key_prefix>:<action_id>.json``,
where ``key_prefix`` is the snowflake timestamp prefix.

We replicate the snowflake key-prefix logic locally rather than importing
the worker package, so the dashboard backend stays decoupled from the
worker's heavy dependency tree.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, Optional

from minio import Minio
from minio.error import S3Error

from ..config import get_settings

logger = logging.getLogger(__name__)


# Mirrors osprey.worker.lib.snowflake.Snowflake.to_key_prefix logic.
# The snowflake encodes: 41 bits ms timestamp | 10 bits worker | 12 bits sequence.
# The key prefix is the high byte of the snowflake to spread keys evenly.
def _snowflake_key_prefix(action_id: int) -> str:
    high_byte = (action_id >> 56) & 0xFF
    return f'{high_byte:02x}'


def _encode_action_id(action_id: int) -> str:
    return f'{_snowflake_key_prefix(action_id)}:{action_id}.json'


@lru_cache(maxsize=1)
def _get_minio_client() -> Minio:
    settings = get_settings()
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def fetch_execution_result(action_id: int) -> Optional[Dict[str, Any]]:
    """Return the raw ExecutionResult JSON (parsed) for the given action_id, or None."""
    settings = get_settings()
    client = _get_minio_client()
    object_name = _encode_action_id(action_id)
    try:
        response = client.get_object(settings.minio_bucket, object_name)
        try:
            raw = response.read()
        finally:
            response.close()
            response.release_conn()
        return _parse_execution_result(raw)
    except S3Error as e:
        if e.code == 'NoSuchKey':
            return None
        logger.warning('MinIO error fetching action_id=%s: %s', action_id, e)
        return None
    except Exception as e:
        logger.warning('Unexpected error fetching action_id=%s from MinIO: %s', action_id, e)
        return None


def _parse_execution_result(raw: bytes) -> Dict[str, Any]:
    data = json.loads(raw.decode('utf-8'))
    extracted_features = _maybe_load_json(data.get('extracted_features'))
    error_traces = _maybe_load_json(data.get('error_traces'))
    action_data = _maybe_load_json(data.get('action_data'))

    timestamp_raw = data.get('timestamp')
    timestamp: Optional[datetime] = None
    if isinstance(timestamp_raw, str):
        try:
            timestamp = datetime.fromisoformat(timestamp_raw)
        except ValueError:
            timestamp = None

    return {
        'id': data.get('id'),
        'extracted_features': extracted_features or {},
        'error_traces': error_traces or [],
        'timestamp': timestamp,
        'action_data': action_data,
    }


def _maybe_load_json(value: Any) -> Any:
    """The MinIO payload stores nested JSON as JSON-encoded strings; flatten them safely."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return value
    return value


def is_minio_reachable() -> bool:
    """Used by /health; returns True if we can list (or simply ping) the bucket."""
    settings = get_settings()
    try:
        return _get_minio_client().bucket_exists(settings.minio_bucket)
    except Exception:
        return False
