"""Query layer over the dashboard_event_metrics Postgres table.

All public functions accept (start, end) windows and return plain dicts /
lists that routers wrap in Pydantic schemas. Errors are caught and logged,
returning empty results so the dashboard degrades gracefully when Postgres
is offline or the metrics table is empty.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..db import get_dict_cursor, table_exists

logger = logging.getLogger(__name__)

_TABLE = 'dashboard_event_metrics'


def _safe_cursor():  # type: ignore[no-untyped-def]
    """Returns a cursor only if the metrics table exists; otherwise None."""
    if not table_exists(_TABLE):
        return None
    return get_dict_cursor()


def _normalize_window(start: Optional[datetime], end: Optional[datetime], hours: int) -> Tuple[datetime, datetime]:
    if end is None:
        end = datetime.now(timezone.utc)
    if start is None:
        start = end - timedelta(hours=hours)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return start, end


def get_summary(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    hours: int = 24,
) -> Dict[str, Any]:
    start, end = _normalize_window(start, end, hours)
    base = {
        'start': start,
        'end': end,
        'total_events': 0,
        'total_flagged': 0,
        'total_dropped': 0,
        'avg_latency_ms': None,
        'p95_latency_ms': None,
        'error_count': 0,
    }
    if not table_exists(_TABLE):
        return base
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    COUNT(*)::bigint AS total_events,
                    COUNT(*) FILTER (
                        WHERE (verdict IS NOT NULL AND lower(verdict) NOT IN ('allow', 'noop', 'none'))
                           OR cardinality(coalesce(effects, ARRAY[]::text[])) > 0
                    )::bigint AS total_flagged,
                    COUNT(*) FILTER (WHERE had_errors)::bigint AS error_count,
                    AVG(execution_duration_ms) AS avg_latency_ms,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_duration_ms) AS p95_latency_ms
                FROM {_TABLE}
                WHERE timestamp >= %s AND timestamp < %s
                """,
                (start, end),
            )
            row = cur.fetchone() or {}
            base.update(
                {
                    'total_events': int(row.get('total_events') or 0),
                    'total_flagged': int(row.get('total_flagged') or 0),
                    'error_count': int(row.get('error_count') or 0),
                    'avg_latency_ms': _maybe_float(row.get('avg_latency_ms')),
                    'p95_latency_ms': _maybe_float(row.get('p95_latency_ms')),
                }
            )
    except Exception as e:
        logger.warning('get_summary failed: %s', e)
    return base


def get_timeline(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    hours: int = 24,
    bucket: str = 'hour',
) -> Dict[str, Any]:
    start, end = _normalize_window(start, end, hours)
    bucket = bucket if bucket in {'minute', 'hour', 'day'} else 'hour'
    points: List[Dict[str, Any]] = []
    if not table_exists(_TABLE):
        return {'start': start, 'end': end, 'bucket': bucket, 'points': points}
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    date_trunc(%s, timestamp) AS bucket,
                    COUNT(*)::bigint AS total,
                    COUNT(*) FILTER (
                        WHERE (verdict IS NOT NULL AND lower(verdict) NOT IN ('allow', 'noop', 'none'))
                           OR cardinality(coalesce(effects, ARRAY[]::text[])) > 0
                    )::bigint AS flagged,
                    COUNT(*) FILTER (WHERE had_errors)::bigint AS errors
                FROM {_TABLE}
                WHERE timestamp >= %s AND timestamp < %s
                GROUP BY 1
                ORDER BY 1 ASC
                """,
                (bucket, start, end),
            )
            for row in cur.fetchall():
                points.append(
                    {
                        'bucket': row['bucket'],
                        'total': int(row['total']),
                        'flagged': int(row['flagged']),
                        'dropped': 0,  # drop is sampling-only; not stored in metrics rows
                        'errors': int(row['errors']),
                    }
                )
    except Exception as e:
        logger.warning('get_timeline failed: %s', e)
    return {'start': start, 'end': end, 'bucket': bucket, 'points': points}


def get_rule_stats(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    hours: int = 24,
) -> Dict[str, Any]:
    start, end = _normalize_window(start, end, hours)
    payload = {'start': start, 'end': end, 'total_events': 0, 'rules': []}
    if not table_exists(_TABLE):
        return payload
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(*)::bigint AS total
                FROM {_TABLE}
                WHERE timestamp >= %s AND timestamp < %s
                """,
                (start, end),
            )
            row = cur.fetchone() or {}
            payload['total_events'] = int(row.get('total') or 0)

            cur.execute(
                f"""
                SELECT
                    rule AS rule_name,
                    COUNT(*)::bigint AS match_count,
                    AVG(execution_duration_ms) AS avg_execution_time_ms,
                    MAX(timestamp) AS last_triggered
                FROM (
                    SELECT unnest(matched_rules) AS rule, execution_duration_ms, timestamp
                    FROM {_TABLE}
                    WHERE timestamp >= %s AND timestamp < %s
                ) AS exploded
                GROUP BY rule
                ORDER BY match_count DESC
                LIMIT 200
                """,
                (start, end),
            )
            total = max(payload['total_events'], 1)
            rules: List[Dict[str, Any]] = []
            for r in cur.fetchall():
                count = int(r['match_count'])
                rules.append(
                    {
                        'rule_name': r['rule_name'],
                        'match_count': count,
                        'match_rate': count / total,
                        'avg_execution_time_ms': _maybe_float(r['avg_execution_time_ms']),
                        'last_triggered': r['last_triggered'],
                    }
                )
            payload['rules'] = rules
    except Exception as e:
        logger.warning('get_rule_stats failed: %s', e)
    return payload


