"""GET /api/dashboard/verdicts/breakdown, /effects/summary."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from ..models.schemas import (
    EffectsSummaryResponse,
    EffectSummaryEntry,
    TimeWindow,
    VerdictBreakdownEntry,
    VerdictBreakdownResponse,
)
from ..services import metrics_service

router = APIRouter(prefix='/api/dashboard', tags=['verdicts'])


@router.get('/verdicts/breakdown', response_model=VerdictBreakdownResponse)
def verdicts_breakdown(
    hours: int = Query(default=24, ge=1, le=24 * 30),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> VerdictBreakdownResponse:
    data = metrics_service.get_verdict_breakdown(start=start, end=end, hours=hours)
    return VerdictBreakdownResponse(
        window=TimeWindow(start=data['start'], end=data['end'], bucket='hour'),
        total=data['total'],
        breakdown=[VerdictBreakdownEntry(**row) for row in data['breakdown']],
    )


@router.get('/effects/summary', response_model=EffectsSummaryResponse)
def effects_summary(
    hours: int = Query(default=24, ge=1, le=24 * 30),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> EffectsSummaryResponse:
    data = metrics_service.get_effects_summary(start=start, end=end, hours=hours)
    return EffectsSummaryResponse(
        window=TimeWindow(start=data['start'], end=data['end'], bucket='hour'),
        total=data['total'],
        effects=[EffectSummaryEntry(**row) for row in data['effects']],
    )
