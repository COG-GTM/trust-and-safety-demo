"""Dashboard views.

Aggregation endpoints that power the operator-facing Dashboard, Rule
Performance, and Entity Investigation experiences.

These endpoints query Druid against the ``osprey.execution_results``
datasource using the same client/query patterns established in
:mod:`osprey.worker.ui_api.osprey.lib.druid`.
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from flask import Blueprint, abort, jsonify
from osprey.worker.ui_api.osprey.lib.abilities import (
    CanViewEventsByEntity,
    require_ability,
    require_ability_with_request,
)
from pydantic.main import BaseModel
from pydruid.query import QueryBuilder

from ..lib.druid import (
    DEFAULT_DRUID_QUERY_TIMEOUT,
    BaseDruidQuery,
    DruidQueryTypes,
    EntityFilter,
    parse_query_filter,
)
from ..lib.marshal import JsonBodyMarshaller, marshal_with
from ..singletons import DRUID

logger = logging.getLogger(__name__)
blueprint = Blueprint('dashboard', __name__)

# Druid dimensions emitted by the engine for rule-effect bookkeeping.  Empty
# (null) values mean "no rule effect of this kind fired for the event."
LABEL_MUTATIONS_DIMENSION = '__entity_label_mutations'
BAN_USER_DIMENSION = '__ban_user'
ERROR_COUNT_DIMENSION = '__error_count'

# How many recent alerts to return at most.
DEFAULT_RECENT_ALERTS_LIMIT = 25
MAX_RECENT_ALERTS_LIMIT = 200

# How many top labels / verdicts to return for distribution charts.
DEFAULT_TOPN_LIMIT = 10


# ---------------------------------------------------------------------------
# Druid helpers
# ---------------------------------------------------------------------------


def _not_null_filter(dimension: str) -> Dict[str, Any]:
    """Returns a Druid filter that matches rows where ``dimension`` is not null."""
    return {
        'type': 'not',
        'field': {'type': 'selector', 'dimension': dimension, 'value': None},
    }


def _filtered_count(name: str, filter_: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'type': 'filtered',
        'filter': filter_,
        'aggregator': {'type': 'count', 'name': name},
    }


def _build_query(
    query_type: DruidQueryTypes,
    start: datetime,
    end: datetime,
    *,
    user_filter: Optional[Dict[str, Any]] = None,
    entity: Optional[EntityFilter] = None,
    extra_filter: Optional[Dict[str, Any]] = None,
    **kwargs: Any,
) -> Any:
    """Build and execute a Druid query with the standard timeout/datasource.

    Combines an optional user-provided query filter, an optional entity scope,
    and an optional extra filter into a single Druid filter clause.
    """
    if start > end:
        raise ValueError('start must be before end')

    context = kwargs.setdefault('context', {})
    context.setdefault('timeout', DEFAULT_DRUID_QUERY_TIMEOUT)

    druid = DRUID.instance()

    built_query = QueryBuilder().build_query(
        query_type.value,
        {
            'datasource': druid.datasource,
            'intervals': f'{start.isoformat()}/{end.isoformat()}',
            **kwargs,
        },
    )

    filters: List[Dict[str, Any]] = []
    if entity is not None:
        # ``EntityFilter.wrap_filter`` returns either a standalone entity-or
        # filter or a combined and-filter (when ``user_filter`` is provided).
        wrapped = entity.wrap_filter(user_filter)
        filters.append(wrapped)
    elif user_filter is not None:
        filters.append(user_filter['filter'])

    if extra_filter is not None:
        filters.append(extra_filter)

    if filters:
        assert built_query.query_dict is not None
        if len(filters) == 1:
            built_query.query_dict['filter'] = filters[0]
        else:
            built_query.query_dict['filter'] = {'type': 'and', 'fields': filters}

    result = druid.client._post(built_query)
    assert result.result_json
    return json.loads(result.result_json)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class DashboardSummaryRequest(BaseDruidQuery):
    """Aggregation request for top-level dashboard metric cards."""

    granularity: str = 'hour'


class RulePerformanceRequest(BaseDruidQuery):
    """Aggregation request for the Rule Performance panel."""

    granularity: str = 'hour'
    top_n: int = DEFAULT_TOPN_LIMIT


class LabelActivityRequest(BaseDruidQuery):
    granularity: str = 'hour'
    top_n: int = DEFAULT_TOPN_LIMIT


class VerdictDistributionRequest(BaseDruidQuery):
    top_n: int = DEFAULT_TOPN_LIMIT


class RecentAlertsRequest(BaseDruidQuery):
    limit: int = DEFAULT_RECENT_ALERTS_LIMIT


class EntityProfileRequest(BaseModel, JsonBodyMarshaller):
    entity_type: str
    entity_id: str
    lookback_hours: int = 24
    recent_event_limit: int = 20


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class TimeseriesPoint(BaseModel):
    timestamp: str
    value: int


class MetricSeries(BaseModel):
    total: int
    points: List[TimeseriesPoint]


class SummaryResponse(BaseModel):
    events: MetricSeries
    rules_fired: MetricSeries
    labels_applied: MetricSeries
    verdicts_issued: MetricSeries


class RuleHitRow(BaseModel):
    rule_key: str
    label_name: Optional[str]
    entity_type: Optional[str]
    current_count: int
    previous_count: int
    difference: int
    percentage_change: Optional[float]


class RuleHitTimeseriesPoint(BaseModel):
    timestamp: str
    rule_key: str
    count: int


class RulePerformanceResponse(BaseModel):
    rules: List[RuleHitRow]
    series: List[RuleHitTimeseriesPoint]
    false_positive_rate: Optional[float]


class LabelActivityPoint(BaseModel):
    timestamp: str
    label_name: str
    added: int
    removed: int


class LabelActivityResponse(BaseModel):
    points: List[LabelActivityPoint]
    label_names: List[str]


class VerdictBucket(BaseModel):
    verdict: str
    count: int


class VerdictDistributionResponse(BaseModel):
    buckets: List[VerdictBucket]
    total: int


class RecentAlert(BaseModel):
    timestamp: str
    action_id: int
    action_name: Optional[str]
    user_id: Optional[str]
    rule_effects: List[str]
    verdicts: List[str]


class RecentAlertsResponse(BaseModel):
    alerts: List[RecentAlert]


class EntityLabelEntry(BaseModel):
    label_name: str
    status: str
    count: int


class EntityActivityPoint(BaseModel):
    timestamp: str
    count: int


class EntityProfileResponse(BaseModel):
    entity_type: str
    entity_id: str
    rules_triggered: int
    labels_applied: int
    verdicts_issued: int
    label_breakdown: List[EntityLabelEntry]
    activity: List[EntityActivityPoint]
    related_entities: Dict[str, List[str]]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize_timestamp(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _decode_string_array(raw: Any) -> List[str]:
    """Druid surfaces array-typed dimensions as either a list, a JSON-encoded
    string, or ``None``.  Normalize all forms into a list of strings.
    """
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(item) for item in raw if item is not None]
    if isinstance(raw, str):
        stripped = raw.strip()
        if not stripped:
            return []
        if stripped.startswith('['):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed if item is not None]
            except json.JSONDecodeError:
                logger.debug('Failed to JSON-decode array dimension: %r', raw)
        return [stripped]
    return [str(raw)]


def _parse_label_mutation(raw: str) -> Dict[str, Optional[str]]:
    """Parse a label-mutation dimension value of the form
    ``"<EntityType>/<LabelName>/<LabelStatus>"``.

    ``LabelStatus`` is the integer enum value defined in
    :class:`osprey.worker.lib.osprey_shared.labels.LabelStatus`.
    """
    parts = raw.split('/')
    entity_type = parts[0] if len(parts) > 0 else None
    label_name = parts[1] if len(parts) > 1 else None
    status = parts[2] if len(parts) > 2 else None
    return {'entity_type': entity_type, 'label_name': label_name, 'status': status}


# Mapping from the integer enum values stored in
# ``__entity_label_mutations`` to human-friendly status names.  We map status
# names, not the LabelStatus enum directly, so we don't pull in protobuf at
# import time and so we can render a readable status to the UI.
LABEL_STATUS_NAMES: Dict[str, str] = {
    '0': 'unknown',
    '1': 'added',
    '2': 'removed',
    '3': 'expired',
    '4': 'manually_added',
    '5': 'manually_removed',
}

# Statuses that count as a label addition vs. removal for the Label Activity
# chart.  Anything not listed is bucketed as ``other``.
ADDITION_STATUSES = {'1', '4'}
REMOVAL_STATUSES = {'2', '3', '5'}


def _ts_points_from_druid(rows: List[Dict[str, Any]], metric: str) -> List[TimeseriesPoint]:
    out: List[TimeseriesPoint] = []
    for row in rows:
        result = row.get('result') or {}
        out.append(
            TimeseriesPoint(
                timestamp=_normalize_timestamp(row.get('timestamp')),
                value=int(result.get(metric, 0) or 0),
            )
        )
    return out


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@blueprint.route('/dashboard/summary', methods=['POST'])
@marshal_with(DashboardSummaryRequest)
@require_ability(CanViewEventsByEntity)
def dashboard_summary(request_model: DashboardSummaryRequest) -> Any:
    """Return aggregated dashboard counters and 24h-style sparkline data.

    All four metrics (events, rules fired, labels applied, verdicts) are
    computed in a single Druid query via filtered aggregators so we issue
    a single round-trip even when callers want sparklines.
    """
    require_ability_with_request(request_model, CanViewEventsByEntity)

    user_filter = parse_query_filter(request_model.query_filter)
    aggregations: Dict[str, Any] = {
        'events': {'type': 'count', 'name': 'events'},
        'rules_fired': _filtered_count(
            'rules_fired',
            {
                'type': 'or',
                'fields': [
                    _not_null_filter(LABEL_MUTATIONS_DIMENSION),
                    _not_null_filter(BAN_USER_DIMENSION),
                ],
            },
        ),
        'labels_applied': _filtered_count('labels_applied', _not_null_filter(LABEL_MUTATIONS_DIMENSION)),
        'verdicts_issued': _filtered_count('verdicts_issued', _not_null_filter(BAN_USER_DIMENSION)),
    }

    rows = _build_query(
        DruidQueryTypes.TIMESERIES,
        request_model.start,
        request_model.end,
        user_filter=user_filter,
        entity=request_model.entity,
        granularity=request_model.granularity,
        aggregations=aggregations,
    )

    events_points = _ts_points_from_druid(rows, 'events')
    rules_points = _ts_points_from_druid(rows, 'rules_fired')
    labels_points = _ts_points_from_druid(rows, 'labels_applied')
    verdicts_points = _ts_points_from_druid(rows, 'verdicts_issued')

    response = SummaryResponse(
        events=MetricSeries(
            total=sum(p.value for p in events_points),
            points=events_points,
        ),
        rules_fired=MetricSeries(
            total=sum(p.value for p in rules_points),
            points=rules_points,
        ),
        labels_applied=MetricSeries(
            total=sum(p.value for p in labels_points),
            points=labels_points,
        ),
        verdicts_issued=MetricSeries(
            total=sum(p.value for p in verdicts_points),
            points=verdicts_points,
        ),
    )
    return jsonify(response.dict())


@blueprint.route('/dashboard/rule-performance', methods=['POST'])
@marshal_with(RulePerformanceRequest)
@require_ability(CanViewEventsByEntity)
def dashboard_rule_performance(request_model: RulePerformanceRequest) -> Any:
    """Return per-rule (label-mutation) hit counts plus a stacked time series.

    Rule identity is derived from the ``__entity_label_mutations`` dimension,
    which has the form ``EntityType/LabelName/Status``. Each unique
    ``EntityType/LabelName`` is treated as a "rule key" — i.e. a distinct
    place where a rule emitted an effect.

    Period-over-period comparison uses the immediately preceding window of the
    same length and is best-effort: failures degrade to current-period only.
    """
    require_ability_with_request(request_model, CanViewEventsByEntity)
    user_filter = parse_query_filter(request_model.query_filter)

    period = request_model.end - request_model.start
    previous_start = request_model.start - period
    previous_end = request_model.start

    # 1) Top labels-applied groupBy for the current window.
    current_rows = _build_query(
        DruidQueryTypes.GROUP_BY,
        request_model.start,
        request_model.end,
        user_filter=user_filter,
        entity=request_model.entity,
        extra_filter=_not_null_filter(LABEL_MUTATIONS_DIMENSION),
        dimensions=[LABEL_MUTATIONS_DIMENSION],
        granularity='all',
        aggregations={'count': {'type': 'count', 'name': 'count'}},
        limit_spec={
            'type': 'default',
            'limit': max(1, request_model.top_n),
            'columns': [{'dimension': 'count', 'direction': 'descending'}],
        },
    )

    current_counts: Counter[str] = Counter()
    for row in current_rows:
        event = row.get('event') or {}
        raw = event.get(LABEL_MUTATIONS_DIMENSION)
        for value in _decode_string_array(raw):
            parsed = _parse_label_mutation(value)
            rule_key = f'{parsed["entity_type"] or "?"}/{parsed["label_name"] or "?"}'
            current_counts[rule_key] += int(event.get('count', 0) or 0)

    # 2) Same query for the previous period so we can compute deltas.
    previous_counts: Counter[str] = Counter()
    try:
        previous_rows = _build_query(
            DruidQueryTypes.GROUP_BY,
            previous_start,
            previous_end,
            user_filter=user_filter,
            entity=request_model.entity,
            extra_filter=_not_null_filter(LABEL_MUTATIONS_DIMENSION),
            dimensions=[LABEL_MUTATIONS_DIMENSION],
            granularity='all',
            aggregations={'count': {'type': 'count', 'name': 'count'}},
        )
        for row in previous_rows:
            event = row.get('event') or {}
            raw = event.get(LABEL_MUTATIONS_DIMENSION)
            for value in _decode_string_array(raw):
                parsed = _parse_label_mutation(value)
                rule_key = f'{parsed["entity_type"] or "?"}/{parsed["label_name"] or "?"}'
                previous_counts[rule_key] += int(event.get('count', 0) or 0)
    except Exception:
        logger.warning('Previous-period rule-performance query failed', exc_info=True)

    rules: List[RuleHitRow] = []
    for rule_key, current in current_counts.most_common(request_model.top_n):
        prev = previous_counts.get(rule_key, 0)
        diff = current - prev
        pct: Optional[float] = (diff / prev * 100.0) if prev else None
        entity_type, _, label_name = rule_key.partition('/')
        rules.append(
            RuleHitRow(
                rule_key=rule_key,
                label_name=label_name or None,
                entity_type=entity_type or None,
                current_count=current,
                previous_count=prev,
                difference=diff,
                percentage_change=pct,
            )
        )

    # 3) Build a stacked time series of the top-N rule keys over time.
    series: List[RuleHitTimeseriesPoint] = []
    if rules:
        ts_rows = _build_query(
            DruidQueryTypes.TIMESERIES,
            request_model.start,
            request_model.end,
            user_filter=user_filter,
            entity=request_model.entity,
            extra_filter=_not_null_filter(LABEL_MUTATIONS_DIMENSION),
            granularity=request_model.granularity,
            aggregations={'count': {'type': 'count', 'name': 'count'}},
        )
        # We don't have per-rule aggregation in the timeseries (Druid would
        # need a topN-per-bucket query); approximate by distributing the bucket
        # count proportionally to current-window rule weights.  This is good
        # enough for an at-a-glance trend chart.
        total_current = sum(current_counts.values()) or 1
        weights = {row.rule_key: row.current_count / total_current for row in rules}
        for row in ts_rows:
            ts = _normalize_timestamp(row.get('timestamp'))
            count_val = int((row.get('result') or {}).get('count', 0) or 0)
            for rule_key, weight in weights.items():
                series.append(
                    RuleHitTimeseriesPoint(
                        timestamp=ts,
                        rule_key=rule_key,
                        count=int(round(count_val * weight)),
                    )
                )

    # 4) False-positive heuristic: ratio of "trusted"/"verified"-style label
    # additions to total rule fires in the period. ``trusted`` and
    # ``verified`` are conventional "this entity was previously flagged but
    # later cleared" markers in T&S systems.  If neither is present this is
    # ``None``.
    trusted_keys = {key for key in current_counts if key.endswith('/trusted') or key.endswith('/verified')}
    if trusted_keys:
        trusted_total = sum(current_counts[key] for key in trusted_keys)
        total = sum(current_counts.values())
        false_positive_rate = (trusted_total / total) if total else None
    else:
        false_positive_rate = None

    response = RulePerformanceResponse(
        rules=rules,
        series=series,
        false_positive_rate=false_positive_rate,
    )
    return jsonify(response.dict())


@blueprint.route('/dashboard/label-activity', methods=['POST'])
@marshal_with(LabelActivityRequest)
@require_ability(CanViewEventsByEntity)
def dashboard_label_activity(request_model: LabelActivityRequest) -> Any:
    """Return label additions/removals over time grouped by label name."""
    require_ability_with_request(request_model, CanViewEventsByEntity)
    user_filter = parse_query_filter(request_model.query_filter)

    rows = _build_query(
        DruidQueryTypes.GROUP_BY,
        request_model.start,
        request_model.end,
        user_filter=user_filter,
        entity=request_model.entity,
        extra_filter=_not_null_filter(LABEL_MUTATIONS_DIMENSION),
        dimensions=[LABEL_MUTATIONS_DIMENSION],
        granularity=request_model.granularity,
        aggregations={'count': {'type': 'count', 'name': 'count'}},
    )

    # bucket: timestamp -> label_name -> {added, removed}
    buckets: Dict[str, Dict[str, Dict[str, int]]] = {}
    label_totals: Counter[str] = Counter()

    for row in rows:
        ts = _normalize_timestamp(row.get('timestamp'))
        event = row.get('event') or {}
        count_val = int(event.get('count', 0) or 0)
        raw = event.get(LABEL_MUTATIONS_DIMENSION)
        for value in _decode_string_array(raw):
            parsed = _parse_label_mutation(value)
            label_name = parsed['label_name'] or 'unknown'
            status = parsed['status'] or ''
            ts_bucket = buckets.setdefault(ts, {})
            label_bucket = ts_bucket.setdefault(label_name, {'added': 0, 'removed': 0})
            if status in ADDITION_STATUSES:
                label_bucket['added'] += count_val
            elif status in REMOVAL_STATUSES:
                label_bucket['removed'] += count_val
            label_totals[label_name] += count_val

    top_labels = [name for name, _ in label_totals.most_common(request_model.top_n)]
    top_label_set = set(top_labels)

    points: List[LabelActivityPoint] = []
    for ts in sorted(buckets):
        for label_name, counts in buckets[ts].items():
            if label_name not in top_label_set:
                continue
            points.append(
                LabelActivityPoint(
                    timestamp=ts,
                    label_name=label_name,
                    added=counts['added'],
                    removed=counts['removed'],
                )
            )

    return jsonify(LabelActivityResponse(points=points, label_names=top_labels).dict())


@blueprint.route('/dashboard/verdict-distribution', methods=['POST'])
@marshal_with(VerdictDistributionRequest)
@require_ability(CanViewEventsByEntity)
def dashboard_verdict_distribution(request_model: VerdictDistributionRequest) -> Any:
    """Return a breakdown of verdict types for the requested time window.

    Verdict types are derived from the ``__ban_user`` dimension and from the
    rule-fire/no-rule-fire split. ``allow`` here means "an event was processed
    but no ban verdict was emitted"; ``ban`` means "at least one ban verdict
    was emitted on this event".
    """
    require_ability_with_request(request_model, CanViewEventsByEntity)
    user_filter = parse_query_filter(request_model.query_filter)

    rows = _build_query(
        DruidQueryTypes.TIMESERIES,
        request_model.start,
        request_model.end,
        user_filter=user_filter,
        entity=request_model.entity,
        granularity='all',
        aggregations={
            'allow': _filtered_count(
                'allow',
                {
                    'type': 'selector',
                    'dimension': BAN_USER_DIMENSION,
                    'value': None,
                },
            ),
            'ban': _filtered_count('ban', _not_null_filter(BAN_USER_DIMENSION)),
            'errors': _filtered_count(
                'errors',
                {
                    'type': 'bound',
                    'dimension': ERROR_COUNT_DIMENSION,
                    'lower': '1',
                    'lowerStrict': False,
                    'ordering': 'numeric',
                },
            ),
        },
    )

    buckets: List[VerdictBucket] = []
    total = 0
    if rows:
        result = rows[0].get('result') or {}
        for verdict in ('allow', 'ban', 'errors'):
            value = int(result.get(verdict, 0) or 0)
            buckets.append(VerdictBucket(verdict=verdict, count=value))
            total += value

    return jsonify(VerdictDistributionResponse(buckets=buckets, total=total).dict())


@blueprint.route('/dashboard/recent-alerts', methods=['POST'])
@marshal_with(RecentAlertsRequest)
@require_ability(CanViewEventsByEntity)
def dashboard_recent_alerts(request_model: RecentAlertsRequest) -> Any:
    """Return the most recent rule-triggered effects (bans + label mutations)."""
    require_ability_with_request(request_model, CanViewEventsByEntity)
    user_filter = parse_query_filter(request_model.query_filter)

    limit = max(1, min(MAX_RECENT_ALERTS_LIMIT, request_model.limit))

    rows = _build_query(
        DruidQueryTypes.SCAN,
        request_model.start,
        request_model.end,
        user_filter=user_filter,
        entity=request_model.entity,
        extra_filter={
            'type': 'or',
            'fields': [
                _not_null_filter(LABEL_MUTATIONS_DIMENSION),
                _not_null_filter(BAN_USER_DIMENSION),
            ],
        },
        order='descending',
        limit=limit,
        columns=[
            '__time',
            '__action_id',
            'ActionName',
            'UserId',
            LABEL_MUTATIONS_DIMENSION,
            BAN_USER_DIMENSION,
        ],
        resultFormat='compactedList',
    )

    alerts: List[RecentAlert] = []
    if rows:
        for row in rows:
            columns: List[str] = row.get('columns') or []
            for event_row in row.get('events') or []:
                values = dict(zip(columns, event_row))
                ts_raw = values.get('__time')
                if isinstance(ts_raw, (int, float)):
                    ts = datetime.fromtimestamp(int(ts_raw) / 1000, tz=timezone.utc).isoformat()
                else:
                    ts = _normalize_timestamp(ts_raw)
                action_id = int(values.get('__action_id') or 0)
                rule_effects = _decode_string_array(values.get(LABEL_MUTATIONS_DIMENSION))
                verdicts = _decode_string_array(values.get(BAN_USER_DIMENSION))
                alerts.append(
                    RecentAlert(
                        timestamp=ts,
                        action_id=action_id,
                        action_name=values.get('ActionName'),
                        user_id=values.get('UserId'),
                        rule_effects=rule_effects,
                        verdicts=verdicts,
                    )
                )

    return jsonify(RecentAlertsResponse(alerts=alerts[:limit]).dict())


@blueprint.route('/entity/<entity_type>/<entity_id>/profile', methods=['GET'])
def entity_profile(entity_type: str, entity_id: str) -> Any:
    """Return a compact profile for an entity used by the Entity Investigation panel.

    Aggregates labels applied, verdicts issued, rules triggered, an activity
    timeline, and a list of related entities (other entity types observed in
    actions involving this entity).
    """
    if not entity_type or not entity_id:
        return abort(400, 'entity_type and entity_id are required')

    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=24)
    entity = EntityFilter(id=entity_id, type=entity_type, feature_filters=None)

    aggregations = {
        'rules_triggered': _filtered_count(
            'rules_triggered',
            {
                'type': 'or',
                'fields': [
                    _not_null_filter(LABEL_MUTATIONS_DIMENSION),
                    _not_null_filter(BAN_USER_DIMENSION),
                ],
            },
        ),
        'labels_applied': _filtered_count('labels_applied', _not_null_filter(LABEL_MUTATIONS_DIMENSION)),
        'verdicts_issued': _filtered_count('verdicts_issued', _not_null_filter(BAN_USER_DIMENSION)),
        'count': {'type': 'count', 'name': 'count'},
    }

    activity_rows = _build_query(
        DruidQueryTypes.TIMESERIES,
        start,
        end,
        entity=entity,
        granularity='hour',
        aggregations=aggregations,
    )

    activity_points: List[EntityActivityPoint] = []
    rules_triggered = 0
    labels_applied = 0
    verdicts_issued = 0

    for row in activity_rows:
        ts = _normalize_timestamp(row.get('timestamp'))
        result = row.get('result') or {}
        bucket_count = int(result.get('count', 0) or 0)
        rules_triggered += int(result.get('rules_triggered', 0) or 0)
        labels_applied += int(result.get('labels_applied', 0) or 0)
        verdicts_issued += int(result.get('verdicts_issued', 0) or 0)
        activity_points.append(EntityActivityPoint(timestamp=ts, count=bucket_count))

    # Per-label breakdown
    label_counts: Counter[str] = Counter()
    label_status_counts: Dict[str, Counter[str]] = {}
    label_rows = _build_query(
        DruidQueryTypes.GROUP_BY,
        start,
        end,
        entity=entity,
        extra_filter=_not_null_filter(LABEL_MUTATIONS_DIMENSION),
        dimensions=[LABEL_MUTATIONS_DIMENSION],
        granularity='all',
        aggregations={'count': {'type': 'count', 'name': 'count'}},
    )
    for row in label_rows:
        event = row.get('event') or {}
        raw = event.get(LABEL_MUTATIONS_DIMENSION)
        count_val = int(event.get('count', 0) or 0)
        for value in _decode_string_array(raw):
            parsed = _parse_label_mutation(value)
            label_name = parsed['label_name'] or 'unknown'
            status = LABEL_STATUS_NAMES.get(parsed['status'] or '', parsed['status'] or 'unknown')
            label_counts[label_name] += count_val
            label_status_counts.setdefault(label_name, Counter())[status] += count_val

    label_breakdown: List[EntityLabelEntry] = []
    for label_name, total in label_counts.most_common():
        for status, count in label_status_counts[label_name].most_common():
            label_breakdown.append(EntityLabelEntry(label_name=label_name, status=status, count=count))

    # Related entities: pull a few recent rows for this entity and surface any
    # entity-typed values we observe (UserId, EventType, ActionName, etc.).
    related_entities: Dict[str, List[str]] = {}
    try:
        scan_rows = _build_query(
            DruidQueryTypes.SCAN,
            start,
            end,
            entity=entity,
            order='descending',
            limit=20,
            columns=['ActionName', 'UserId', 'EventType'],
            resultFormat='compactedList',
        )
        related_buckets: Dict[str, set[str]] = {}
        if scan_rows:
            for row in scan_rows:
                columns: List[str] = row.get('columns') or []
                for event_row in row.get('events') or []:
                    values = dict(zip(columns, event_row))
                    for key in ('UserId', 'ActionName', 'EventType'):
                        v = values.get(key)
                        if v and (key != entity_type or str(v) != str(entity_id)):
                            related_buckets.setdefault(key, set()).add(str(v))
        related_entities = {k: sorted(v)[:10] for k, v in related_buckets.items()}
    except Exception:
        logger.warning('Failed to load related entities for %s/%s', entity_type, entity_id, exc_info=True)
        related_entities = {}

    response = EntityProfileResponse(
        entity_type=entity_type,
        entity_id=entity_id,
        rules_triggered=rules_triggered,
        labels_applied=labels_applied,
        verdicts_issued=verdicts_issued,
        label_breakdown=label_breakdown,
        activity=activity_points,
        related_entities=related_entities,
    )
    return jsonify(response.dict())
