"""CRUD endpoints for analytics dashboards."""

from http.client import BAD_REQUEST, NO_CONTENT, NOT_FOUND
from typing import Any, Dict, List

from flask import Blueprint, Response, abort, jsonify, request
from osprey.worker.lib.storage.dashboards import Dashboard
from osprey.worker.ui_api.osprey.lib.abilities import (
    CanCreateAndEditDashboards,
    CanViewDashboards,
    require_ability,
)

from ..lib.auth import get_current_user_email

blueprint = Blueprint('dashboards', __name__)


def _validate_layout(layout_json: Any) -> Dict[str, Any]:
    """Light-touch validation of the layout JSON.

    Full structural validation lives on the frontend. We just guard against
    obvious shape issues so a stray request can't write garbage that crashes
    later reads.
    """
    if layout_json is None:
        return {'widgets': [], 'version': 1}
    if not isinstance(layout_json, dict):
        abort(BAD_REQUEST, 'layout_json must be a JSON object')
    widgets = layout_json.get('widgets', [])
    if not isinstance(widgets, list):
        abort(BAD_REQUEST, 'layout_json.widgets must be an array')
    return layout_json


@blueprint.route('/dashboards', methods=['POST'])
@require_ability(CanCreateAndEditDashboards)
def create_dashboard() -> Any:
    request_data = request.get_json() or {}

    name = (request_data.get('name') or '').strip()
    if not name:
        abort(BAD_REQUEST, 'name is required')

    dashboard = Dashboard()
    dashboard.name = name
    dashboard.owner = get_current_user_email()
    dashboard.description = request_data.get('description')
    dashboard.layout_json = _validate_layout(request_data.get('layout_json'))
    dashboard.is_template = bool(request_data.get('is_template', False))

    dashboard.insert()
    return jsonify(dashboard.serialize())


@blueprint.route('/dashboards/<dashboard_id>', methods=['GET'])
@require_ability(CanViewDashboards)
def get_dashboard(dashboard_id: int) -> Any:
    dashboard = Dashboard.get_one_with_id(int(dashboard_id))
    if dashboard is None:
        abort(NOT_FOUND, 'Dashboard not found')
    return jsonify(dashboard.serialize())


@blueprint.route('/dashboards/<dashboard_id>', methods=['PATCH', 'PUT'])
@require_ability(CanCreateAndEditDashboards)
def update_dashboard(dashboard_id: int) -> Any:
    dashboard = Dashboard.get_one_with_id(int(dashboard_id))
    if dashboard is None:
        abort(NOT_FOUND, 'Dashboard not found')

    request_data = request.get_json() or {}
    if 'name' in request_data:
        new_name = (request_data['name'] or '').strip()
        if not new_name:
            abort(BAD_REQUEST, 'name cannot be empty')
        dashboard.name = new_name
    if 'description' in request_data:
        dashboard.description = request_data['description']
    if 'layout_json' in request_data:
        dashboard.layout_json = _validate_layout(request_data['layout_json'])
    if 'is_template' in request_data:
        dashboard.is_template = bool(request_data['is_template'])

    dashboard.save()
    return jsonify(dashboard.serialize())


@blueprint.route('/dashboards', methods=['GET'])
@require_ability(CanViewDashboards)
def list_dashboards() -> Any:
    user_email = request.args.get('user_email')

    dashboards: List[Dashboard]
    if user_email:
        dashboards = Dashboard.get_all_for_user(user_email=user_email)
    else:
        dashboards = Dashboard.get_all()

    return jsonify([dashboard.serialize() for dashboard in dashboards])


@blueprint.route('/dashboards/<dashboard_id>', methods=['DELETE'])
@require_ability(CanCreateAndEditDashboards)
def delete_dashboard(dashboard_id: int) -> Any:
    dashboard = Dashboard.get_one_with_id(int(dashboard_id))
    if dashboard is None:
        abort(NOT_FOUND, 'Dashboard not found')

    dashboard.delete()
    # Per RFC 7231 §6.3.5, a 204 response MUST NOT include a message body.
    return Response(status=NO_CONTENT)
