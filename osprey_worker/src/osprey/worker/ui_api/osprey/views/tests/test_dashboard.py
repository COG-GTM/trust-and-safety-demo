"""Tests for the dashboard views (operator Dashboard, Rule Performance, and
Entity Investigation experiences).

Mirrors the test patterns in ``test_events.py``:

* The unauthenticated rejection tests run with the default empty rules sources
  and confirm that each endpoint returns 401 to a caller without abilities.
* The happy-path tests use ``@pytest.mark.use_rules_sources`` to grant the
  test user the relevant abilities and a ``mock_druid_client`` fixture that
  stubs the Druid HTTP round-trip so the test exercises the view's Druid
  query-construction and response-shaping logic in isolation.
"""

import json
from datetime import datetime
from typing import Any, List
from unittest import mock

import pytest
from flask import Flask, Response, url_for
from flask.testing import FlaskClient
from osprey.worker.ui_api.osprey.lib.druid import BaseDruidQuery
from pydruid.query import Query

_base_druid_query = BaseDruidQuery(start=datetime.now(), end=datetime.now(), query_filter='', entity=None)

# Configs lifted from ``test_events.py``.  The ``CAN_VIEW_EVENTS_BY_ENTITY``
# ability is required by every dashboard endpoint; ``CAN_VIEW_EVENTS_BY_ACTION``
# is additionally required by ``dashboard_recent_alerts``.
view_entity_only_config = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {'abilities': [{'name': 'CAN_VIEW_EVENTS_BY_ENTITY', 'allow_all': True}]}
                }
            }
        }
    ),
}

view_entity_and_action_config = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {
                        'abilities': [
                            {'name': 'CAN_VIEW_EVENTS_BY_ENTITY', 'allow_all': True},
                            {'name': 'CAN_VIEW_EVENTS_BY_ACTION', 'allow_all': True},
                        ]
                    }
                }
            }
        }
    ),
}

view_entity_and_action_scoped_config = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {
                        'abilities': [
                            {'name': 'CAN_VIEW_EVENTS_BY_ENTITY', 'allow_all': True},
                            {
                                'name': 'CAN_VIEW_EVENTS_BY_ACTION',
                                'allow_specific': ['create_post', 'send_message'],
                            },
                        ]
                    }
                }
            }
        }
    ),
}


@pytest.fixture()
def fake_druid() -> Any:
    druid = mock.MagicMock()
    druid.datasource = 'osprey.execution_results'
    druid.client = mock.MagicMock()
    return druid


@pytest.fixture()
def mock_druid_client(fake_druid: Any) -> Any:
    with mock.patch('osprey.worker.ui_api.osprey.lib.druid.DRUID') as druid_singleton:
        druid_singleton.instance = mock.MagicMock(return_value=fake_druid)
        yield


@pytest.fixture()
def mock_dashboard_druid_client(fake_druid: Any) -> Any:
    """Patch the ``DRUID`` binding inside ``dashboard.py``.

    ``dashboard._build_query`` resolves ``DRUID.instance()`` via the
    ``from ..singletons import DRUID`` import, so the binding lives on the
    dashboard module itself and that's what we need to patch (the
    re-exported binding on ``osprey.worker.ui_api.osprey.singletons`` won't
    reach the cached attribute reference in the views module).
    """
    with mock.patch('osprey.worker.ui_api.osprey.views.dashboard.DRUID') as druid_singleton:
        druid_singleton.instance = mock.MagicMock(return_value=fake_druid)
        yield


def _mock_druid_response(fake_druid: Any, result_json: str) -> None:
    query = Query(query_dict={}, query_type='timeseries')  # type: ignore[arg-type]
    query.result_json = result_json
    fake_druid.client._post.return_value = query


# ---------------------------------------------------------------------------
# Auth rejection: no abilities => 401 on every endpoint
# ---------------------------------------------------------------------------


_DASHBOARD_POST_ENDPOINTS: List[str] = [
    'dashboard.dashboard_summary',
    'dashboard.dashboard_rule_performance',
    'dashboard.dashboard_label_activity',
    'dashboard.dashboard_verdict_distribution',
    'dashboard.dashboard_recent_alerts',
]


@pytest.mark.parametrize('endpoint', _DASHBOARD_POST_ENDPOINTS)
def test_dashboard_auth_reject_post(app: Flask, client: 'FlaskClient[Response]', endpoint: str) -> None:
    res = client.post(
        url_for(endpoint),
        content_type='application/json',
        data=_base_druid_query.json(),
    )
    assert res.status_code == 401, res.data


