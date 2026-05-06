"""Centralized configuration loaded from environment variables.

The dashboard backend talks to:
  - Postgres (dashboard_event_metrics + entity_labels)
  - MinIO (full ExecutionResult objects keyed by snowflake)
  - Druid (optional time-series aggregations on extracted features)
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_postgres_dsn() -> str:
    """Resolve a Postgres DSN from either DATABASE_URL or POSTGRES_HOSTS json."""
    direct = os.environ.get('DATABASE_URL')
    if direct:
        return direct

    hosts = os.environ.get('POSTGRES_HOSTS')
    if hosts:
        try:
            parsed = json.loads(hosts)
            dsn = parsed.get('osprey_db')
            if dsn:
                return str(dsn)
        except (json.JSONDecodeError, TypeError):
            pass

    host = os.environ.get('DASHBOARD_DB_HOST', 'postgres')
    port = os.environ.get('DASHBOARD_DB_PORT', '5432')
    user = os.environ.get('DASHBOARD_DB_USER', 'osprey')
    password = os.environ.get('DASHBOARD_DB_PASSWORD', 'FoolishPassword')
    database = os.environ.get('DASHBOARD_DB_NAME', 'osprey')
    return f'postgresql://{user}:{password}@{host}:{port}/{database}'


class Settings(BaseSettings):
    """Backend configuration; reads from process env (not .env files in container)."""

    model_config = SettingsConfigDict(env_file=None, extra='ignore')

    postgres_dsn: str = Field(default_factory=_default_postgres_dsn)

    minio_endpoint: str = Field(default='minio:9000', alias='OSPREY_MINIO_ENDPOINT')
    minio_access_key: str = Field(default='minioadmin', alias='OSPREY_MINIO_ACCESS_KEY')
    minio_secret_key: str = Field(default='minioadmin123', alias='OSPREY_MINIO_SECRET_KEY')
    minio_secure: bool = Field(default=False, alias='OSPREY_MINIO_SECURE')
    minio_bucket: str = Field(default='execution-output', alias='OSPREY_MINIO_EXECUTION_RESULTS_BUCKET')

    druid_url: Optional[str] = Field(default=None, alias='DRUID_URL')

    cors_allow_origins: str = Field(default='*', alias='DASHBOARD_CORS_ALLOW_ORIGINS')


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
