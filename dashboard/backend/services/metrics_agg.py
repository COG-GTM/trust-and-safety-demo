"""Pipeline metrics aggregator.

Reads from the ``pipeline_metrics`` table written by the new
``DashboardMetricsOutputSink`` (see
``osprey_worker/src/osprey/worker/sinks/sink/metrics_output_sink.py``). When
the table doesn't exist yet (sink disabled, or first run) every method
returns an empty / zeroed result so the dashboard keeps rendering.

We intentionally avoid talking to Datadog / StatsD directly — the sink stores
everything we need in Postgres, which is already available to the dashboard.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from ..config import Settings

logger = logging.getLogger(__name__)


def _percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = (len(values) - 1) * pct
    lower = math.floor(k)
    upper = math.ceil(k)
    if lower == upper:
        return float(values[int(k)])
    weight = k - lower
    return float(values[lower] * (1 - weight) + values[upper] * weight)


class MetricsAggregator:
    """Read-only Postgres client for the ``pipeline_metrics`` table."""

    def __init__(self, settings: Settings, engine: Optional[Engine] = None) -> None:
        self._settings = settings
        self._engine: Engine = engine or create_engine(
            settings.postgres_url,
            pool_pre_ping=True,
            pool_size=2,
            max_overflow=4,
            future=True,
        )

    def dispose(self) -> None:
        self._engine.dispose()

    # ------------------------------------------------------------------

    def _table_available(self) -> bool:
        try:
            with self._engine.connect() as conn:
                conn.execute(text('SELECT 1 FROM pipeline_metrics LIMIT 1'))
            return True
        except Exception:
            return False

    def _fetch_rows(self, start: datetime, end: datetime) -> List[Dict[str, Any]]:
        if not self._table_available():
            return []
        try:
            with self._engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT timestamp, action_name, verdict, rules_triggered,
                               execution_time_ms, has_errors, sample_rate
                        FROM pipeline_metrics
                        WHERE timestamp BETWEEN :start AND :end
                        ORDER BY timestamp DESC
                        LIMIT 50000
                        """
                    ),
                    {'start': start, 'end': end},
                )
                rows: List[Dict[str, Any]] = []
                for row in result:
                    rows.append(
                        {
                            'timestamp': row[0],
                            'action_name': row[1],
                            'verdict': row[2],
                            'rules_triggered': row[3] or [],
                            'execution_time_ms': float(row[4] or 0),
                            'has_errors': bool(row[5]),
                            'sample_rate': int(row[6] or 100),
                        }
                    )
                return rows
        except Exception as exc:
            logger.info('pipeline_metrics fetch failed: %s', exc)
            return []

    # ------------------------------------------------------------------
    # Public analytics
    # ------------------------------------------------------------------

    def health_summary(
        self, start: datetime, end: datetime
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Return (summary, latency_buckets, throughput_ts, error_ts)."""
        rows = self._fetch_rows(start, end)
        total = len(rows)
        elapsed_seconds = max((end - start).total_seconds(), 1.0)
        throughput_eps = total / elapsed_seconds
        errors = sum(1 for r in rows if r['has_errors'])
        avg_latency = sum(r['execution_time_ms'] for r in rows) / total if total else None
        # ``sample_rate`` is a 0-100 number where 0 = always-sampled and
        # 100 = never-sampled, so the implied drop ratio per row is
        # ``sample_rate / 100``. The demo data uses 0/100 only, but this
        # generalises to per-action sampling configs.
        drops = sum(r['sample_rate'] / 100.0 for r in rows)
        denom = total + drops
        drop_rate = drops / denom if denom else 0.0
        error_rate = errors / total if total else 0.0

        summary = {
            'throughput_eps': throughput_eps,
            'drop_rate': drop_rate,
            'error_rate': error_rate,
            'avg_latency_ms': avg_latency,
            'total_handled': total,
        }

        # Bucket into 10 buckets across the window for time-series charts
        bucket_count = 10
        bucket_seconds = max(elapsed_seconds / bucket_count, 1.0)
        buckets: List[Dict[str, Any]] = []
        for i in range(bucket_count):
            bucket_start = start + timedelta(seconds=bucket_seconds * i)
            bucket_end = bucket_start + timedelta(seconds=bucket_seconds)
            bucket_rows = [r for r in rows if bucket_start <= r['timestamp'] < bucket_end]
            latencies = [r['execution_time_ms'] for r in bucket_rows]
            buckets.append(
                {
                    'timestamp': bucket_start,
                    'count': len(bucket_rows),
                    'errors': sum(1 for r in bucket_rows if r['has_errors']),
                    'p50': _percentile(latencies, 0.5),
                    'p95': _percentile(latencies, 0.95),
                    'p99': _percentile(latencies, 0.99),
                }
            )

        latency = [
            {
                'timestamp': b['timestamp'],
                'p50_ms': b['p50'],
                'p95_ms': b['p95'],
                'p99_ms': b['p99'],
            }
            for b in buckets
        ]
        throughput = [{'timestamp': b['timestamp'], 'value': b['count'] / max(bucket_seconds, 1.0)} for b in buckets]
        error_ts = [{'timestamp': b['timestamp'], 'value': float(b['errors'])} for b in buckets]
        return summary, latency, throughput, error_ts

    def recent_errors(self, limit: int = 20) -> List[Dict[str, Any]]:
        if not self._table_available():
            return []
        try:
            with self._engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT timestamp, action_id, action_name, error_message
                        FROM pipeline_metrics
                        WHERE has_errors = TRUE
                        ORDER BY timestamp DESC
                        LIMIT :limit
                        """
                    ),
                    {'limit': limit},
                )
                return [
                    {
                        'timestamp': row[0],
                        'action_id': int(row[1]) if row[1] is not None else None,
                        'action_name': row[2],
                        'message': row[3] or '',
                    }
                    for row in result
                ]
        except Exception as exc:
            logger.info('recent_errors fetch failed: %s', exc)
            return []

    def rule_metrics(self, start: datetime, end: datetime) -> List[Dict[str, Any]]:
        rows = self._fetch_rows(start, end)
        per_rule_count: Dict[str, int] = {}
        per_rule_latency: Dict[str, List[float]] = {}
        per_rule_last_seen: Dict[str, datetime] = {}
        per_rule_actions: Dict[str, Dict[str, int]] = {}

        for row in rows:
            for rule_name in row['rules_triggered']:
                per_rule_count[rule_name] = per_rule_count.get(rule_name, 0) + 1
                per_rule_latency.setdefault(rule_name, []).append(row['execution_time_ms'])
                ts = row['timestamp']
                if rule_name not in per_rule_last_seen or ts > per_rule_last_seen[rule_name]:
                    per_rule_last_seen[rule_name] = ts
                action_breakdown = per_rule_actions.setdefault(rule_name, {})
                action_breakdown[row['action_name']] = action_breakdown.get(row['action_name'], 0) + 1

        elapsed_hours = max((end - start).total_seconds() / 3600.0, 1 / 60.0)
        results: List[Dict[str, Any]] = []
        for rule_name, count in per_rule_count.items():
            latencies = per_rule_latency.get(rule_name, [])
            results.append(
                {
                    'rule_name': rule_name,
                    'trigger_count': count,
                    'trigger_rate_per_hour': count / elapsed_hours,
                    'avg_execution_time_ms': sum(latencies) / len(latencies) if latencies else None,
                    'last_triggered': per_rule_last_seen.get(rule_name),
                    'action_breakdown': per_rule_actions.get(rule_name, {}),
                }
            )
        results.sort(key=lambda r: r['trigger_count'], reverse=True)
        return results

    def healthcheck(self) -> Dict[str, Any]:
        """Return a small status payload — used by /api/health."""
        ok = self._table_available()
        return {
            'pipeline_metrics_table_available': ok,
            'checked_at': datetime.now(tz=timezone.utc),
        }
