"""Flagged-events analytics + per-event drill-down."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..config import Settings, get_settings
from ..models import (
    EventDetail,
    FlaggedEventRow,
    FlaggedEventsResponse,
    TimeSeriesPoint,
    VerdictBreakdownRow,
)
from ._common import event_row_from_druid, normalise_multi_value, parse_iso, resolve_window

router = APIRouter(prefix='/events', tags=['events'])


@router.get('/flagged', response_model=FlaggedEventsResponse)
async def flagged_events(
    request: Request,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    lookback_hours: Optional[int] = Query(default=None, ge=1, le=24 * 30),
    action_name: Optional[str] = None,
    verdict: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=500),
    settings: Settings = Depends(get_settings),
) -> FlaggedEventsResponse:
    druid = request.app.state.druid_client
    start_dt, end_dt = resolve_window(start, end, lookback_hours, settings.default_lookback_hours)

    granularity = 'hour' if (end_dt - start_dt).total_seconds() <= 72 * 3600 else 'day'
    timeseries_rows = await druid.events_timeseries(start_dt, end_dt, granularity=granularity, flagged_only=True)

    by_verdict_raw = await druid.top_n('__verdicts', start_dt, end_dt, threshold=20, flagged_only=True)
    by_action_raw = await druid.top_n('ActionName', start_dt, end_dt, threshold=20, flagged_only=True)
    scan_rows = await druid.scan_recent_flagged(start_dt, end_dt, limit=limit)

    rows: List[FlaggedEventRow] = []
    for raw in scan_rows:
        record = event_row_from_druid(raw)
        if action_name and record['action_name'] != action_name:
            continue
        if verdict and verdict not in record['verdicts']:
            continue
        rows.append(FlaggedEventRow(**record))

    return FlaggedEventsResponse(
        timeseries=[
            TimeSeriesPoint(
                timestamp=parse_iso(row.get('timestamp')) or datetime.now(tz=timezone.utc),
                value=float((row.get('result') or {}).get('count', 0) or 0),
            )
            for row in timeseries_rows
            if parse_iso(row.get('timestamp'))
        ],
        by_verdict=[
            VerdictBreakdownRow(
                verdict=str(row.get('__verdicts') or 'unknown'),
                count=int(row.get('count', 0)),
            )
            for row in by_verdict_raw
            if row.get('__verdicts')
        ],
        by_action_name=[
            {'action_name': row.get('ActionName'), 'count': int(row.get('count', 0))}
            for row in by_action_raw
            if row.get('ActionName')
        ],
        rows=rows,
        total=len(rows),
        next_page_token=None,
    )


@router.get('/{event_id}', response_model=EventDetail)
async def event_detail(event_id: int, request: Request) -> EventDetail:
    store = request.app.state.results_store
    payload: Optional[Dict[str, Any]] = store.get(event_id) if store else None
    if not payload:
        raise HTTPException(
            status_code=404,
            detail=f'Execution result for action {event_id} not found in the configured store.',
        )

    extracted = payload.get('extracted_features') or payload.get('extractedFeatures') or {}
    if not isinstance(extracted, dict):
        extracted = {}

    action = payload.get('action') or {}
    if not isinstance(action, dict):
        action = {}

    error_infos = payload.get('error_infos') or payload.get('errors') or []
    if not isinstance(error_infos, list):
        error_infos = []

    label_mutations = payload.get('label_mutations') or payload.get('label_effects') or []
    if not isinstance(label_mutations, list):
        label_mutations = []

    timestamp = (
        parse_iso(action.get('timestamp')) or parse_iso(payload.get('timestamp')) or datetime.now(tz=timezone.utc)
    )

    verdicts_raw = payload.get('verdicts') or extracted.get('__verdicts') or []
    if not isinstance(verdicts_raw, list):
        verdicts_raw = normalise_multi_value(verdicts_raw)

    rules_raw = payload.get('rules_fired') or extracted.get('__rules_fired') or []
    if not isinstance(rules_raw, list):
        rules_raw = normalise_multi_value(rules_raw)

    return EventDetail(
        action_id=int(action.get('action_id') or payload.get('action_id') or event_id),
        action_name=str(action.get('action_name') or payload.get('action_name') or 'unknown'),
        timestamp=timestamp,
        sample_rate=int(payload.get('sample_rate', 0) or 0),
        extracted_features=extracted,
        verdicts=[str(v) for v in verdicts_raw],
        rules_triggered=[str(r) for r in rules_raw],
        label_mutations=label_mutations,
        error_infos=error_infos,
        raw=payload,
    )
