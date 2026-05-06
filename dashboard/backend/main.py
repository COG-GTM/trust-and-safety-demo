"""FastAPI app entry point for the Osprey executive dashboard."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import events, labels, overview, pipeline, rules
from .services.druid_client import DruidClient
from .services.labels_db import LabelsDB
from .services.metrics_agg import MetricsAggregator
from .services.results_store import ResultsStore

logger = logging.getLogger('osprey.dashboard')


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.settings = settings
    app.state.druid_client = DruidClient(settings)
    app.state.labels_db = LabelsDB(settings)
    app.state.metrics_aggregator = MetricsAggregator(settings)
    app.state.results_store = ResultsStore(settings)
    logger.info(
        'Dashboard backend ready (druid=%s, datasource=%s, results_store=%s)',
        settings.druid_url,
        settings.druid_datasource,
        settings.results_store_type,
    )
    try:
        yield
    finally:
        await app.state.druid_client.aclose()
        app.state.labels_db.dispose()
        app.state.metrics_aggregator.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title='Osprey Executive Analytics Dashboard',
        version='0.1.0',
        description=(
            'Backend API for the Osprey trust-and-safety executive dashboard. '
            'Aggregates flagged events, rule execution metrics, label analytics, '
            'and pipeline health across the existing Osprey output sinks.'
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_methods=['GET', 'POST'],
        allow_headers=['*'],
        allow_credentials=False,
    )

    api = settings.api_prefix

    @app.get(f'{api}/health', tags=['health'])
    async def health() -> dict:
        metrics = app.state.metrics_aggregator
        backend_health = metrics.healthcheck() if metrics else {}
        return {
            'status': 'ok',
            'service': 'osprey-dashboard-backend',
            'time': datetime.now(tz=timezone.utc),
            **backend_health,
        }

    app.include_router(overview.router, prefix=api)
    app.include_router(events.router, prefix=api)
    app.include_router(rules.router, prefix=api)
    app.include_router(labels.router, prefix=api)
    app.include_router(pipeline.router, prefix=api)

    return app


app = create_app()