def get_verdict_breakdown(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    hours: int = 24,
) -> Dict[str, Any]:
    start, end = _normalize_window(start, end, hours)
    payload: Dict[str, Any] = {'start': start, 'end': end, 'total': 0, 'breakdown': []}
    if not table_exists(_TABLE):
        return payload
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f"""
                SELECT COALESCE(verdict, 'unknown') AS verdict, COUNT(*)::bigint AS count
                FROM {_TABLE}
                WHERE timestamp >= %s AND timestamp < %s
                GROUP BY 1
                ORDER BY count DESC
                """,
                (start, end),
            )
            rows = cur.fetchall()
            total = sum(int(r['count']) for r in rows)
            payload['total'] = total
            payload['breakdown'] = [{'verdict': r['verdict'], 'count': int(r['count'])} for r in rows]
    except Exception as e:
        logger.warning('get_verdict_breakdown failed: %s', e)
    return payload


def get_effects_summary(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    hours: int = 24,
) -> Dict[str, Any]:
    start, end = _normalize_window(start, end, hours)
    payload: Dict[str, Any] = {'start': start, 'end': end, 'total': 0, 'effects': []}
    if not table_exists(_TABLE):
        return payload
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f"""
                SELECT effect AS effect_type, COUNT(*)::bigint AS count
                FROM (
                    SELECT unnest(effects) AS effect
                    FROM {_TABLE}
                    WHERE timestamp >= %s AND timestamp < %s
                ) e
                GROUP BY 1
                ORDER BY count DESC
                """,
                (start, end),
            )
            rows = cur.fetchall()
            payload['total'] = sum(int(r['count']) for r in rows)
            payload['effects'] = [{'effect_type': r['effect_type'], 'count': int(r['count'])} for r in rows]
    except Exception as e:
        logger.warning('get_effects_summary failed: %s', e)
    return payload


def get_recent_errors(limit: int = 50) -> List[Dict[str, Any]]:
    if not table_exists(_TABLE):
        return []
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f"""
                SELECT action_id, action_name, timestamp
                FROM {_TABLE}
                WHERE had_errors
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [
                {
                    'action_id': int(r['action_id']),
                    'action_name': r['action_name'],
                    'timestamp': r['timestamp'],
                }
                for r in cur.fetchall()
            ]
    except Exception as e:
        logger.warning('get_recent_errors failed: %s', e)
        return []


def get_pipeline_health(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    hours: int = 1,
) -> Dict[str, Any]:
    start, end = _normalize_window(start, end, hours)
    base: Dict[str, Any] = {
        'start': start,
        'end': end,
        'throughput_per_sec': 0.0,
        'p50_latency_ms': None,
        'p95_latency_ms': None,
        'p99_latency_ms': None,
        'drop_rate': 0.0,
        'error_rate': 0.0,
    }
    if not table_exists(_TABLE):
        return base
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    COUNT(*)::bigint AS total,
                    COUNT(*) FILTER (WHERE had_errors)::bigint AS errors,
                    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY execution_duration_ms) AS p50,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_duration_ms) AS p95,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_duration_ms) AS p99,
                    AVG(CASE WHEN sample_rate IS NULL THEN 0 ELSE sample_rate END) AS avg_sample_rate
                FROM {_TABLE}
                WHERE timestamp >= %s AND timestamp < %s
                """,
                (start, end),
            )
            row = cur.fetchone() or {}
            total = int(row.get('total') or 0)
            errors = int(row.get('errors') or 0)
            seconds = max((end - start).total_seconds(), 1.0)
            base['throughput_per_sec'] = total / seconds if seconds > 0 else 0.0
            base['p50_latency_ms'] = _maybe_float(row.get('p50'))
            base['p95_latency_ms'] = _maybe_float(row.get('p95'))
            base['p99_latency_ms'] = _maybe_float(row.get('p99'))
            base['error_rate'] = (errors / total) if total else 0.0
            avg_sample_rate = _maybe_float(row.get('avg_sample_rate'))
            if avg_sample_rate is not None:
                # sample_rate is the % chance of being dropped, expressed 0..100
                base['drop_rate'] = max(min(avg_sample_rate / 100.0, 1.0), 0.0)
    except Exception as e:
        logger.warning('get_pipeline_health failed: %s', e)
    return base


