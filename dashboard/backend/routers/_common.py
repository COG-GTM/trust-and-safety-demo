"""Helpers shared across routers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException


def resolve_window(
    start: Optional[datetime],
    end: Optional[datetime],
    lookback_hours: Optional[int],
    default_hours: int,
) -> tuple[datetime, datetime]:
    """Normalise a time-range query into a concrete (start, end) tuple."""
    if start and end:
        if start >= end:
            raise HTTPException(status_code=400, detail='start must be < end')
        return _utc(start), _utc(end)
    hours = lookback_hours or default_hours
    end_dt = datetime.now(tz=timezone.utc)
    start_dt = end_dt - timedelta(hours=hours)
    return start_dt, end_dt


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def normalise_multi_value(value: Any) -> List[str]:
    """Druid's multi-value dimensions show up as either a list, a JSON string,
    or ``None``. Return a clean list of non-empty strings.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if isinstance(value, str):
        if not value:
            return []
        if value.startswith('['):
            try:
                import json

                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed if item]
            except ValueError:
                pass
        return [value]
    return [str(value)]


def parse_iso(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def event_row_from_druid(event: Dict[str, Any]) -> Dict[str, Any]:
    """Translate a raw Druid scan-row into the dashboard's event row shape."""
    return {
        'timestamp': parse_iso(event.get('__time')) or datetime.now(tz=timezone.utc),
        'action_id': int(event.get('__action_id') or 0),
        'action_name': event.get('ActionName') or 'unknown',
        'verdicts': normalise_multi_value(event.get('__verdicts')),
        'rules_triggered': normalise_multi_value(event.get('__rules_fired')),
        'entity_id': event.get('UserId'),
        'entity_type': 'User' if event.get('UserId') else None,
    }
