"""Analytics endpoints powering the customizable dashboards.

These endpoints are thin convenience wrappers around the existing Druid query
infrastructure (in :mod:`osprey.worker.ui_api.osprey.lib.druid`) plus a small
amount of Postgres aggregation for entity-label data. They are designed to be
generic enough that new dashboard widget types can be added on the frontend
without further backend work for most cases.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from http.client import BAD_REQUEST
from typing import Any, Dict, List

from flask import Blueprint, abort, jsonify, request
from osprey.worker.ui_api.osprey.lib.abilities import (
    CanViewAnalytics,
    CanViewEventsByAction,
    CanViewEventsByEntity,
    require_ability,
    require_ability_with_request,
)
from osprey.worker.ui_api.osprey.lib.druid import (
    BaseDruidQuery,
    TimeseriesDruidQuery,
    TopNDruidQuery,
)
from osprey.worker.ui_api.osprey.lib.marshal import marshal_with
from sqlalchemy import text

from ..lib.auth import get_current_user

logger = logging.getLogger(__name__)

blueprint = Blueprint('analytics', __name__)


def _parse_iso_datetime(value: str, *, field: str) -> datetime:
    try:
        # ``fromisoformat`` accepts both naive and offset-aware ISO strings.
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (TypeError, ValueError):
        abort(BAD_REQUEST, f'Invalid ISO 8601 datetime in field "{field}": {value!r}')


def _parse_time_range_from_request(payload: Dict[str, Any]) -> tuple[datetime, datetime]:
    start_raw = payload.get('start')
    end_raw = payload.get('end')
    if not start_raw or not end_raw:
        # Fall back to last 24h.
        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=24)
        return start, end
    return _parse_iso_datetime(start_raw, field='start'), _parse_iso_datetime(end_raw, field='end')


@blueprint.route('/analytics/timeseries', methods=['POST'])
@marshal_with(TimeseriesDruidQuery)
@require_ability(CanViewAnalytics)
def timeseries(request_model: TimeseriesDruidQuery) -> Any:
    """Counts of execution-result events bucketed over time.

    Body matches :class:`TimeseriesDruidQuery`: ``start``, ``end``, ``query_filter``,
    ``granularity`` and an optional ``entity``. ``query_filter`` is the existing
    SML query language; pass an empty string for "all events".
    """
    # CanViewEventsByEntity._request_is_allowed returns False for null-entity
    # queries, so only enforce the entity check when the caller is actually
    # entity-scoping. Dashboard widgets always send entity=null and rely on
    # CanViewAnalytics + CanViewEventsByAction (below) for authorization.
    if request_model.entity is not None:
        require_ability_with_request(request_model, CanViewEventsByEntity)
    # Honor CanViewEventsByAction: scope Druid filter to actions the caller is permitted to see.
    query_filter_ability = get_current_user().get_ability(CanViewEventsByAction)
    try:
        if query_filter_ability:
            return jsonify(request_model.execute(query_filter_abilities=[query_filter_ability]))
        return jsonify(request_model.execute())
    except ValueError as e:
        # ``_query_with_filter`` raises ValueError when ``start > end``; surface
        # that to the caller as a 400 instead of leaking a 500.
        abort(BAD_REQUEST, str(e))


@blueprint.route('/analytics/groupby', methods=['POST'])
@marshal_with(TopNDruidQuery)
@require_ability(CanViewAnalytics)
def groupby_dimension(request_model: TopNDruidQuery) -> Any:
    """Top-N counts grouped by a single Druid dimension over a time range.

    Reuses :class:`TopNDruidQuery`; supports period-over-period comparison via the
    same response shape as ``/api/events/topn``.
    """
    # Same rationale as ``timeseries``: only enforce the entity check when the
    # caller is entity-scoping; dashboard widgets always send entity=null.
    if request_model.entity is not None:
        require_ability_with_request(request_model, CanViewEventsByEntity)
    query_filter_ability = get_current_user().get_ability(CanViewEventsByAction)

    try:
        if query_filter_ability:
            result = request_model.execute(query_filter_abilities=[query_filter_ability])
        else:
            result = request_model.execute()
    except ValueError as e:
        # ``_query_with_filter`` raises ValueError when ``start > end``; surface
        # that to the caller as a 400 instead of leaking a 500.
        abort(BAD_REQUEST, str(e))

    return jsonify(result.dict())


def _summary_groupby(payload: Dict[str, Any], dimension: str, default_limit: int = 25) -> Any:
    """Helper that runs a :class:`TopNDruidQuery` for a fixed dimension."""
    start, end = _parse_time_range_from_request(payload)
    base = BaseDruidQuery(
        start=start,
        end=end,
        query_filter=payload.get('query_filter', ''),
        entity=None,
    )
    limit = int(payload.get('limit', default_limit))
    top_n = TopNDruidQuery(dimension=dimension, limit=limit, **base.dict())

    query_filter_ability = get_current_user().get_ability(CanViewEventsByAction)
    try:
        if query_filter_ability:
            result = top_n.execute(
                query_filter_abilities=[query_filter_ability],
                calculate_previous_period=False,
            )
        else:
            result = top_n.execute(calculate_previous_period=False)
    except ValueError as e:
        # ``_query_with_filter`` raises ValueError when ``start > end``; surface
        # that to the caller as a 400 instead of leaking a 500.
        abort(BAD_REQUEST, str(e))

    return jsonify(result.dict())


@blueprint.route('/analytics/verdicts/summary', methods=['POST'])
@require_ability(CanViewAnalytics)
def verdicts_summary() -> Any:
    """Distribution of verdicts (allow/block/flag/etc.) over the time range."""
    payload = request.get_json(silent=True) or {}
    dimension = payload.get('dimension', 'Verdict')
    return _summary_groupby(payload, dimension=dimension, default_limit=20)


@blueprint.route('/analytics/rules/performance', methods=['POST'])
@require_ability(CanViewAnalytics)
def rules_performance() -> Any:
    """Per-rule hit counts ordered by frequency.

    The default dimension ``RuleName`` matches the field emitted by the rule
    engine's execution-result sink. Override via ``dimension`` in the body when
    your deployment uses a different field name.
    """
    payload = request.get_json(silent=True) or {}
    dimension = payload.get('dimension', 'RuleName')
    return _summary_groupby(payload, dimension=dimension, default_limit=50)


@blueprint.route('/analytics/throughput', methods=['POST'])
@require_ability(CanViewAnalytics)
def throughput() -> Any:
    """Events per granularity bucket — used by the throughput gauge / time-series."""
    payload = request.get_json(silent=True) or {}
    start, end = _parse_time_range_from_request(payload)
    granularity = payload.get('granularity', 'minute')

    timeseries_query = TimeseriesDruidQuery(
        start=start,
        end=end,
        query_filter=payload.get('query_filter', ''),
        entity=None,
        granularity=granularity,
    )

    # Honor CanViewEventsByAction: scope Druid filter to actions the caller is permitted to see.
    query_filter_ability = get_current_user().get_ability(CanViewEventsByAction)
    try:
        if query_filter_ability:
            return jsonify(timeseries_query.execute(query_filter_abilities=[query_filter_ability]))
        return jsonify(timeseries_query.execute())
    except ValueError as e:
        # ``_query_with_filter`` raises ValueError when ``start > end``; surface
        # that to the caller as a 400 instead of leaking a 500.
        abort(BAD_REQUEST, str(e))


@blueprint.route('/analytics/labels/summary', methods=['GET'])
@require_ability(CanViewAnalytics)
def labels_summary() -> Any:
    """Aggregations over the Postgres ``entity_labels`` table.

    Returns total entity count, top label names with counts, and recent label
    activity. Gracefully degrades if the table or DB session is unavailable.
    """
    limit = int(request.args.get('limit', 25))
    empty_payload: Dict[str, Any] = {'total_entities': 0, 'top_labels': [], 'recent': []}

    try:
        from osprey.worker.lib.storage.postgres import scoped_session
    except Exception:
        logger.exception('Could not import postgres session helper')
        return jsonify(empty_payload)

    try:
        with scoped_session() as session:
            # Skip if the table isn't present in this deployment (e.g. labels
            # service is using a non-Postgres backend).
            has_table = session.execute(text("SELECT to_regclass('public.entity_labels') IS NOT NULL")).scalar()
            if not has_table:
                return jsonify(empty_payload)

            total = session.execute(text('SELECT COUNT(*) FROM entity_labels')).scalar() or 0

            top_labels_rows = session.execute(
                text(
                    """
                    SELECT label_name, COUNT(*) AS cnt
                    FROM (
                        SELECT jsonb_object_keys(labels->'labels') AS label_name
                        FROM entity_labels
                    ) AS expanded
                    GROUP BY label_name
                    ORDER BY cnt DESC
                    LIMIT :limit
                    """
                ),
                {'limit': limit},
            ).fetchall()

            recent_rows = session.execute(
                text(
                    """
                    SELECT entity_key, labels
                    FROM entity_labels
                    ORDER BY entity_key DESC
                    LIMIT :limit
                    """
                ),
                {'limit': limit},
            ).fetchall()
    except Exception:
        logger.exception('Failed to query entity_labels for analytics summary')
        return jsonify(empty_payload)

    top_labels: List[Dict[str, Any]] = [
        {'label_name': row.label_name, 'count': int(row.cnt)} for row in top_labels_rows
    ]

    recent: List[Dict[str, Any]] = []
    for row in recent_rows:
        # ``EntityLabels.serialize()`` wraps the per-entity label map under a
        # top-level ``labels`` key (see osprey_shared/labels.py:384), so the
        # JSONB column shape is ``{"labels": {"<label_name>": {...}}}``. The
        # ``top_labels`` query above already unwraps with
        # ``jsonb_object_keys(labels->'labels')``; we apply the same unwrap here
        # so the frontend's ``Object.keys(row.labels)`` returns the actual
        # label names instead of the literal ``["labels"]`` wrapper key. Older
        # rows that may have been written without the wrapper are passed
        # through unchanged.
        labels_raw: Any = row.labels if isinstance(row.labels, dict) else {}
        labels_inner = labels_raw.get('labels') if isinstance(labels_raw, dict) else None
        labels_json: Any = labels_inner if isinstance(labels_inner, dict) else labels_raw
        recent.append({'entity_key': row.entity_key, 'labels': labels_json})

    return jsonify({'total_entities': int(total), 'top_labels': top_labels, 'recent': recent})


@blueprint.route('/analytics/execution-results', methods=['GET'])
@require_ability(CanViewAnalytics)
def execution_results() -> Any:
    """Generic pass-through aggregator over the execution_results datasource.

    Accepts the same query parameters as the other ``/analytics`` endpoints but
    via query string for easy browser/CLI testing. Always uses the all-events
    filter and the requested granularity; falls back to a 24h timeseries.
    """
    args = request.args
    payload = {
        'start': args.get('start'),
        'end': args.get('end'),
        'query_filter': args.get('query_filter', ''),
        'granularity': args.get('granularity', 'hour'),
    }
    start, end = _parse_time_range_from_request(payload)

    timeseries_query = TimeseriesDruidQuery(
        start=start,
        end=end,
        query_filter=payload['query_filter'],
        entity=None,
        granularity=payload['granularity'],
    )
    # Honor CanViewEventsByAction: scope Druid filter to actions the caller is permitted to see.
    query_filter_ability = get_current_user().get_ability(CanViewEventsByAction)
    try:
        if query_filter_ability:
            points = timeseries_query.execute(query_filter_abilities=[query_filter_ability])
        else:
            points = timeseries_query.execute()
    except ValueError as e:
        # ``_query_with_filter`` raises ValueError when ``start > end``; surface
        # that to the caller as a 400 instead of leaking a 500.
        abort(BAD_REQUEST, str(e))

    summary = {'total': 0, 'points': len(points) if isinstance(points, list) else 0}
    if isinstance(points, list):
        for point in points:
            try:
                summary['total'] += int(point.get('result', {}).get('count', 0))
            except (AttributeError, TypeError, ValueError):
                continue

    return jsonify({'summary': summary, 'points': points})
