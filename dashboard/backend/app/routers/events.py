"""GET /api/dashboard/events/timeline, /events/recent, /events/{action_id}."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import (
    EventDetailResponse,
    FlaggedEventsResponse,
    FlaggedEventSummary,
    TimelinePoint,
    TimelineResponse,
    TimeWindow,
)
from ..services import execution_result_service, metrics_service

router = APIRouter(prefix='/api/dashboard', tags=['events'])


@router.get('/events/timeline', response_model=TimelineResponse)
def timeline(
    hours: int = Query(default=24, ge=1, le=24 * 30),
    bucket: str = Query(default='hour', pattern='^(minute|hour|day)$'),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> TimelineResponse:
    data = metrics_service.get_timeline(start=start, end=end, hours=hours, bucket=bucket)
    return TimelineResponse(
        window=TimeWindow(start=data['start'], end=data['end'], bucket=data['bucket']),
        points=[TimelinePoint(**p) for p in data['points']],
    )


@router.get('/events/recent', response_model=FlaggedEventsResponse)
def recent_events(
    hours: int = Query(default=24, ge=1, le=24 * 30),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    action_name: Optional[str] = None,
    verdict: Optional[str] = None,
    rule: Optional[str] = None,
    effect: Optional[str] = None,
    flagged_only: bool = True,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> FlaggedEventsResponse:
    data = metrics_service.list_flagged_events(
        start=start,
        end=end,
        hours=hours,
        page=page,
        page_size=page_size,
        action_name=action_name,
        verdict=verdict,
        rule=rule,
        effect=effect,
        flagged_only=flagged_only,
    )
    return FlaggedEventsResponse(
        window=TimeWindow(start=data['start'], end=data['end'], bucket='hour'),
        page=data['page'],
        page_size=data['page_size'],
        total=data['total'],
        events=[FlaggedEventSummary(**e) for e in data['events']],
    )


@router.get('/events/{action_id}', response_model=EventDetailResponse)
def event_detail(action_id: int) -> EventDetailResponse:
    metrics_row = metrics_service.get_event_metrics(action_id)
    minio_row = execution_result_service.fetch_execution_result(action_id)
    if metrics_row is None and minio_row is None:
        raise HTTPException(status_code=404, detail=f'No event found for action_id={action_id}')

    extracted_features = (minio_row or {}).get('extracted_features') or {}
    error_traces = (minio_row or {}).get('error_traces') or []
    action_data = (minio_row or {}).get('action_data')

    timestamp = (metrics_row or {}).get('timestamp') or (minio_row or {}).get('timestamp')
    return EventDetailResponse(
        action_id=action_id,
        action_name=(metrics_row or {}).get('action_name'),
        timestamp=timestamp,
        verdict=(metrics_row or {}).get('verdict'),
        matched_rules=(metrics_row or {}).get('matched_rules') or [],
        effects=(metrics_row or {}).get('effects') or [],
        extracted_features=extracted_features if isinstance(extracted_features, dict) else {},
        error_traces=error_traces if isinstance(error_traces, list) else [],
        action_data=action_data if isinstance(action_data, dict) else None,
        execution_duration_ms=(metrics_row or {}).get('execution_duration_ms'),
        sample_rate=(metrics_row or {}).get('sample_rate'),
    )