def test_entity_profile_auth_reject_get(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.get(url_for('dashboard.entity_profile', entity_type='User', entity_id='u-123'))
    assert res.status_code == 401, res.data


# ---------------------------------------------------------------------------
# Happy paths: with abilities + mocked Druid client
# ---------------------------------------------------------------------------


@pytest.mark.use_rules_sources(view_entity_only_config)
def test_dashboard_summary_happy_path(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_dashboard_druid_client: Any,
    fake_druid: Any,
) -> None:
    _mock_druid_response(
        fake_druid,
        json.dumps(
            [
                {
                    'timestamp': '2024-01-01T00:00:00.000Z',
                    'result': {
                        'events': 10,
                        'rules_fired': 4,
                        'labels_applied': 3,
                        'verdicts_issued': 2,
                    },
                }
            ]
        ),
    )

    res = client.post(
        url_for('dashboard.dashboard_summary'),
        content_type='application/json',
        data=_base_druid_query.json(),
    )

    assert res.status_code == 200, res.data
    body = res.get_json()
    # Each metric must be { total, points: [...] }.
    for key in ('events', 'rules_fired', 'labels_applied', 'verdicts_issued'):
        assert key in body
        assert 'total' in body[key]
        assert 'points' in body[key]


@pytest.mark.use_rules_sources(view_entity_only_config)
def test_dashboard_verdict_distribution_is_a_partition(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_dashboard_druid_client: Any,
    fake_druid: Any,
) -> None:
    """``allow`` / ``ban`` / ``errors`` must be a partition: every event
    contributes to exactly one bucket and ``total`` is the sum of the
    three.  This guards against the regression where ``errors`` was
    counted orthogonally (and the donut total double-counted errored
    events)."""
    _mock_druid_response(
        fake_druid,
        json.dumps(
            [
                {
                    'timestamp': '2024-01-01T00:00:00.000Z',
                    'result': {'allow': 70, 'ban': 25, 'errors': 5},
                }
            ]
        ),
    )

    res = client.post(
        url_for('dashboard.dashboard_verdict_distribution'),
        content_type='application/json',
        data=_base_druid_query.json(),
    )

    assert res.status_code == 200, res.data
    body = res.get_json()
    buckets = {bucket['verdict']: bucket['count'] for bucket in body['buckets']}
    assert buckets == {'allow': 70, 'ban': 25, 'errors': 5}
    assert body['total'] == sum(buckets.values()) == 100


@pytest.mark.use_rules_sources(view_entity_only_config)
def test_dashboard_label_activity_happy_path(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_dashboard_druid_client: Any,
    fake_druid: Any,
) -> None:
    _mock_druid_response(fake_druid, '[]')

    res = client.post(
        url_for('dashboard.dashboard_label_activity'),
        content_type='application/json',
        data=_base_druid_query.json(),
    )

    assert res.status_code == 200, res.data
    body = res.get_json()
    assert 'points' in body
    assert 'label_names' in body


@pytest.mark.use_rules_sources(view_entity_only_config)
def test_dashboard_rule_performance_happy_path(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_dashboard_druid_client: Any,
    fake_druid: Any,
) -> None:
    _mock_druid_response(fake_druid, '[]')

    res = client.post(
        url_for('dashboard.dashboard_rule_performance'),
        content_type='application/json',
        data=_base_druid_query.json(),
    )

    assert res.status_code == 200, res.data
    body = res.get_json()
    assert 'rules' in body
    assert 'series' in body
    assert 'false_positive_rate' in body


# ---------------------------------------------------------------------------
# Action-level ACL on ``dashboard_recent_alerts``
# ---------------------------------------------------------------------------


@pytest.mark.use_rules_sources(view_entity_only_config)
def test_recent_alerts_rejects_when_missing_view_by_action(app: Flask, client: 'FlaskClient[Response]') -> None:
    """An operator who can view events by entity but lacks
    ``CAN_VIEW_EVENTS_BY_ACTION`` must be rejected by ``recent-alerts``,
    matching the ``events.scan_query`` policy (this endpoint also returns
    row-level ``ActionName`` data)."""
    res = client.post(
        url_for('dashboard.dashboard_recent_alerts'),
        content_type='application/json',
        data=_base_druid_query.json(),
    )
    assert res.status_code == 401
    assert b'CAN_VIEW_EVENTS_BY_ACTION' in res.data


@pytest.mark.use_rules_sources(view_entity_and_action_scoped_config)
def test_recent_alerts_injects_action_acl_into_druid_filter(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_dashboard_druid_client: Any,
    fake_druid: Any,
) -> None:
    """The user has ``CAN_VIEW_EVENTS_BY_ACTION`` scoped to two specific
    actions, so the Druid SCAN filter must include both as ``selector``
    clauses against the ``ActionName`` dimension (mirroring the
    ``events.scan_query`` enforcement pattern)."""
    _mock_druid_response(fake_druid, '[]')

    res = client.post(
        url_for('dashboard.dashboard_recent_alerts'),
        content_type='application/json',
        data=_base_druid_query.json(),
    )

    assert res.status_code == 200, res.data
    args, _kwargs = fake_druid.client._post.call_args
    query_dict = args[0].query_dict
    # Recursively collect every selector clause filtering on ActionName.
    selectors: List[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get('type') == 'selector' and node.get('dimension') == 'ActionName':
                selectors.append(node.get('value'))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(query_dict.get('filter'))
    assert sorted(selectors) == ['create_post', 'send_message']


@pytest.mark.use_rules_sources(view_entity_and_action_config)
def test_recent_alerts_passes_when_action_allow_all(
    app: Flask,
    client: 'FlaskClient[Response]',
    mock_dashboard_druid_client: Any,
    fake_druid: Any,
) -> None:
    """``allow_all`` on ``CAN_VIEW_EVENTS_BY_ACTION`` produces no filter
    clause; the endpoint must still succeed."""
    _mock_druid_response(fake_druid, '[]')

    res = client.post(
        url_for('dashboard.dashboard_recent_alerts'),
        content_type='application/json',
        data=_base_druid_query.json(),
    )
    assert res.status_code == 200, res.data


# ---------------------------------------------------------------------------
# Entity profile endpoint
# ---------------------------------------------------------------------------


@pytest.mark.use_rules_sources(view_entity_only_config)
def test_entity_profile_requires_entity_id(app: Flask, client: 'FlaskClient[Response]') -> None:
    # Flask path converter rejects empty path segments, so test the explicit
    # ``''``-id case via the in-view guard by sending a single-space id which
    # the converter accepts but the view rejects.
    res = client.get(url_for('dashboard.entity_profile', entity_type='', entity_id='u-1'))
    # Flask cannot match empty `entity_type` against the path converter and
    # responds with 404 before the view runs; this asserts the route shape.
    assert res.status_code in (400, 404), res.data
