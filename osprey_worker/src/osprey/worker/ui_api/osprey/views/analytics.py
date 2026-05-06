"""Aggregated analytics endpoints used by the customizable dashboard.

These endpoints are thin wrappers around the existing Druid query helpers.
They expose pre-shaped responses so the dashboard widgets don't need to
re-implement Druid query construction client-side.
"""

from typing import Any, Dict, List, Optional

from flask import Blueprint, abort, jsonify
from osprey.worker.ui_api.osprey.lib.abilities import (
    CanViewEventsByAction,
    require_ability,
    require_ability_with_request,
)
from pydantic.main import BaseModel

from ..lib.auth import get_current_user
from ..lib.druid import (
    BaseDruidQuery,
    TimeseriesDruidQuery,
    TopNDruidQuery,
)
from ..lib.marshal import JsonBodyMarshaller, marshal_with

blueprint = Blueprint('analytics', __name__)


class _AnalyticsTopNQuery(BaseDruidQuery, JsonBodyMarshaller):
    dimension: str
    limit: int = 10


class _AnalyticsTimeseriesQuery(BaseDruidQuery, JsonBodyMarshaller):
    granularity: str = 'hour'


class _KpiSummary(BaseModel):
    total_events: int
    total_buckets: int
    start: str
    end: str


def _topn_to_distribution(dimension: str, response: Any) -> List[Dict[str, Any]]:
    """Flatten the TopNPoPResponse-style result into a simple list."""
    if response is None:
        return []
    current_period = getattr(response, 'current_period', None) or []
    if not current_period:
        return []

    flattened: List[Dict[str, Any]] = []
    for period in current_period:
        for item in period.result:
            value = getattr(item, dimension, None)
            if value is None:
                continue
            flattened.append({'name': str(value), 'count': int(item.count)})

    aggregated: Dict[str, int] = {}
    for entry in flattened:
        aggregated[entry['name']] = aggregated.get(entry['name'], 0) + entry['count']

    return [
        {'name': name, 'count': count} for name, count in sorted(aggregated.items(), key=lambda kv: kv[1], reverse=True)
    ]


def _topn_query(request_model: _AnalyticsTopNQuery, dimension: Optional[str] = None) -> Any:
    target_dimension = dimension or request_model.dimension
    topn_request = TopNDruidQuery(
        start=request_model.start,
        end=request_model.end,
        query_filter=request_model.query_filter,
        entity=request_model.entity,
        dimension=target_dimension,
        limit=request_model.limit,
    )
    query_filter_ability = get_current_user().get_ability(CanViewEventsByAction)
    if query_filter_ability:
        response = topn_request.execute(
            calculate_previous_period=False,
            query_filter_abilities=[query_filter_ability],
        )
    else:
        response = topn_request.execute(calculate_previous_period=False)
    if isinstance(response, ValueError):
        abort(400, str(response))
    return _topn_to_distribution(target_dimension, response)


@blueprint.route('/analytics/rule-distribution', methods=['POST'])
@marshal_with(_AnalyticsTopNQuery)
@require_ability(CanViewEventsByAction)
def rule_distribution(request_model: _AnalyticsTopNQuery) -> Any:
    """Return the distribution of rules fired in the requested window.

    The dimension defaults to ``ActionName`` (the field already indexed in
    Druid), but callers may override it with any feature name that represents
    a rule identifier (for example ``RulesFired``).
    """
    require_ability_with_request(request_model, CanViewEventsByAction)
    dimension = request_model.dimension or 'ActionName'
    distribution = _topn_query(request_model, dimension=dimension)
    return jsonify({'dimension': dimension, 'distribution': distribution})


@blueprint.route('/analytics/effects-breakdown', methods=['POST'])
@marshal_with(_AnalyticsTopNQuery)
@require_ability(CanViewEventsByAction)
def effects_breakdown(request_model: _AnalyticsTopNQuery) -> Any:
    """Return the distribution of effects triggered (BanUser, LabelAdd, etc.).

    Defaults to grouping by ``EffectName`` if the caller omits a dimension.
    """
    require_ability_with_request(request_model, CanViewEventsByAction)
    dimension = request_model.dimension or 'EffectName'
    distribution = _topn_query(request_model, dimension=dimension)
    return jsonify({'dimension': dimension, 'distribution': distribution})


@blueprint.route('/analytics/kpi-summary', methods=['POST'])
@marshal_with(_AnalyticsTimeseriesQuery)
@require_ability(CanViewEventsByAction)
def kpi_summary(request_model: _AnalyticsTimeseriesQuery) -> Any:
    """Return aggregate counts (total events / buckets) for the time window."""
    require_ability_with_request(request_model, CanViewEventsByAction)

    timeseries_request = TimeseriesDruidQuery(
        start=request_model.start,
        end=request_model.end,
        query_filter=request_model.query_filter,
        entity=request_model.entity,
        granularity=request_model.granularity,
    )

    raw_results = timeseries_request.execute() or []

    total_events = 0
    buckets = 0
    for bucket in raw_results:
        result = bucket.get('result', {}) if isinstance(bucket, dict) else {}
        if isinstance(result, dict):
            total_events += int(result.get('count', 0) or 0)
        buckets += 1

    payload = _KpiSummary(
        total_events=total_events,
        total_buckets=buckets,
        start=request_model.start.isoformat(),
        end=request_model.end.isoformat(),
    )
    return jsonify(payload.dict())
