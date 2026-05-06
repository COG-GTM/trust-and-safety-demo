"""Smoke tests for the executive dashboard endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List
from unittest.mock import patch

import pytest
from flask import url_for

if TYPE_CHECKING:
    from flask import Flask, Response
    from flask.testing import FlaskClient


def _stub_druid_sql(rows_by_query: Dict[str, List[Dict[str, Any]]] | None = None):
    """Patch ``_druid_sql`` to return canned rows.

    If ``rows_by_query`` is provided, returns rows whose key is a substring of
    the SQL. Otherwise returns ``[]``.
    """
    rows_by_query = rows_by_query or {}

    def fake(sql: str, params=None):  # type: ignore[no-untyped-def]
        for needle, rows in rows_by_query.items():
            if needle in sql:
                return rows
        return []

    return patch(
        'osprey.worker.ui_api.osprey.views.dashboard._druid_sql',
        side_effect=fake,
    )


def test_summary_returns_kpis(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    canned = {
        'INFORMATION_SCHEMA.COLUMNS': [
            {'COLUMN_NAME': '__time'},
            {'COLUMN_NAME': '__verdicts'},
            {'COLUMN_NAME': '__entity_label_mutations'},
            {'COLUMN_NAME': '__error_count'},
            {'COLUMN_NAME': 'UserId'},
        ],
        'COUNT(*) AS total_events': [
            {
                'total_events': 1000,
                'flagged_events': 50,
                'unique_entities_flagged': 30,
                'label_mutations': 40,
                'error_events': 5,
            }
        ],
        'GROUP BY "__verdicts"': [
            {'verdict': 'reject', 'cnt': 20},
            {'verdict': 'allow', 'cnt': 10},
        ],
    }
    with _stub_druid_sql(canned):
        res = client.get(url_for('dashboard.get_summary', window='24h'))

    assert res.status_code == 200
    data = res.json
    assert data['total_events'] == 1000
    assert data['flagged_events'] == 50
    assert data['flag_rate'] == pytest.approx(0.05)
    assert data['unique_entities_flagged'] == 30
    assert data['labels_applied'] == 40
    assert data['error_events'] == 5
    assert data['verdicts_breakdown'] == [
        {'verdict': 'reject', 'count': 20},
        {'verdict': 'allow', 'count': 10},
    ]


def test_summary_rejects_unknown_window(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    res = client.get(url_for('dashboard.get_summary', window='2y'))
    assert res.status_code == 400


def test_summary_offset_shifts_window_back(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    """``offset=1`` should query the immediately-preceding window of the same length."""
    captured: List[Dict[str, Any]] = []

    def fake(sql: str, params=None):  # type: ignore[no-untyped-def]
        captured.append({'sql': sql, 'params': params})
        if 'INFORMATION_SCHEMA.COLUMNS' in sql:
            return [{'COLUMN_NAME': '__time'}]
        return [{'total_events': 0, 'flagged_events': 0}]

    with patch('osprey.worker.ui_api.osprey.views.dashboard._druid_sql', side_effect=fake):
        res_current = client.get(url_for('dashboard.get_summary', window='24h'))
        res_previous = client.get(url_for('dashboard.get_summary', window='24h', offset=1))

    assert res_current.status_code == 200
    assert res_previous.status_code == 200
    current_window = res_current.json['window']
    previous_window = res_previous.json['window']
    current_start = datetime.fromisoformat(current_window['start'])
    current_end = datetime.fromisoformat(current_window['end'])
    previous_start = datetime.fromisoformat(previous_window['start'])
    previous_end = datetime.fromisoformat(previous_window['end'])
    # The previous window must have the same duration as the current one and be
    # shifted back by approximately one duration.
    assert (current_end - current_start) == (previous_end - previous_start)
    delta = (current_start - previous_end).total_seconds()
    assert -1.0 <= delta <= 1.0


def test_timeseries_returns_points(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    canned = {
        'GROUP BY 1': [
            {'bucket': '2026-05-06T00:00:00.000Z', 'value': 12},
            {'bucket': '2026-05-06T01:00:00.000Z', 'value': 15},
        ]
    }
    with _stub_druid_sql(canned):
        res = client.get(url_for('dashboard.get_timeseries', window='24h', granularity='hour', metric='total_events'))

    assert res.status_code == 200
    data = res.json
    assert data['metric'] == 'total_events'
    assert len(data['points']) == 2
    assert data['points'][0]['value'] == 12.0


def test_timeseries_rejects_unknown_metric(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    res = client.get(url_for('dashboard.get_timeseries', metric='bogus'))
    assert res.status_code == 400


def test_top_rules_returns_sorted_results(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    canned = {
        'INFORMATION_SCHEMA.COLUMNS': [
            {'COLUMN_NAME': 'ContainsHello'},
            {'COLUMN_NAME': 'AnotherRule'},
            {'COLUMN_NAME': '__time'},  # excluded
        ],
        'SUM(CAST': [{'ContainsHello': 7, 'AnotherRule': 3}],
    }
    with _stub_druid_sql(canned):
        res = client.get(url_for('dashboard.get_top_rules', window='7d', limit=5))

    assert res.status_code == 200
    rules = res.json['rules']
    assert [r['rule'] for r in rules] == ['ContainsHello', 'AnotherRule']
    assert rules[0]['matches'] == 7
    assert rules[0]['percentage'] == pytest.approx(0.7)
    assert res.json['total_matches'] == 10


def test_top_rules_rejects_non_numeric_limit(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    res = client.get(url_for('dashboard.get_top_rules', window='24h', limit='abc'))
    assert res.status_code == 400


def test_top_entities_rejects_non_numeric_limit(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    res = client.get(url_for('dashboard.get_top_entities', window='24h', limit='abc'))
    assert res.status_code == 400


def test_top_entities_uses_entity_mapping(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    canned = {
        'GROUP BY 1': [
            {'entity_id': 'user_1', 'flag_count': 4},
            {'entity_id': 'user_2', 'flag_count': 2},
        ]
    }
    with _stub_druid_sql(canned):
        res = client.get(url_for('dashboard.get_top_entities', entity_type='User', limit=10))

    assert res.status_code == 200
    assert res.json['entity_type'] == 'User'
    assert res.json['entities'][0]['entity_id'] == 'user_1'
    assert res.json['entities'][0]['flag_count'] == 4


def test_pipeline_health_computes_rates(app: 'Flask', client: 'FlaskClient[Response]') -> None:
    canned = {
        'MAX("__time")': [
            {
                'total_events': 600,
                'error_events': 6,
                'latest_event': '2026-05-06T06:00:00.000Z',
            }
        ],
        'TIME_FLOOR("__time", \'PT1M\')': [
            {'bucket': '2026-05-06T00:00:00.000Z', 'events': 10, 'errors': 0},
            {'bucket': '2026-05-06T00:01:00.000Z', 'events': 10, 'errors': 1},
        ],
    }
    with _stub_druid_sql(canned):
        res = client.get(url_for('dashboard.get_pipeline_health', window='1h'))

    assert res.status_code == 200
    data = res.json
    assert data['total_events'] == 600
    assert data['error_events'] == 6
    assert data['error_rate'] == pytest.approx(0.01)
    assert data['events_per_minute'] == pytest.approx(10.0)
    assert len(data['throughput']) == 2
