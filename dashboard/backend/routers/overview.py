"""Executive summary endpoint."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Request

from ..config import Settings, get_settings
from ..models import OverviewResponse, TimeSeriesPoint, TopRuleRow, VerdictBreakdownRow
from ._common import normalise_multi_value, parse_iso

router = APIRouter(prefix='/overview', tags=['overview'])


def _get_druid(request: Request):
    return request.app.state.druid_client


@router.get('', response_model=OverviewResponse)
async def overview(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> OverviewResponse:
    druid = _get_druid(request)
    now = datetime.now(tz=timezone.utc)

    windows: List[Dict[str, Any]] = []
    for label, hours in (('24h', 24), ('7d', 7 * 24), ('30d', 30 * 24)):
        start = now - timedelta(hours=hours)
        total = await druid.total_event_count(start, now)
        flagged = await druid.flagged_event_count(start, now)
        errors = await druid.error_event_count(start, now)
        windows.append(
            {
                'label': label,
                'total_events': total,
                'flagged_events': flagged,
                'flag_rate': (flagged / total) if total else 0.0,
                'error_count': errors,
                'error_rate': (errors / total) if total else 0.0,
            }
        )

    lookback = max(settings.default_lookback_hours, 1)
    start = now - timedelta(hours=lookback)
    granularity = 'hour' if lookback <= 72 else 'day'

    events_ts = await druid.events_timeseries(start, now, granularity=granularity)
    flagged_ts = await druid.events_timeseries(start, now, granularity=granularity, flagged_only=True)
    top_rules_raw = await druid.top_n('__rules_fired', start, now, threshold=10, flagged_only=True)
    verdict_breakdown_raw = await druid.top_n('__verdicts', start, now, threshold=10, flagged_only=True)

    return OverviewResponse(
        generated_at=now,
        windows=windows,  # type: ignore[arg-type]
        top_rules=[
            TopRuleRow(
                rule_name=str(row.get('__rules_fired') or 'unknown'),
                trigger_count=int(row.get('count', 0)),
            )
            for row in top_rules_raw
            if row.get('__rules_fired')
        ],
        verdict_breakdown=[
            VerdictBreakdownRow(
                verdict=str(row.get('__verdicts') or 'unknown'),
                count=int(row.get('count', 0)),
            )
            for row in verdict_breakdown_raw
            if row.get('__verdicts')
        ],
        events_timeseries=_to_points(events_ts),
        flagged_events_timeseries=_to_points(flagged_ts),
    )


def _to_points(rows: List[Dict[str, Any]]) -> List[TimeSeriesPoint]:
    points: List[TimeSeriesPoint] = []
    for row in rows:
        ts = parse_iso(row.get('timestamp'))
        if ts is None:
            continue
        result = row.get('result') or {}
        # Some result blobs use multi-value dimensions, but timeseries always returns scalar count.
        normalise_multi_value(None)  # keep import alive for type-safety
        points.append(TimeSeriesPoint(timestamp=ts, value=float(result.get('count', 0) or 0)))
    return points
