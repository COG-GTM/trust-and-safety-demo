import json
from http import HTTPStatus
from typing import Any

import pytest
from flask import Flask, Response, url_for
from flask.testing import FlaskClient

config = {
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

view_only_config = {
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

pytestmark = pytest.mark.use_rules_sources(config)


def _create_dashboard(client: 'FlaskClient[Response]', name: str = 'My Dashboard', layout: Any = None) -> dict:
    layout = layout if layout is not None else {'widgets': [], 'rgl': []}
    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps({'name': name, 'layout_json': layout}),
        content_type='application/json',
    )
    assert res.status_code == HTTPStatus.OK
    return res.json


def test_create_dashboard(app: Flask, client: 'FlaskClient[Response]') -> None:
    layout = {
        'widgets': [
            {'id': 'w1', 'type': 'kpi', 'config': {'window': '24h'}},
        ],
        'rgl': [{'i': 'w1', 'x': 0, 'y': 0, 'w': 4, 'h': 3}],
    }
    payload = _create_dashboard(client, name='Trust Overview', layout=layout)

    assert payload['name'] == 'Trust Overview'
    assert payload['created_by'] == 'local-dev@localhost'
    assert payload['layout_json'] == layout
    assert int(payload['id']) > 0
    assert payload['created_at'] is not None
    assert payload['updated_at'] is not None


def test_create_dashboard_rejects_missing_name(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps({'layout_json': {}}),
        content_type='application/json',
    )
    assert res.status_code == HTTPStatus.BAD_REQUEST


def test_create_dashboard_rejects_invalid_layout(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps({'name': 'Bad', 'layout_json': 'not-an-object'}),
        content_type='application/json',
    )
    assert res.status_code == HTTPStatus.BAD_REQUEST


def test_get_dashboard_round_trip(app: Flask, client: 'FlaskClient[Response]') -> None:
    created = _create_dashboard(client, name='Round Trip')

    res = client.get(url_for('dashboards.get_dashboard', dashboard_id=created['id']))
    assert res.status_code == HTTPStatus.OK
    assert res.json['id'] == created['id']
    assert res.json['name'] == 'Round Trip'


def test_get_missing_dashboard_returns_404(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.get(url_for('dashboards.get_dashboard', dashboard_id=1))
    assert res.status_code == HTTPStatus.NOT_FOUND


def test_update_dashboard_layout(app: Flask, client: 'FlaskClient[Response]') -> None:
    created = _create_dashboard(client, name='Initial')

    new_layout = {
        'widgets': [{'id': 'w1', 'type': 'time_series', 'config': {}}],
        'rgl': [{'i': 'w1', 'x': 0, 'y': 0, 'w': 6, 'h': 4}],
    }
    res = client.put(
        url_for('dashboards.update_dashboard', dashboard_id=created['id']),
        data=json.dumps({'name': 'Renamed', 'layout_json': new_layout}),
        content_type='application/json',
    )

    assert res.status_code == HTTPStatus.OK
    assert res.json['id'] == created['id']
    assert res.json['name'] == 'Renamed'
    assert res.json['layout_json'] == new_layout


def test_update_missing_dashboard_returns_404(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.put(
        url_for('dashboards.update_dashboard', dashboard_id=1),
        data=json.dumps({'name': 'X'}),
        content_type='application/json',
    )
    assert res.status_code == HTTPStatus.NOT_FOUND


def test_delete_dashboard(app: Flask, client: 'FlaskClient[Response]') -> None:
    created = _create_dashboard(client, name='Delete me')

    delete_res = client.delete(url_for('dashboards.delete_dashboard', dashboard_id=created['id']))
    assert delete_res.status_code == HTTPStatus.NO_CONTENT

    follow_up = client.get(url_for('dashboards.get_dashboard', dashboard_id=created['id']))
    assert follow_up.status_code == HTTPStatus.NOT_FOUND


def test_get_all_dashboards_filters_by_creator(app: Flask, client: 'FlaskClient[Response]') -> None:
    _create_dashboard(client, name='dash-A')
    _create_dashboard(client, name='dash-B')

    res = client.get(url_for('dashboards.get_all_dashboards'))
    assert res.status_code == HTTPStatus.OK
    assert isinstance(res.json, list)
    names = {entry['name'] for entry in res.json}
    assert {'dash-A', 'dash-B'}.issubset(names)

    filtered = client.get(
        url_for('dashboards.get_all_dashboards'),
        query_string={'created_by': 'local-dev@localhost'},
    )
    assert filtered.status_code == HTTPStatus.OK
    assert all(entry['created_by'] == 'local-dev@localhost' for entry in filtered.json)


@pytest.mark.use_rules_sources({'main.sml': '', 'config.yaml': json.dumps({'acl': {'users': {}}})})
def test_dashboards_require_view_ability(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.get(url_for('dashboards.get_all_dashboards'))
    assert res.status_code == HTTPStatus.UNAUTHORIZED
    assert res.data.decode('utf-8') == "User `local-dev@localhost` doesn't have ability `CAN_VIEW_DASHBOARDS`"


@pytest.mark.use_rules_sources({'main.sml': '', 'config.yaml': json.dumps({'acl': {'users': {}}})})
def test_dashboards_require_view_ability_for_get_one(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.get(url_for('dashboards.get_dashboard', dashboard_id=1))
    assert res.status_code == HTTPStatus.UNAUTHORIZED


@pytest.mark.use_rules_sources(view_only_config)
def test_dashboards_create_requires_edit_ability(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.post(
        url_for('dashboards.create_dashboard'),
        data=json.dumps({'name': 'forbidden', 'layout_json': {}}),
        content_type='application/json',
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED
    assert (
        res.data.decode('utf-8') == "User `local-dev@localhost` doesn't have ability `CAN_CREATE_AND_EDIT_DASHBOARDS`"
    )


@pytest.mark.use_rules_sources(view_only_config)
def test_dashboards_update_requires_edit_ability(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.put(
        url_for('dashboards.update_dashboard', dashboard_id=1),
        data=json.dumps({'name': 'forbidden'}),
        content_type='application/json',
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED


@pytest.mark.use_rules_sources(view_only_config)
def test_dashboards_delete_requires_edit_ability(app: Flask, client: 'FlaskClient[Response]') -> None:
    res = client.delete(url_for('dashboards.delete_dashboard', dashboard_id=1))
    assert res.status_code == HTTPStatus.UNAUTHORIZED
