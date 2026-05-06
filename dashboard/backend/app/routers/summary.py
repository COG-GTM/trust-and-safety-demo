"""GET /api/dashboard/summary — high-level KPIs over a configurable window."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from ..models.schemas import SummaryResponse, TimeWindow
from ..services import metrics_service

router = APIRouter(prefix='/api/dashboard', tags=['summary'])


@router.get('/summary', response_model=SummaryResponse)
def summary(
    hours: int = Query(default=24, ge=1, le=24 * 30),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> SummaryResponse:
    data = metrics_service.get_summary(start=start, end=end, hours=hours)
    total = data['total_events']
    flagged = data['total_flagged']
    error_count = data['error_count']
    flag_rate = (flagged / total) if total else 0.0
    error_rate = (error_count / total) if total else 0.0
    return SummaryResponse(
        window=TimeWindow(start=data['start'], end=data['end'], bucket='hour'),
        total_events=total,
        total_flagged=flagged,
        total_dropped=data['total_dropped'],
        flag_rate=flag_rate,
        error_rate=error_rate,
        avg_latency_ms=data['avg_latency_ms'],
        p95_latency_ms=data['p95_latency_ms'],
    )