def list_flagged_events(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    hours: int = 24,
    page: int = 1,
    page_size: int = 25,
    action_name: Optional[str] = None,
    verdict: Optional[str] = None,
    rule: Optional[str] = None,
    effect: Optional[str] = None,
    flagged_only: bool = True,
) -> Dict[str, Any]:
    start, end = _normalize_window(start, end, hours)
    page = max(page, 1)
    page_size = max(min(page_size, 200), 1)
    payload: Dict[str, Any] = {
        'start': start,
        'end': end,
        'page': page,
        'page_size': page_size,
        'total': 0,
        'events': [],
    }
    if not table_exists(_TABLE):
        return payload

    where = ['timestamp >= %s', 'timestamp < %s']
    params: List[Any] = [start, end]
    if flagged_only:
        where.append(
            "((verdict IS NOT NULL AND lower(verdict) NOT IN ('allow', 'noop', 'none'))"
            ' OR cardinality(coalesce(effects, ARRAY[]::text[])) > 0)'
        )
    if action_name:
        where.append('action_name = %s')
        params.append(action_name)
    if verdict:
        where.append('lower(verdict) = lower(%s)')
        params.append(verdict)
    if rule:
        where.append('%s = ANY(matched_rules)')
        params.append(rule)
    if effect:
        where.append('%s = ANY(effects)')
        params.append(effect)

    where_clause = ' AND '.join(where)
    offset = (page - 1) * page_size

    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f'SELECT COUNT(*)::bigint AS c FROM {_TABLE} WHERE {where_clause}',
                params,
            )
            row = cur.fetchone() or {}
            payload['total'] = int(row.get('c') or 0)

            cur.execute(
                f"""
                SELECT
                    action_id,
                    action_name,
                    timestamp,
                    verdict,
                    matched_rules,
                    effects,
                    had_errors,
                    execution_duration_ms,
                    sample_rate
                FROM {_TABLE}
                WHERE {where_clause}
                ORDER BY timestamp DESC
                LIMIT %s OFFSET %s
                """,
                [*params, page_size, offset],
            )
            events: List[Dict[str, Any]] = []
            for r in cur.fetchall():
                events.append(
                    {
                        'action_id': int(r['action_id']),
                        'action_name': r['action_name'],
                        'timestamp': r['timestamp'],
                        'verdict': r['verdict'],
                        'matched_rules': list(r['matched_rules'] or []),
                        'effects': list(r['effects'] or []),
                        'had_errors': bool(r['had_errors']),
                        'execution_duration_ms': _maybe_float(r['execution_duration_ms']),
                        'sample_rate': r['sample_rate'],
                    }
                )
            payload['events'] = events
    except Exception as e:
        logger.warning('list_flagged_events failed: %s', e)
    return payload


def get_event_metrics(action_id: int) -> Optional[Dict[str, Any]]:
    if not table_exists(_TABLE):
        return None
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                f"""
                SELECT *
                FROM {_TABLE}
                WHERE action_id = %s
                ORDER BY timestamp DESC
                LIMIT 1
                """,
                (action_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                'action_id': int(row['action_id']),
                'action_name': row['action_name'],
                'timestamp': row['timestamp'],
                'verdict': row['verdict'],
                'matched_rules': list(row['matched_rules'] or []),
                'effects': list(row['effects'] or []),
                'execution_duration_ms': _maybe_float(row['execution_duration_ms']),
                'sample_rate': row['sample_rate'],
                'had_errors': bool(row['had_errors']),
            }
    except Exception as e:
        logger.warning('get_event_metrics failed: %s', e)
        return None


def _maybe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
