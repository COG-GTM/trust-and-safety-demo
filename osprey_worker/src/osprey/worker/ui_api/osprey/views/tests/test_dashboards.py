"""Tests for the analytics dashboards CRUD endpoints.

These tests mock the storage layer so they do not need a live Postgres; the
storage layer itself is exercised by integration tests when the full Docker
stack is running.
"""

from __future__ import annotations

import json
from http import HTTPStatus
from typing import Any, Dict, List
from unittest import mock

import pytest
from flask import Flask, Response, url_for
from flask.testing import FlaskClient

_DASHBOARD_CONFIG: Dict[str, Any] = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {
                        'abilities': [
                            {'name': 'CAN_VIEW_DASHBOARDS', 'allow_all': True},
                            {'name': 'CAN_CREATE_AND_EDIT_DASHBOARDS', 'allow_all': True},
                        ]
                    }
                }
            }
        }
    ),
}


_VIEW_ONLY_CONFIG: Dict[str, Any] = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {
                        'abilities': [
                            {'name': 'CAN_VIEW_DASHBOARDS', 'allow_all': True},
                        ]
                    }
                }
            }
        }
    ),
}


def _make_dashboard_stub(dashboard_id: int = 123, name: str = 'My Dashboard') -> Any:
    """Returns a MagicMock that quacks like a `Dashboard` ORM instance."""
    stub = mock.MagicMock()
    stub.id = dashboard_id
    stub.name = name
    stub.owner = 'local-dev@localhost'
    stub.description = None
    stub.layout_json = {'widgets': [], 'version': 1}
    stub.is_template = False
    stub.serialize.return_value = {
        'id': str(dashboard_id),
        'name': name,
        'owner': 'local-dev@localhost',
        'description': None,
        'layout_json': stub.layout_json,
        'is_template': False,
        'created_at': '2024-01-01T00:00:00+00:00',
        'updated_at': '2024-01-01T00:00:00+00:00',
    }
    return stub


@pytest.fixture(name='dashboard_storage')
def dashboard_storage_fixture() -> Any:
    """Patch the storage methods used by the views layer."""
    target = 'osprey.worker.ui_api.osprey.views.dashboards.Dashboard'
    with mock.patch(target) as dashboard_cls:
        # Each test re-binds the methods it cares about, but provide sensible
        # defaults so untouched methods don't blow up with a "MagicMock has no
        # attribute" surprise.
        dashboard_cls.get_one_with_id.return_value = None
        dashboard_cls.get_all.return_value = []
        dashboard_cls.get_all_for_user.return_value = []

        # Calling Dashboard() (constructor) returns a fresh stub that records
        # attribute writes. ``insert`` populates ``id`` to mimic Snowflake.
        def _factory() -> Any:
            new = _make_dashboard_stub()
            new.id = None

            def _insert(commit: bool = True) -> None:
                new.id = 999
                new.serialize.return_value = {**new.serialize.return_value, 'id': '999'}

            new.insert.side_effect = _insert
            return new

        dashboard_cls.side_effect = _factory
        yield dashboard_cls


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_create_dashboard_happy_path(app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any) -> None:
    body = {
        'name': 'Operations Overview',
        'description': 'Top-level T&S health',
        'layout_json': {'widgets': [{'type': 'verdictPie'}], 'version': 1},
    }

    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps(body),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data
    payload = res.get_json()
    assert payload['name'] == 'My Dashboard'  # comes from the stubbed serialize
    assert payload['id'] == '999'


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_create_dashboard_rejects_empty_name(
    app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any
) -> None:
    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps({'name': '   '}),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.BAD_REQUEST


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_create_dashboard_rejects_non_object_layout(
    app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any
) -> None:
    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps({'name': 'Foo', 'layout_json': 'not-an-object'}),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.BAD_REQUEST


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_get_dashboard_returns_404_for_missing(
    app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any
) -> None:
    res = client.get(url_for('dashboards.get_dashboard', dashboard_id=12345))
    assert res.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_get_dashboard_returns_serialized_payload(
    app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any
) -> None:
    stub = _make_dashboard_stub()
    dashboard_storage.get_one_with_id.return_value = stub

    res = client.get(url_for('dashboards.get_dashboard', dashboard_id=stub.id))

    assert res.status_code == HTTPStatus.OK, res.data
    payload = res.get_json()
    assert payload['id'] == str(stub.id)
    assert payload['name'] == stub.name


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_list_dashboards_filters_by_user(app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any) -> None:
    stub = _make_dashboard_stub()
    dashboard_storage.get_all_for_user.return_value = [stub]
    dashboard_storage.get_all.return_value: List[Any] = []

    res = client.get(url_for('dashboards.list_dashboards', user_email='alice@example.com'))

    assert res.status_code == HTTPStatus.OK
    dashboard_storage.get_all_for_user.assert_called_once_with(user_email='alice@example.com')
    payload = res.get_json()
    assert len(payload) == 1


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_list_dashboards_without_filter(app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any) -> None:
    dashboard_storage.get_all.return_value = [_make_dashboard_stub(), _make_dashboard_stub(id=124)]
    dashboard_storage.get_all_for_user.return_value = []

    res = client.get(url_for('dashboards.list_dashboards'))

    assert res.status_code == HTTPStatus.OK
    dashboard_storage.get_all.assert_called_once()
    assert len(res.get_json()) == 2


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_update_dashboard_persists_writable_fields(
    app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any
) -> None:
    stub = _make_dashboard_stub()
    dashboard_storage.get_one_with_id.return_value = stub

    res = client.patch(
        url_for('dashboards.update_dashboard', dashboard_id=stub.id),
        data=json.dumps(
            {
                'name': 'Updated',
                'description': 'with desc',
                'layout_json': {'widgets': [{'type': 'timeSeries'}], 'version': 2},
                'is_template': True,
            }
        ),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK, res.data
    assert stub.name == 'Updated'
    assert stub.description == 'with desc'
    assert stub.layout_json == {'widgets': [{'type': 'timeSeries'}], 'version': 2}
    assert stub.is_template is True
    stub.save.assert_called_once()


@pytest.mark.use_rules_sources(_DASHBOARD_CONFIG)
def test_delete_dashboard_calls_storage(app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any) -> None:
    stub = _make_dashboard_stub()
    dashboard_storage.get_one_with_id.return_value = stub

    res = client.delete(url_for('dashboards.delete_dashboard', dashboard_id=stub.id))

    assert res.status_code == HTTPStatus.NO_CONTENT
    stub.delete.assert_called_once()


@pytest.mark.use_rules_sources(_VIEW_ONLY_CONFIG)
def test_create_dashboard_requires_edit_ability(
    app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any
) -> None:
    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps({'name': 'should fail'}),
        content_type='application/json',
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED, res.data


@pytest.mark.use_rules_sources(_VIEW_ONLY_CONFIG)
def test_delete_dashboard_requires_edit_ability(
    app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any
) -> None:
    stub = _make_dashboard_stub()
    dashboard_storage.get_one_with_id.return_value = stub
    res = client.delete(url_for('dashboards.delete_dashboard', dashboard_id=stub.id))
    assert res.status_code == HTTPStatus.UNAUTHORIZED, res.data


def test_dashboard_endpoints_reject_unauthenticated(
    app: Flask, client: 'FlaskClient[Response]', dashboard_storage: Any
) -> None:
    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps({'name': 'foo'}),
        content_type='application/json',
    )
    # The default config has no abilities for the user, so this 401s before the
    # storage layer is touched.
    assert res.status_code == HTTPStatus.UNAUTHORIZED
