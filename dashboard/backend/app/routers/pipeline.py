"""GET /api/dashboard/pipeline/health, /errors."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from ..models.schemas import (
    ErrorEntry,
    ErrorsResponse,
    PipelineHealthResponse,
    TimeWindow,
)
from ..services import execution_result_service, metrics_service

router = APIRouter(prefix='/api/dashboard', tags=['pipeline'])


@router.get('/pipeline/health', response_model=PipelineHealthResponse)
def pipeline_health(
    hours: int = Query(default=1, ge=1, le=24 * 7),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> PipelineHealthResponse:
    data = metrics_service.get_pipeline_health(start=start, end=end, hours=hours)
    return PipelineHealthResponse(
        window=TimeWindow(start=data['start'], end=data['end'], bucket='minute'),
        throughput_per_sec=data['throughput_per_sec'],
        p50_latency_ms=data['p50_latency_ms'],
        p95_latency_ms=data['p95_latency_ms'],
        p99_latency_ms=data['p99_latency_ms'],
        drop_rate=data['drop_rate'],
        error_rate=data['error_rate'],
        consumer_lag=None,
    )


@router.get('/errors', response_model=ErrorsResponse)
def recent_errors(
    limit: int = Query(default=50, ge=1, le=500),
) -> ErrorsResponse:
    rows = metrics_service.get_recent_errors(limit=limit)
    enriched = []
    for row in rows:
        traceback_text = None
        rules_source_location = None
        # Best-effort enrichment from MinIO; small N=limit so this is OK.
        full = execution_result_service.fetch_execution_result(row['action_id'])
        if full and isinstance(full.get('error_traces'), list) and full['error_traces']:
            first = full['error_traces'][0]
            if isinstance(first, dict):
                traceback_text = first.get('traceback')
                rules_source_location = first.get('rules_source_location')
        enriched.append(
            ErrorEntry(
                action_id=row['action_id'],
                action_name=row['action_name'],
                timestamp=row['timestamp'],
                rules_source_location=rules_source_location,
                traceback=traceback_text,
            )
        )
    return ErrorsResponse(errors=enriched)
