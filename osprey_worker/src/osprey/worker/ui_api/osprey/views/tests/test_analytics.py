"""Tests for the analytics endpoints used by the dashboard widgets."""

from __future__ import annotations

import json
from datetime import datetime
from http import HTTPStatus
from typing import Any, Dict, List
from unittest import mock

import pytest
from flask import Flask, Response, url_for
from flask.testing import FlaskClient
from osprey.worker.ui_api.osprey.lib.druid import (
    BaseDruidQuery,
    TimeseriesDruidQuery,
    TopNDruidQuery,
)
from pydruid.query import Query

_ANALYTICS_CONFIG: Dict[str, Any] = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {
                        'abilities': [
                            {'name': 'CAN_VIEW_ANALYTICS', 'allow_all': True},
                            {'name': 'CAN_VIEW_EVENTS_BY_ENTITY', 'allow_all': True},
                            {'name': 'CAN_VIEW_EVENTS_BY_ACTION', 'allow_all': True},
                        ]
                    }
                }
            }
        }
    ),
}


_ACTION_RESTRICTED_CONFIG: Dict[str, Any] = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {
                        'abilities': [
                            {'name': 'CAN_VIEW_ANALYTICS', 'allow_all': True},
                            {'name': 'CAN_VIEW_EVENTS_BY_ENTITY', 'allow_all': True},
                            {
                                'name': 'CAN_VIEW_EVENTS_BY_ACTION',
                                'allow_specific': ['post_created'],
                            },
                        ]
                    }
                }
            }
        }
    ),
}


# Regression for the dashboard widget case: entity=null queries must work even
# when the user only has entity-scoped CanViewEventsByEntity (allow_specific).
# CanViewEventsByEntity._request_is_allowed returns False for null entity, so
# without the ``if entity is not None`` guard in analytics.py these endpoints
# would 401 every dashboard widget for any non-allow_all entity ACL.
_ENTITY_RESTRICTED_CONFIG: Dict[str, Any] = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {
                        'abilities': [
                            {'name': 'CAN_VIEW_ANALYTICS', 'allow_all': True},
                            {
                                'name': 'CAN_VIEW_EVENTS_BY_ENTITY',
                                'allow_specific': [{'type': 'User', 'id': '42'}],
                            },
                            {'name': 'CAN_VIEW_EVENTS_BY_ACTION', 'allow_all': True},
                        ]
                    }
                }
            }
        }
    ),
}


@pytest.fixture(name='fake_druid')
def fake_druid_fixture() -> Any:
    druid = mock.MagicMock()
    druid.datasource = 'osprey.execution_results'
    druid.client = mock.MagicMock()
    return druid


@pytest.fixture(name='mock_druid_client')
def mock_druid_client_fixture(fake_druid: Any) -> Any:
    with mock.patch('osprey.worker.ui_api.osprey.lib.druid.DRUID') as magic_mock:
        magic_mock.instance = mock.MagicMock(return_value=fake_druid)
        yield


def _base_kwargs() -> Dict[str, Any]:
    return BaseDruidQuery(start=datetime.now(), end=datetime.now(), query_filter='', entity=None).dict()


