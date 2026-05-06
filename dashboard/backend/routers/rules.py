"""Rule execution analytics."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, Request

from ..config import Settings, get_settings
from ..models import RuleMetricRow, RuleMetricsResponse
from ._common import resolve_window

router = APIRouter(prefix='/rules', tags=['rules'])


@router.get('/metrics', response_model=RuleMetricsResponse)
async def rule_metrics(
    request: Request,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    lookback_hours: Optional[int] = Query(default=None, ge=1, le=24 * 30),
    settings: Settings = Depends(get_settings),
) -> RuleMetricsResponse:
    metrics = request.app.state.metrics_aggregator
    druid = request.app.state.druid_client
    start_dt, end_dt = resolve_window(start, end, lookback_hours, settings.default_lookback_hours)

    metric_rows = metrics.rule_metrics(start_dt, end_dt) if metrics else []

    rows: List[RuleMetricRow] = [
        RuleMetricRow(
            rule_name=row['rule_name'],
            trigger_count=row['trigger_count'],
            trigger_rate_per_hour=row['trigger_rate_per_hour'],
            avg_execution_time_ms=row.get('avg_execution_time_ms'),
            last_triggered=row.get('last_triggered'),
        )
        for row in metric_rows
    ]

    # If no pipeline_metrics rows were available (sink not enabled), fall
    # back to the top_n on the Druid datasource so the page still has data.
    if not rows:
        druid_top = await druid.top_n('__rules_fired', start_dt, end_dt, threshold=50, flagged_only=True)
        elapsed_hours = max((end_dt - start_dt).total_seconds() / 3600.0, 1 / 60.0)
        for entry in druid_top:
            rule_name = entry.get('__rules_fired')
            if not rule_name:
                continue
            count = int(entry.get('count', 0))
            rows.append(
                RuleMetricRow(
                    rule_name=str(rule_name),
                    trigger_count=count,
                    trigger_rate_per_hour=count / elapsed_hours,
                    avg_execution_time_ms=None,
                    last_triggered=None,
                )
            )

    rule_action_heatmap: List[Dict[str, Any]] = []
    for row in metric_rows:
        breakdown = row.get('action_breakdown') or {}
        for action_name, count in breakdown.items():
            rule_action_heatmap.append(
                {
                    'rule_name': row['rule_name'],
                    'action_name': action_name,
                    'count': count,
                }
            )

    return RuleMetricsResponse(
        rows=rows,
        inactive_rules=[],
        rule_action_heatmap=rule_action_heatmap,
    )
