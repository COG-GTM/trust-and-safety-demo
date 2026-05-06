"""Runtime configuration for the executive analytics dashboard backend.

Configuration is sourced from environment variables (with sensible defaults that
match the docker-compose stack in this repo). Variables are namespaced with the
``DASHBOARD_`` prefix so they cannot collide with the worker / UI API
environment.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List, Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ResultsStoreType = Literal['minio', 'postgres', 'bigtable', 'gcs', 'none']


class Settings(BaseSettings):
    """Dashboard backend settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix='DASHBOARD_',
        env_file=('.env', '.env.local'),
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False,
    )

    # --- Druid -------------------------------------------------------------
    druid_url: str = Field(
        default='http://druid-broker:8082',
        description='Druid broker base URL (no trailing slash).',
    )
    druid_datasource: str = Field(
        default='osprey.execution_results',
        description='Druid datasource name fed by the KafkaOutputSink.',
    )
    druid_query_timeout_ms: int = Field(default=30_000)

    # --- Postgres (labels + pipeline_metrics) ------------------------------
    postgres_url: str = Field(
        default='postgresql://osprey:FoolishPassword@postgres:5432/osprey',
        description='SQLAlchemy URL for the same Postgres used by the labels service.',
    )

    # --- Execution results store ------------------------------------------
    results_store_type: ResultsStoreType = Field(default='minio')
    minio_endpoint: str = Field(default='minio:9000')
    minio_access_key: str = Field(default='minioadmin')
    minio_secret_key: str = Field(default='minioadmin123')
    minio_bucket: str = Field(default='execution-output')
    minio_secure: bool = Field(default=False)

    # --- Dashboard behaviour ----------------------------------------------
    refresh_interval_seconds: int = Field(default=30)
    default_lookback_hours: int = Field(default=24)
    cors_allow_origins: List[str] = Field(default_factory=lambda: ['*'])
    api_prefix: str = Field(default='/api')


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance."""
    return Settings()