def test_analytics_endpoints_reject_unauthenticated(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.post(
        url_for('analytics.timeseries'),
        data=TimeseriesDruidQuery(granularity='hour', **_base_kwargs()).json(),
        content_type='application/json',
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED


@pytest.mark.use_rules_sources(_ANALYTICS_CONFIG)
def test_analytics_timeseries_runs_query(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.post(
        url_for('analytics.timeseries'),
        data=TimeseriesDruidQuery(granularity='hour', **_base_kwargs()).json(),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data
    fake_druid.client._post.assert_called()
    assert res.get_json() == []


@pytest.mark.use_rules_sources(_ANALYTICS_CONFIG)
def test_analytics_groupby_runs_query(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.post(
        url_for('analytics.groupby_dimension'),
        data=TopNDruidQuery(dimension='Verdict', limit=10, **_base_kwargs()).json(),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data
    fake_druid.client._post.assert_called()


@pytest.mark.use_rules_sources(_ANALYTICS_CONFIG)
def test_analytics_verdicts_summary_uses_default_dimension(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.post(
        url_for('analytics.verdicts_summary'),
        data=json.dumps({'limit': 5}),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data
    args, _ = fake_druid.client._post.call_args
    built_query = args[0]
    assert built_query.query_dict.get('dimension') == 'Verdict'


@pytest.mark.use_rules_sources(_ANALYTICS_CONFIG)
def test_analytics_rules_performance_uses_rule_dimension(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.post(
        url_for('analytics.rules_performance'),
        data=json.dumps({}),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data
    args, _ = fake_druid.client._post.call_args
    built_query = args[0]
    assert built_query.query_dict.get('dimension') == 'RuleName'


@pytest.mark.use_rules_sources(_ANALYTICS_CONFIG)
def test_analytics_throughput_uses_timeseries(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.post(
        url_for('analytics.throughput'),
        data=json.dumps({'granularity': 'minute'}),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data
    fake_druid.client._post.assert_called()


@pytest.mark.use_rules_sources(_ANALYTICS_CONFIG)
def test_analytics_execution_results_get(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[{"timestamp":"2024-01-01T00:00:00Z","result":{"count":42}}]'
    fake_druid.client._post.return_value = query

    res = client.get(url_for('analytics.execution_results') + '?granularity=hour')

    assert res.status_code == HTTPStatus.OK, res.data
    body = res.get_json()
    assert body['summary']['total'] == 42
    assert body['summary']['points'] == 1


def _extract_action_filter_values(query_dict: Dict[str, Any]) -> List[str]:
    """Walk a Druid query_dict and collect every ActionName selector value."""
    values: List[str] = []

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get('type') == 'selector' and node.get('dimension') == 'ActionName' and 'value' in node:
                values.append(node['value'])
            for v in node.values():
                _walk(v)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    _walk(query_dict.get('filter'))
    return sorted(values)


@pytest.mark.use_rules_sources(_ACTION_RESTRICTED_CONFIG)
def test_throughput_applies_can_view_events_by_action_filter(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    """Regression: /analytics/throughput must inject the CAN_VIEW_EVENTS_BY_ACTION
    Druid filter so a caller restricted to ``post_created`` cannot count events for
    other actions, regardless of the ``query_filter`` they send."""
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.post(
        url_for('analytics.throughput'),
        data=json.dumps({'granularity': 'minute'}),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data
    args, _ = fake_druid.client._post.call_args
    assert _extract_action_filter_values(args[0].query_dict) == ['post_created']


@pytest.mark.use_rules_sources(_ACTION_RESTRICTED_CONFIG)
def test_execution_results_applies_can_view_events_by_action_filter(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    """Regression: /analytics/execution-results must inject the CAN_VIEW_EVENTS_BY_ACTION
    Druid filter for restricted callers."""
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.get(url_for('analytics.execution_results') + '?granularity=hour')

    assert res.status_code == HTTPStatus.OK, res.data
    args, _ = fake_druid.client._post.call_args
    assert _extract_action_filter_values(args[0].query_dict) == ['post_created']


@pytest.mark.use_rules_sources(_ENTITY_RESTRICTED_CONFIG)
def test_timeseries_allows_null_entity_for_entity_restricted_user(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    """Regression: dashboard widgets always send entity=null. A user with
    ``CAN_VIEW_EVENTS_BY_ENTITY: allow_specific=[...]`` (i.e. entity-scoped, not
    ``allow_all``) must still be able to query ``/analytics/timeseries`` with a
    null entity. ``CanViewEventsByEntity._request_is_allowed`` returns False for
    null entities, so this only works when the analytics endpoint skips the
    entity check for null-entity queries."""
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.post(
        url_for('analytics.timeseries'),
        data=TimeseriesDruidQuery(granularity='hour', **_base_kwargs()).json(),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data


@pytest.mark.use_rules_sources(_ENTITY_RESTRICTED_CONFIG)
def test_groupby_allows_null_entity_for_entity_restricted_user(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_druid_client: Any,
    fake_druid: Any,
) -> None:
    """Regression for ``/analytics/groupby``; same rationale as the timeseries
    test above."""
    query = Query(query_dict={}, query_type='osprey.execution_results')  # type: ignore
    query.result_json = '[]'
    fake_druid.client._post.return_value = query

    res = client.post(
        url_for('analytics.groupby_dimension'),
        data=TopNDruidQuery(dimension='Verdict', limit=10, **_base_kwargs()).json(),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data


@pytest.mark.use_rules_sources(_ANALYTICS_CONFIG)
def test_analytics_labels_summary_returns_empty_when_table_missing(
    app: Flask,
    client: 'FlaskClient[Response]',
) -> None:
    """When the entity_labels table isn't present we return a graceful empty
    payload rather than 5xx. This is important because some Osprey deployments
    use a non-Postgres labels backend."""

    fake_session = mock.MagicMock()
    fake_session.execute.return_value.scalar.return_value = False  # to_regclass returns NULL

    @mock.patch('osprey.worker.lib.storage.postgres.scoped_session')
    def _run(scoped: Any) -> Any:
        scoped.return_value.__enter__.return_value = fake_session
        scoped.return_value.__exit__.return_value = False
        return client.get(url_for('analytics.labels_summary'))

    res = _run()
    assert res.status_code == HTTPStatus.OK, res.data
    body = res.get_json()
    assert body == {'total_entities': 0, 'top_labels': [], 'recent': []}


@pytest.mark.use_rules_sources(_ANALYTICS_CONFIG)
def test_analytics_labels_summary_recent_unwraps_serialized_envelope(
    app: Flask,
    client: 'FlaskClient[Response]',
) -> None:
    """``EntityLabels.serialize()`` writes the JSONB column as
    ``{"labels": {"<label_name>": {...}}}``. The ``recent`` payload must
    unwrap the outer ``labels`` key so the frontend (which calls
    ``Object.keys(row.labels)``) sees the actual label names — otherwise it
    would render every row as a single ``"labels"`` tag instead of the real
    label set. ``top_labels`` already unwraps via
    ``jsonb_object_keys(labels->'labels')``; this test pins the parallel
    behavior on the recent-rows code path."""

    class _FakeRow:
        def __init__(self, **kwargs: Any) -> None:
            for k, v in kwargs.items():
                setattr(self, k, v)

    serialized_envelope = {
        'labels': {
            'spam': {'state': 'ADDED', 'reason': 'Triggered by rule.', 'expiry': None},
            'verified': {'state': 'ADDED', 'reason': 'Manual.', 'expiry': None},
        }
    }
    legacy_unwrapped = {
        'manual_review': {'state': 'ADDED'},
    }

    top_labels_rows = [
        _FakeRow(label_name='spam', cnt=2),
        _FakeRow(label_name='verified', cnt=1),
    ]
    recent_rows = [
        _FakeRow(entity_key='User:1', labels=serialized_envelope),
        _FakeRow(entity_key='User:2', labels=legacy_unwrapped),
    ]

    fake_session = mock.MagicMock()

    def execute_side_effect(query: Any, params: Any = None) -> Any:
        sql = str(query).strip()
        result = mock.MagicMock()
        if 'to_regclass' in sql:
            result.scalar.return_value = True
        elif 'COUNT(*) FROM entity_labels' in sql:
            result.scalar.return_value = 5
        elif 'jsonb_object_keys' in sql:
            result.fetchall.return_value = top_labels_rows
        else:
            result.fetchall.return_value = recent_rows
        return result

    fake_session.execute.side_effect = execute_side_effect

    @mock.patch('osprey.worker.lib.storage.postgres.scoped_session')
    def _run(scoped: Any) -> Any:
        scoped.return_value.__enter__.return_value = fake_session
        scoped.return_value.__exit__.return_value = False
        return client.get(url_for('analytics.labels_summary'))

    res = _run()
    assert res.status_code == HTTPStatus.OK, res.data
    body = res.get_json()
    assert body['total_entities'] == 5
    assert body['top_labels'] == [
        {'label_name': 'spam', 'count': 2},
        {'label_name': 'verified', 'count': 1},
    ]
    # First row: the serialized envelope must be unwrapped so the frontend
    # gets ``{"spam": ..., "verified": ...}`` (Object.keys → label names),
    # not the literal ``{"labels": {...}}`` wrapper.
    assert body['recent'][0]['entity_key'] == 'User:1'
    assert set(body['recent'][0]['labels'].keys()) == {'spam', 'verified'}
    # Second row: legacy/unwrapped shape passes through unchanged.
    assert body['recent'][1]['entity_key'] == 'User:2'
    assert set(body['recent'][1]['labels'].keys()) == {'manual_review'}
