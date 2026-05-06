"""Dashboard metrics output sink.

Aggregates each ExecutionResult into a per-event row in a Postgres table
that the dashboard backend queries for analytics views (KPI cards,
time-series, top rules, verdict breakdowns, etc).

The schema is owned by ``dashboard/backend/migrations/001_create_dashboard_metrics.sql``
but the sink lazily creates the table at startup if it does not already
exist, so it works in local dev without an explicit migration step.
"""

from __future__ import annotations

import json
from datetime import timezone
from typing import Any, Dict, List, Optional, Set

import psycopg2
from osprey.engine.executor.execution_context import ExecutionResult
from osprey.engine.language_types.effects import EffectBase
from osprey.engine.language_types.verdicts import VerdictEffect
from osprey.worker.lib.osprey_shared.logging import get_logger
from osprey.worker.sinks.sink.output_sink import BaseOutputSink

logger = get_logger()


_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS dashboard_event_metrics (
    id BIGSERIAL PRIMARY KEY,
    action_id BIGINT NOT NULL,
    action_name VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL,
    verdict VARCHAR(50),
    matched_rules TEXT[],
    effects TEXT[],
    execution_duration_ms FLOAT,
    sample_rate INT,
    had_errors BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""

_CREATE_INDEXES_SQL = [
    'CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON dashboard_event_metrics(timestamp);',
    'CREATE INDEX IF NOT EXISTS idx_metrics_action_name ON dashboard_event_metrics(action_name);',
    'CREATE INDEX IF NOT EXISTS idx_metrics_verdict ON dashboard_event_metrics(verdict);',
]

_INSERT_SQL = """
INSERT INTO dashboard_event_metrics (
    action_id,
    action_name,
    timestamp,
    verdict,
    matched_rules,
    effects,
    execution_duration_ms,
    sample_rate,
    had_errors
) VALUES (
    %(action_id)s,
    %(action_name)s,
    %(timestamp)s,
    %(verdict)s,
    %(matched_rules)s,
    %(effects)s,
    %(execution_duration_ms)s,
    %(sample_rate)s,
    %(had_errors)s
);
"""


def _extract_postgres_dsn(postgres_hosts: Optional[str], database: str = 'osprey_db') -> Optional[str]:
    """Parse the OSPREY POSTGRES_HOSTS json blob, returning the DSN for ``database`` if present."""
    if not postgres_hosts:
        return None
    try:
        hosts: Dict[str, str] = json.loads(postgres_hosts)
    except (json.JSONDecodeError, TypeError):
        logger.warning('Could not parse POSTGRES_HOSTS env var for dashboard metrics sink')
        return None
    return hosts.get(database)


class DashboardMetricsOutputSink(BaseOutputSink):
    """Persists per-event metrics to the dashboard_event_metrics Postgres table.

    Uses a synchronous psycopg2 connection. Each push opens a transient
    cursor; failures are swallowed and logged so the sink never breaks the
    pipeline.
    """

    timeout: float = 5.0
    max_retries: int = 1

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._conn: Optional[Any] = None
        self._ensure_schema()

    # --- connection management -------------------------------------------------

    def _get_connection(self) -> Any:
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self._dsn)
            self._conn.autocommit = True
        return self._conn

    def _ensure_schema(self) -> None:
        try:
            with self._get_connection().cursor() as cur:
                cur.execute(_CREATE_TABLE_SQL)
                for stmt in _CREATE_INDEXES_SQL:
                    cur.execute(stmt)
            logger.info('DashboardMetricsOutputSink: ensured dashboard_event_metrics schema')
        except Exception as e:
            logger.warning(f'DashboardMetricsOutputSink: failed to ensure schema: {e}')
            # Reset the connection so the next push tries again
            self._conn = None

    # --- BaseOutputSink interface ---------------------------------------------

    def will_do_work(self, result: ExecutionResult) -> bool:
        del result
        return True

    def push(self, result: ExecutionResult) -> None:
        try:
            payload = self._build_payload(result)
            with self._get_connection().cursor() as cur:
                cur.execute(_INSERT_SQL, payload)
        except Exception as e:
            logger.warning(f'DashboardMetricsOutputSink: failed to insert metrics row: {e}')
            self._conn = None  # force reconnect on next call

    def stop(self) -> None:
        if self._conn is not None and not self._conn.closed:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None

    # --- helpers ---------------------------------------------------------------

    def _build_payload(self, result: ExecutionResult) -> Dict[str, Any]:
        action = result.action
        timestamp = action.timestamp
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        verdicts = self._collect_verdicts(result)
        verdict = verdicts[0] if verdicts else None

        return {
            'action_id': action.action_id,
            'action_name': action.action_name,
            'timestamp': timestamp,
            'verdict': verdict,
            'matched_rules': self._collect_matched_rules(result),
            'effects': self._collect_effect_types(result),
            'execution_duration_ms': self._extract_duration_ms(result),
            'sample_rate': result.sample_rate,
            'had_errors': bool(result.error_infos),
        }

    @staticmethod
    def _collect_verdicts(result: ExecutionResult) -> List[str]:
        return [v.verdict for v in result.verdicts]

    @staticmethod
    def _collect_matched_rules(result: ExecutionResult) -> List[str]:
        seen: Set[str] = set()
        rules: List[str] = []
        for effect_list in result.effects.values():
            for effect in effect_list:
                if not isinstance(effect, EffectBase):
                    continue
                for rule in effect.rules:
                    if rule.value and rule.name not in seen:
                        seen.add(rule.name)
                        rules.append(rule.name)
        return rules

    @staticmethod
    def _collect_effect_types(result: ExecutionResult) -> List[str]:
        types: List[str] = []
        for effect_type, effect_list in result.effects.items():
            if not effect_list:
                continue
            if effect_type is VerdictEffect:
                # verdicts get their own column; skip duplicating them here
                continue
            types.append(effect_type.__name__)
        return types

    @staticmethod
    def _extract_duration_ms(result: ExecutionResult) -> Optional[float]:
        duration = result.extracted_features.get('execution_duration_ms')
        if isinstance(duration, (int, float)):
            return float(duration)
        return None


def build_dashboard_metrics_sink_from_env(
    postgres_hosts_env: Optional[str], database: str = 'osprey_db'
) -> Optional[DashboardMetricsOutputSink]:
    """Factory used by ``register_output_sinks`` — returns None if no DSN available."""
    dsn = _extract_postgres_dsn(postgres_hosts_env, database=database)
    if not dsn:
        logger.warning(
            'DashboardMetricsOutputSink requested, but no Postgres DSN found in POSTGRES_HOSTS '
            f'for database {database!r}; skipping registration.'
        )
        return None
    try:
        return DashboardMetricsOutputSink(dsn=dsn)
    except Exception as e:
        logger.warning(f'DashboardMetricsOutputSink: failed to initialize: {e}')
        return None


__all__ = [
    'DashboardMetricsOutputSink',
    'build_dashboard_metrics_sink_from_env',
]
