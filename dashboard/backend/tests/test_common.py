"""Lightweight unit tests for the dashboard backend helpers."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from backend.routers._common import (
    event_row_from_druid,
    normalise_multi_value,
    parse_iso,
    resolve_window,
)


def test_normalise_multi_value_handles_list_string_and_none() -> None:
    assert normalise_multi_value(None) == []
    assert normalise_multi_value([]) == []
    assert normalise_multi_value(['a', 'b']) == ['a', 'b']
    assert normalise_multi_value('rule_one') == ['rule_one']
    assert normalise_multi_value('["x","y"]') == ['x', 'y']
    assert normalise_multi_value('') == []


def test_parse_iso_supports_z_and_offsets() -> None:
    parsed = parse_iso('2024-05-01T12:00:00Z')
    assert parsed is not None
    assert parsed.tzinfo is not None
    assert parsed.year == 2024


def test_resolve_window_default_lookback() -> None:
    start, end = resolve_window(start=None, end=None, lookback_hours=None, default_hours=24)
    assert end > start
    assert (end - start) - timedelta(hours=24) < timedelta(seconds=5)


def test_resolve_window_explicit_range() -> None:
    s = datetime(2024, 1, 1, tzinfo=timezone.utc)
    e = datetime(2024, 1, 2, tzinfo=timezone.utc)
    start, end = resolve_window(start=s, end=e, lookback_hours=None, default_hours=24)
    assert start == s
    assert end == e


def test_resolve_window_invalid_range_raises() -> None:
    e = datetime(2024, 1, 1, tzinfo=timezone.utc)
    s = datetime(2024, 1, 2, tzinfo=timezone.utc)
    with pytest.raises(HTTPException):
        resolve_window(start=s, end=e, lookback_hours=None, default_hours=24)


def test_event_row_from_druid_translates_fields() -> None:
    row = event_row_from_druid(
        {
            '__time': '2024-05-01T12:00:00Z',
            '__action_id': 42,
            'ActionName': 'create_post',
            '__verdicts': ['reject'],
            '__rules_fired': 'is_spammer',
            'UserId': 'user_1',
        }
    )
    assert row['action_id'] == 42
    assert row['action_name'] == 'create_post'
    assert row['verdicts'] == ['reject']
    assert row['rules_triggered'] == ['is_spammer']
    assert row['entity_id'] == 'user_1'
    assert row['entity_type'] == 'User'
