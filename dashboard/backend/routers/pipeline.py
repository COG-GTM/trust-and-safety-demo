"""Pipeline-health endpoint — throughput, latency, drop / error rates."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from ..config import Settings, get_settings
from ..models import PipelineHealthResponse, PipelineLatencyPoint, TimeSeriesPoint
from ._common import resolve_window

router = APIRouter(prefix='/pipeline', tags=['pipeline'])


@router.get('/health', response_model=PipelineHealthResponse)
async def pipeline_health(
    request: Request,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    lookback_hours: Optional[int] = Query(default=None, ge=1, le=24 * 30),
    settings: Settings = Depends(get_settings),
) -> PipelineHealthResponse:
    metrics = request.app.state.metrics_aggregator
    start_dt, end_dt = resolve_window(start, end, lookback_hours, settings.default_lookback_hours)

    if not metrics:
        return _empty(start_dt)

    summary, latency, throughput, errors = metrics.health_summary(start_dt, end_dt)
    recent_errors = metrics.recent_errors(limit=20)

    return PipelineHealthResponse(
        throughput_eps=summary['throughput_eps'],
        drop_rate=summary['drop_rate'],
        error_rate=summary['error_rate'],
        avg_latency_ms=summary['avg_latency_ms'],
        latency=[
            PipelineLatencyPoint(
                timestamp=row['timestamp'],
                p50_ms=row['p50_ms'],
                p95_ms=row['p95_ms'],
                p99_ms=row['p99_ms'],
            )
            for row in latency
        ],
        throughput_timeseries=[TimeSeriesPoint(timestamp=row['timestamp'], value=row['value']) for row in throughput],
        error_timeseries=[TimeSeriesPoint(timestamp=row['timestamp'], value=row['value']) for row in errors],
        recent_errors=recent_errors,
        input_streams=[
            {
                'name': 'osprey.actions_input (Kafka)',
                'connected': True,
                'lag': None,
            }
        ],
    )


def _empty(start_dt: datetime) -> PipelineHealthResponse:
    return PipelineHealthResponse(
        throughput_eps=0.0,
        drop_rate=0.0,
        error_rate=0.0,
        avg_latency_ms=None,
        latency=[],
        throughput_timeseries=[],
        error_timeseries=[],
        recent_errors=[],
        input_streams=[],
    )
