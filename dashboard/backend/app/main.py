"""FastAPI entry point for the Osprey executive analytics dashboard."""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import apply_migrations, is_postgres_reachable
from .routers import events, labels, pipeline, rules, summary, verdicts
from .services.execution_result_service import is_minio_reachable

logging.basicConfig(level=os.environ.get('LOG_LEVEL', 'INFO'))
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title='Osprey Dashboard API',
        version='0.1.0',
        description='Executive analytics dashboard for the Osprey trust & safety pipeline.',
    )

    origins = [o.strip() for o in settings.cors_allow_origins.split(',') if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ['*'],
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    @app.on_event('startup')
    def _startup() -> None:
        try:
            apply_migrations()
        except Exception as e:
            logger.warning('Failed to apply migrations on startup: %s', e)

    @app.get('/health', tags=['meta'])
    def health() -> dict:
        return {
            'status': 'ok',
            'postgres': is_postgres_reachable(),
            'minio': is_minio_reachable(),
        }

    @app.get('/', tags=['meta'])
    def root() -> dict:
        return {'service': 'osprey-dashboard-api', 'docs': '/docs'}

    app.include_router(summary.router)
    app.include_router(events.router)
    app.include_router(rules.router)
    app.include_router(labels.router)
    app.include_router(pipeline.router)
    app.include_router(verdicts.router)
    return app


app = create_app()
