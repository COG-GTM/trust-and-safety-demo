"""Executive dashboard endpoints.

Provides high-level analytics on flagged events, rule performance, label
activity, and pipeline health for executive/management stakeholders. Backed by
Druid SQL queries against the ``osprey.execution_results`` datasource and
Postgres queries against the labels store.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from typing import Any, Dict, List, Optional, Tuple

import requests
from flask import Blueprint, Response, jsonify, request
from osprey.worker.lib.singletons import CONFIG, ENGINE
from osprey.worker.lib.storage import postgres
from sqlalchemy import text

from ..singletons import DRUID

logger = logging.getLogger(__name__)

blueprint = Blueprint('dashboard', __name__)


# Columns that exist on every execution result and are not rule outputs. These
# are excluded when discovering candidate rule columns.
_INFRASTRUCTURE_COLUMNS = {
    '__time',
    '__timestamp',
    '__action_id',
    '__error_count',
    '__verdicts',
    '__entity_label_mutations',
    '__ban_user',
    'ActionName',
    'EventType',
    'PostText',
}


# Window string -> timedelta. Anything else is rejected to keep query patterns
# predictable / cacheable downstream.
_WINDOWS: Dict[str, timedelta] = {
    '1h': timedelta(hours=1),
    '24h': timedelta(hours=24),
    '7d': timedelta(days=7),
    '30d': timedelta(days=30),
    '90d': timedelta(days=90),
}

_GRANULARITIES: Dict[str, str] = {
    'minute': 'PT1M',
    'hour': 'PT1H',
    'day': 'P1D',
    'week': 'P1W',
}

_DEFAULT_WINDOW = '24h'
_DEFAULT_GRANULARITY = 'hour'


def _bad_request(message: str) -> Response:
    return Response(response=message, status=HTTPStatus.BAD_REQUEST, mimetype='text/plain')


def _parse_window(value: Optional[str], offset_periods: int = 0) -> Tuple[datetime, datetime, timedelta]:
    """Parse a window string ('24h', '7d', ...) into ``(start, end, duration)``.

    ``offset_periods`` shifts the window backwards by that many ``duration``s so
    callers can request the immediately-preceding period of the same length —
    e.g. ``offset_periods=1`` on ``'24h'`` returns the 24h window that ended at
    the start of the current 24h.
    """
    key = (value or _DEFAULT_WINDOW).lower()
    if key not in _WINDOWS:
        raise ValueError(f'Unknown window: {value!r}. Expected one of {sorted(_WINDOWS)}.')
    duration = _WINDOWS[key]
    end = datetime.now(timezone.utc) - duration * offset_periods
    return end - duration, end, duration


def _parse_granularity(value: Optional[str]) -> str:
    key = (value or _DEFAULT_GRANULARITY).lower()
    if key not in _GRANULARITIES:
        raise ValueError(f'Unknown granularity: {value!r}. Expected one of {sorted(_GRANULARITIES)}.')
    return _GRANULARITIES[key]


def _druid_broker_url() -> str:
    return CONFIG.instance().expect_str('DRUID_URL').rstrip('/')


def _datasource() -> str:
    return DRUID.instance().datasource


def _druid_sql(query: str, parameters: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """Execute a Druid SQL query against the broker.

    Returns the JSON-decoded list of row dicts. Druid SQL returns ``[]`` for
    queries with no results.
    """
    payload: Dict[str, Any] = {'query': query, 'resultFormat': 'object'}
    if parameters:
        payload['parameters'] = parameters

    url = f'{_druid_broker_url()}/druid/v2/sql'
    resp = requests.post(url, json=payload, timeout=60)
    if not resp.ok:
        logger.warning('Druid SQL query failed: %s\n%s', resp.status_code, resp.text)
        resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else []


def _iso(ts: datetime) -> str:
    return ts.astimezone(timezone.utc).isoformat()


def _safe_count(query: str, parameters: List[Dict[str, Any]], column: str = 'cnt') -> int:
    try:
        rows = _druid_sql(query, parameters)
    except Exception as exc:
        logger.warning('Druid query failed (returning 0): %s', exc)
        return 0
    if not rows:
        return 0
    return int(rows[0].get(column) or 0)


def _entity_feature_columns(entity_type: str) -> List[str]:
    """Return feature column names mapped to the given entity type by the engine."""
    try:
        mapping = ENGINE.instance().get_feature_name_to_entity_type_mapping()
    except Exception:
        return []
    return [name for name, et in mapping.items() if et == entity_type]


# Effect columns considered when classifying an event as 'flagged'. Not every
# datasource carries every column — we narrow the predicate to whichever ones
# actually exist so the query doesn't error on legacy / partial schemas.
_EFFECT_COLUMNS = ('__verdicts', '__entity_label_mutations', '__ban_user')


def _flagged_predicate(available_columns: Optional[set[str]] = None) -> str:
    """SQL predicate that identifies a 'flagged' event.

    An event is considered flagged when at least one engine effect was emitted:
    a verdict, a label mutation, or a ban effect. ``available_columns`` may be
    passed to restrict the predicate to columns that actually exist in the
    datasource (Druid raises on references to undeclared columns).
    """
    if available_columns is None:
        cols = list(_EFFECT_COLUMNS)
    else:
        cols = [c for c in _EFFECT_COLUMNS if c in available_columns]
    if not cols:
        return '1 = 0'
    return '(' + ' OR '.join(f'"{c}" IS NOT NULL' for c in cols) + ')'


def _count_if(predicate: str) -> str:
    """Portable equivalent of ``COUNT_IF(predicate)`` for older Druid SQL builds."""
    return f'SUM(CASE WHEN {predicate} THEN 1 ELSE 0 END)'


def _time_predicate(start: datetime, end: datetime) -> Tuple[str, List[Dict[str, Any]]]:
    return '"__time" >= ? AND "__time" < ?', [
        {'type': 'TIMESTAMP', 'value': _iso(start)},
        {'type': 'TIMESTAMP', 'value': _iso(end)},
    ]


def _datasource_columns() -> List[str]:
    """Return all column names declared for the datasource."""
    sql = 'SELECT "COLUMN_NAME" FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = \'druid\''
    try:
        rows = _druid_sql(sql, [{'type': 'VARCHAR', 'value': _datasource()}])
    except Exception as exc:
        logger.warning('Failed to discover datasource columns: %s', exc)
        return []
    return [row['COLUMN_NAME'] for row in rows if row.get('COLUMN_NAME')]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@blueprint.route('/dashboard/summary', methods=['GET'])
def get_summary() -> Any:
    """Return high-level KPIs for the requested window.

    Includes total events, flagged events, flag rate, unique flagged entities,
    label mutations applied, and a verdict breakdown.

    Pass ``offset=1`` to query the immediately-preceding window of the same
    length (used by the dashboard to compute period-over-period KPI trends).
    """
    try:
        offset = max(0, int(request.args.get('offset') or 0))
    except (TypeError, ValueError):
        return _bad_request('offset must be a non-negative integer')
    try:
        start, end, _ = _parse_window(request.args.get('window'), offset_periods=offset)
    except ValueError as e:
        return _bad_request(str(e))

    time_clause, params = _time_predicate(start, end)
    available = set(_datasource_columns())
    flagged = _flagged_predicate(available)
    ds = _datasource()

    label_expr = _count_if('"__entity_label_mutations" IS NOT NULL') if '__entity_label_mutations' in available else '0'
    error_expr = _count_if('"__error_count" > 0') if '__error_count' in available else '0'

    try:
        summary_rows = _druid_sql(
            f'''
            SELECT
                COUNT(*) AS total_events,
                {_count_if(flagged)} AS flagged_events,
                COUNT(DISTINCT CASE WHEN {flagged} THEN "UserId" END) AS unique_entities_flagged,
                {label_expr} AS label_mutations,
                {error_expr} AS error_events
            FROM "{ds}"
            WHERE {time_clause}
            ''',
            params,
        )
    except Exception as exc:
        logger.warning('Summary query failed: %s', exc)
        summary_rows = []

    row = summary_rows[0] if summary_rows else {}
    total = int(row.get('total_events') or 0)
    flagged_count = int(row.get('flagged_events') or 0)
    flag_rate = (flagged_count / total) if total > 0 else 0.0

    verdict_rows: List[Dict[str, Any]] = []
    if '__verdicts' in available:
        try:
            verdict_rows = _druid_sql(
                f'''
                SELECT "__verdicts" AS verdict, COUNT(*) AS cnt
                FROM "{ds}"
                WHERE {time_clause} AND "__verdicts" IS NOT NULL
                GROUP BY "__verdicts"
                ORDER BY cnt DESC
                ''',
                params,
            )
        except Exception as exc:
            logger.warning('Verdict breakdown query failed: %s', exc)

    return jsonify(
        {
            'window': {'start': _iso(start), 'end': _iso(end)},
            'total_events': total,
            'flagged_events': flagged_count,
            'flag_rate': flag_rate,
            'unique_entities_flagged': int(row.get('unique_entities_flagged') or 0),
            'labels_applied': int(row.get('label_mutations') or 0),
            'error_events': int(row.get('error_events') or 0),
            'verdicts_breakdown': [
                {'verdict': str(r.get('verdict') or 'unknown'), 'count': int(r.get('cnt') or 0)} for r in verdict_rows
            ],
        }
    )


@blueprint.route('/dashboard/timeseries', methods=['GET'])
def get_timeseries() -> Any:
    """Return a time-bucketed series for the requested metric."""
    try:
        start, end, _ = _parse_window(request.args.get('window'))
        granularity_period = _parse_granularity(request.args.get('granularity'))
    except ValueError as e:
        return _bad_request(str(e))

    metric = (request.args.get('metric') or 'total_events').lower()
    valid_metrics = {'total_events', 'flagged_events', 'flag_rate', 'labels_applied', 'errors'}
    if metric not in valid_metrics:
        return _bad_request(f'Unknown metric: {metric!r}. Expected one of {sorted(valid_metrics)}.')

    available = set(_datasource_columns())
    flagged = _flagged_predicate(available)
    time_clause, params = _time_predicate(start, end)
    ds = _datasource()

    if metric == 'flag_rate':
        select_expr = (
            f'CASE WHEN COUNT(*) = 0 THEN 0.0 ELSE CAST({_count_if(flagged)} AS DOUBLE) / COUNT(*) END AS value'
        )
    elif metric == 'flagged_events':
        select_expr = f'{_count_if(flagged)} AS value'
    elif metric == 'labels_applied':
        if '__entity_label_mutations' in available:
            select_expr = _count_if('"__entity_label_mutations" IS NOT NULL') + ' AS value'
        else:
            select_expr = '0 AS value'
    elif metric == 'errors':
        if '__error_count' in available:
            select_expr = _count_if('"__error_count" > 0') + ' AS value'
        else:
            select_expr = '0 AS value'
    else:
        select_expr = 'COUNT(*) AS value'

    sql = f'''
        SELECT TIME_FLOOR("__time", '{granularity_period}') AS bucket, {select_expr}
        FROM "{ds}"
        WHERE {time_clause}
        GROUP BY 1
        ORDER BY 1
    '''
    try:
        rows = _druid_sql(sql, params)
    except Exception as exc:
        logger.warning('Timeseries query failed: %s', exc)
        rows = []

    return jsonify(
        {
            'metric': metric,
            'granularity': request.args.get('granularity') or _DEFAULT_GRANULARITY,
            'window': {'start': _iso(start), 'end': _iso(end)},
            'points': [{'timestamp': str(r.get('bucket')), 'value': float(r.get('value') or 0)} for r in rows],
        }
    )


@blueprint.route('/dashboard/top-rules', methods=['GET'])
def get_top_rules() -> Any:
    """Return top N rules by match count over the time window.

    Rule columns are discovered from the datasource schema and identified as
    columns that are not infrastructure dimensions and are not entity feature
    inputs declared by the engine. Rules emit a 1/0 column per match in the
    extracted features, so ``SUM(col)`` gives the match count.
    """
    try:
        start, end, _ = _parse_window(request.args.get('window'))
    except ValueError as e:
        return _bad_request(str(e))
    limit = max(1, min(int(request.args.get('limit', 10) or 10), 100))

    feature_columns: set[str] = set()
    try:
        mapping = ENGINE.instance().get_feature_name_to_entity_type_mapping()
        feature_columns = set(mapping.keys())
    except Exception:
        pass

    candidates = [
        col
        for col in _datasource_columns()
        if col not in _INFRASTRUCTURE_COLUMNS and col not in feature_columns and not col.startswith('__')
    ]
    if not candidates:
        return jsonify({'rules': [], 'total_matches': 0})

    time_clause, params = _time_predicate(start, end)
    ds = _datasource()
    sums = ', '.join(f'SUM(CAST("{col}" AS BIGINT)) AS "{col}"' for col in candidates)
    try:
        rows = _druid_sql(
            f'SELECT {sums} FROM "{ds}" WHERE {time_clause}',
            params,
        )
    except Exception as exc:
        logger.warning('Top rules query failed: %s', exc)
        return jsonify({'rules': [], 'total_matches': 0})

    row = rows[0] if rows else {}
    raw_counts: List[Tuple[str, int]] = [(col, int(row.get(col) or 0)) for col in candidates]
    total = sum(matches for _, matches in raw_counts)
    raw_counts.sort(key=lambda item: item[1], reverse=True)
    rules: List[Dict[str, Any]] = [
        {
            'rule': col,
            'matches': matches,
            'percentage': (matches / total) if total > 0 else 0.0,
        }
        for col, matches in raw_counts[:limit]
    ]

    return jsonify({'rules': rules, 'total_matches': total})


@blueprint.route('/dashboard/top-entities', methods=['GET'])
def get_top_entities() -> Any:
    """Return top N flagged entities of the given entity type."""
    try:
        start, end, _ = _parse_window(request.args.get('window'))
    except ValueError as e:
        return _bad_request(str(e))
    limit = max(1, min(int(request.args.get('limit', 10) or 10), 100))
    entity_type = request.args.get('entity_type') or 'User'

    columns = _entity_feature_columns(entity_type)
    if not columns:
        # Fall back to UserId for the demo's default entity type.
        if entity_type == 'User':
            columns = ['UserId']
        else:
            return jsonify({'entity_type': entity_type, 'entities': []})

    time_clause, params = _time_predicate(start, end)
    flagged = _flagged_predicate(set(_datasource_columns()))
    ds = _datasource()

    coalesced = 'COALESCE(' + ', '.join(f'"{c}"' for c in columns) + ')'
    sql = f'''
        SELECT {coalesced} AS entity_id, COUNT(*) AS flag_count
        FROM "{ds}"
        WHERE {time_clause} AND {flagged} AND {coalesced} IS NOT NULL
        GROUP BY 1
        ORDER BY flag_count DESC
        LIMIT {limit}
    '''
    try:
        rows = _druid_sql(sql, params)
    except Exception as exc:
        logger.warning('Top entities query failed: %s', exc)
        rows = []

    return jsonify(
        {
            'entity_type': entity_type,
            'entities': [
                {
                    'entity_id': str(r.get('entity_id') or ''),
                    'flag_count': int(r.get('flag_count') or 0),
                }
                for r in rows
            ],
        }
    )


@blueprint.route('/dashboard/verdicts-breakdown', methods=['GET'])
def get_verdicts_breakdown() -> Any:
    """Return a stacked, time-bucketed breakdown of verdicts."""
    try:
        start, end, _ = _parse_window(request.args.get('window'))
        granularity_period = _parse_granularity(request.args.get('granularity'))
    except ValueError as e:
        return _bad_request(str(e))

    time_clause, params = _time_predicate(start, end)
    ds = _datasource()
    rows: List[Dict[str, Any]] = []
    if '__verdicts' in set(_datasource_columns()):
        sql = f'''
            SELECT
                TIME_FLOOR("__time", '{granularity_period}') AS bucket,
                "__verdicts" AS verdict,
                COUNT(*) AS cnt
            FROM "{ds}"
            WHERE {time_clause} AND "__verdicts" IS NOT NULL
            GROUP BY 1, 2
            ORDER BY 1
        '''
        try:
            rows = _druid_sql(sql, params)
        except Exception as exc:
            logger.warning('Verdicts breakdown query failed: %s', exc)
            rows = []

    return jsonify(
        {
            'granularity': request.args.get('granularity') or _DEFAULT_GRANULARITY,
            'window': {'start': _iso(start), 'end': _iso(end)},
            'points': [
                {
                    'timestamp': str(r.get('bucket')),
                    'verdict': str(r.get('verdict') or 'unknown'),
                    'count': int(r.get('cnt') or 0),
                }
                for r in rows
            ],
        }
    )


@blueprint.route('/dashboard/labels-activity', methods=['GET'])
def get_labels_activity() -> Any:
    """Return label-application activity over time.

    Counts of automated label mutations come from Druid's
    ``__entity_label_mutations`` dimension on each event. A current snapshot
    of distinct labelled entities is read from the Postgres ``entity_labels``
    table populated by ``PostgresLabelsService``.
    """
    try:
        start, end, _ = _parse_window(request.args.get('window'))
        granularity_period = _parse_granularity(request.args.get('granularity'))
    except ValueError as e:
        return _bad_request(str(e))

    time_clause, params = _time_predicate(start, end)
    ds = _datasource()

    timeseries_rows: List[Dict[str, Any]] = []
    if '__entity_label_mutations' in set(_datasource_columns()):
        sql = f'''
            SELECT
                TIME_FLOOR("__time", '{granularity_period}') AS bucket,
                COUNT(*) AS automated
            FROM "{ds}"
            WHERE {time_clause} AND "__entity_label_mutations" IS NOT NULL
            GROUP BY 1
            ORDER BY 1
        '''
        try:
            timeseries_rows = _druid_sql(sql, params)
        except Exception as exc:
            logger.warning('Label activity timeseries query failed: %s', exc)
            timeseries_rows = []

    labelled_entities = 0
    try:
        with postgres.scoped_session(database='osprey_db') as session:
            result = session.execute(text('SELECT COUNT(*) FROM entity_labels')).scalar()
            labelled_entities = int(result or 0)
    except Exception as exc:
        # The labels table may not be initialised in environments without the
        # example plugin loaded; treat as zero.
        logger.info('Label snapshot query unavailable: %s', exc)

    return jsonify(
        {
            'granularity': request.args.get('granularity') or _DEFAULT_GRANULARITY,
            'window': {'start': _iso(start), 'end': _iso(end)},
            'points': [
                {
                    'timestamp': str(r.get('bucket')),
                    'automated': int(r.get('automated') or 0),
                    'manual': 0,
                }
                for r in timeseries_rows
            ],
            'labelled_entities_total': labelled_entities,
        }
    )


@blueprint.route('/dashboard/pipeline-health', methods=['GET'])
def get_pipeline_health() -> Any:
    """Return operational metrics: throughput, error rate, latest activity."""
    try:
        start, end, duration = _parse_window(request.args.get('window'))
    except ValueError as e:
        return _bad_request(str(e))

    time_clause, params = _time_predicate(start, end)
    ds = _datasource()
    available = set(_datasource_columns())
    error_expr = _count_if('"__error_count" > 0') if '__error_count' in available else '0'

    try:
        rows = _druid_sql(
            f'''
            SELECT
                COUNT(*) AS total_events,
                {error_expr} AS error_events,
                MAX("__time") AS latest_event
            FROM "{ds}"
            WHERE {time_clause}
            ''',
            params,
        )
    except Exception as exc:
        logger.warning('Pipeline health summary query failed: %s', exc)
        rows = []
    row = rows[0] if rows else {}
    total = int(row.get('total_events') or 0)
    errors = int(row.get('error_events') or 0)
    minutes = max(1.0, duration.total_seconds() / 60.0)
    events_per_minute = total / minutes
    error_rate = (errors / total) if total > 0 else 0.0

    try:
        throughput_rows = _druid_sql(
            f'''
            SELECT TIME_FLOOR("__time", 'PT1M') AS bucket,
                   COUNT(*) AS events,
                   {error_expr} AS errors
            FROM "{ds}"
            WHERE {time_clause}
            GROUP BY 1
            ORDER BY 1
            ''',
            params,
        )
    except Exception as exc:
        logger.warning('Pipeline health throughput query failed: %s', exc)
        throughput_rows = []

    return jsonify(
        {
            'window': {'start': _iso(start), 'end': _iso(end)},
            'total_events': total,
            'error_events': errors,
            'events_per_minute': events_per_minute,
            'error_rate': error_rate,
            'latest_event': str(row.get('latest_event')) if row.get('latest_event') else None,
            'throughput': [
                {
                    'timestamp': str(r.get('bucket')),
                    'events': int(r.get('events') or 0),
                    'errors': int(r.get('errors') or 0),
                }
                for r in throughput_rows
            ],
        }
    )
