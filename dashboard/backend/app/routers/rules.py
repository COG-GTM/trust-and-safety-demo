"""GET /api/dashboard/rules/stats — per-rule match counts and rates."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from ..models.schemas import RulesResponse, RuleStat, TimeWindow
from ..services import metrics_service

router = APIRouter(prefix='/api/dashboard', tags=['rules'])


@router.get('/rules/stats', response_model=RulesResponse)
def rules_stats(
    hours: int = Query(default=24, ge=1, le=24 * 30),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> RulesResponse:
    data = metrics_service.get_rule_stats(start=start, end=end, hours=hours)
    return RulesResponse(
        window=TimeWindow(start=data['start'], end=data['end'], bucket='hour'),
        total_events=data['total_events'],
        rules=[RuleStat(**r) for r in data['rules']],
    )
