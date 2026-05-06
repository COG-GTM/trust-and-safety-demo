from http.client import BAD_REQUEST, NO_CONTENT, NOT_FOUND
from typing import Any

from flask import Blueprint, Response, abort, jsonify, request
from osprey.worker.lib.storage.dashboards import Dashboard

from ..lib.auth import get_current_user_email

blueprint = Blueprint('dashboards', __name__)


def _parse_dashboard_id(dashboard_id: str) -> int:
    try:
        return int(dashboard_id)
    except (TypeError, ValueError):
        abort(BAD_REQUEST, 'Invalid dashboard id')


@blueprint.route('/dashboards', methods=['GET'])
def get_all_dashboards() -> Any:
    created_by = request.args.get('created_by')
    dashboards = Dashboard.get_all(created_by=created_by)
    return jsonify([dashboard.serialize() for dashboard in dashboards])


@blueprint.route('/dashboards/<dashboard_id>', methods=['GET'])
def get_dashboard(dashboard_id: str) -> Any:
    dashboard = Dashboard.get_one_with_id(_parse_dashboard_id(dashboard_id))
    if dashboard is None:
        abort(NOT_FOUND, 'Dashboard not found')
    return jsonify(dashboard.serialize())


@blueprint.route('/dashboards', methods=['POST'])
def create_dashboard() -> Any:
    request_data = request.get_json(force=True) or {}

    name = request_data.get('name')
    if not name or not isinstance(name, str):
        abort(BAD_REQUEST, 'Dashboard name is required')

    layout_json = request_data.get('layout_json') or {}
    if not isinstance(layout_json, dict):
        abort(BAD_REQUEST, 'layout_json must be an object')

    dashboard = Dashboard()
    dashboard.name = name
    dashboard.created_by = get_current_user_email()
    dashboard.layout_json = layout_json
    dashboard.insert(commit=True)

    return jsonify(dashboard.serialize())


@blueprint.route('/dashboards/<dashboard_id>', methods=['PUT'])
def update_dashboard(dashboard_id: str) -> Any:
    dashboard = Dashboard.get_one_with_id(_parse_dashboard_id(dashboard_id))
    if dashboard is None:
        abort(NOT_FOUND, 'Dashboard not found')

    request_data = request.get_json(force=True) or {}

    name = request_data.get('name')
    if name is not None:
        if not isinstance(name, str) or not name:
            abort(BAD_REQUEST, 'Dashboard name must be a non-empty string')
        dashboard.name = name

    if 'layout_json' in request_data:
        layout_json = request_data['layout_json']
        if not isinstance(layout_json, dict):
            abort(BAD_REQUEST, 'layout_json must be an object')
        dashboard.layout_json = layout_json

    dashboard.save(commit=True)
    return jsonify(dashboard.serialize())


@blueprint.route('/dashboards/<dashboard_id>', methods=['DELETE'])
def delete_dashboard(dashboard_id: str) -> Any:
    dashboard = Dashboard.get_one_with_id(_parse_dashboard_id(dashboard_id))
    if dashboard is None:
        abort(NOT_FOUND, 'Dashboard not found')

    dashboard.delete(commit=True)
    return Response(status=NO_CONTENT)
