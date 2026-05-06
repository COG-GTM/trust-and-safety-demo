"""Output sink that persists per-event summary metrics for the executive
dashboard.

Each ``ExecutionResult`` is condensed into a single row in the
``pipeline_metrics`` table (see
``osprey_worker/src/osprey/worker/lib/storage/pipeline_metrics.py``). The
dashboard backend reads from this table to compute throughput, latency, drop
rate, error rate, and per-rule breakdowns without having to talk to a Datadog
or StatsD backend.

The sink is opt-in via the ``OSPREY_DASHBOARD_METRICS_SINK`` config flag and
is registered by ``_stdlibplugin/sink_register.py``.
"""

from __future__ import annotations

import time
from datetime import timezone
from typing import Any, Dict, List, Optional, Set

from osprey.engine.executor.execution_context import ExecutionResult
from osprey.engine.language_types.labels import LabelEffect
from osprey.engine.language_types.verdicts import VerdictEffect
from osprey.worker.lib.osprey_shared.logging import get_logger
from osprey.worker.lib.storage.pipeline_metrics import PipelineMetric
from osprey.worker.sinks.sink.output_sink import BaseOutputSink

logger = get_logger()


class DashboardMetricsOutputSink(BaseOutputSink):
    """Persists summary metrics to PostgreSQL for the executive dashboard."""

    timeout: float = 5.0
    max_retries: int = 0

    def will_do_work(self, result: ExecutionResult) -> bool:
        # Always persist a row so the dashboard has accurate throughput and
        # error-rate denominators (not just the flagged subset).
        return True

    def push(self, result: ExecutionResult) -> None:
        try:
            row = _build_row(result)
            PipelineMetric.insert(**row)
        except Exception:
            # Sinks are responsible for handling their own exceptions per
            # ``BaseOutputSink``'s contract — log and move on so we don't
            # break sibling sinks.
            logger.exception('DashboardMetricsOutputSink: failed to insert pipeline metric row')

    def stop(self) -> None:
        # No background workers / batched buffers to flush.
        return None


def _build_row(result: ExecutionResult) -> Dict[str, Any]:
    """Translate an ``ExecutionResult`` into the column dict for ``PipelineMetric.insert``."""
    timestamp = result.action.timestamp
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    verdicts = [v.verdict for v in result.verdicts] if result.verdicts else []
    label_effects = list(result.effects.get(LabelEffect, []))
    rules_triggered = _collect_triggered_rule_names(result, label_effects)

    has_errors = bool(result.error_infos)
    error_message: Optional[str] = None
    if has_errors:
        try:
            first = result.error_infos[0]
            error_message = type(first.error).__name__ + ': ' + str(first.error)
        except Exception:
            error_message = 'unknown error'

    # The engine doesn't measure per-event execution time inside the result,
    # but the rules sink wraps each handle in ``metrics.timed('handled_message')``
    # so we approximate: the time between ``action.timestamp`` and now is a
    # close-enough proxy for end-to-end latency. If the action timestamp is
    # significantly older than wall-clock (eg backfills) we skip the latency
    # so the average isn't skewed.
    now = time.time()
    age_ms = max(int((now - timestamp.timestamp()) * 1000), 0)
    execution_time_ms = age_ms if age_ms < 60_000 else 0

    return {
        'timestamp': timestamp,
        'action_id': result.action.action_id,
        'action_name': result.action.action_name,
        'verdict': verdicts[0] if verdicts else None,
        'rules_triggered': rules_triggered,
        'execution_time_ms': execution_time_ms,
        'has_errors': has_errors,
        'error_message': error_message,
        'sample_rate': int(result.sample_rate),
    }


def _collect_triggered_rule_names(
    result: ExecutionResult,
    label_effects: List[Any],
) -> List[str]:
    """Best-effort extraction of which named rules evaluated to ``True``.

    ``LabelEffect`` carries the ``rules`` and ``dependent_rule`` that drove the
    label mutation, which is the most reliable signal of "rule fired". We also
    fall back to scanning ``extracted_features`` for boolean ``True`` values
    whose key doesn't begin with ``__`` (the sentinel prefix Osprey uses for
    multi-value internal dimensions like ``__verdicts``).
    """
    rule_names: Set[str] = set()

    for effect in label_effects:
        try:
            if isinstance(effect, LabelEffect):
                if effect.suppressed:
                    continue
                dependent_rule = effect.dependent_rule
                if dependent_rule is not None and dependent_rule.value:
                    rule_names.add(dependent_rule.name)
                for rule in effect.rules or []:
                    if getattr(rule, 'value', False):
                        rule_names.add(rule.name)
        except Exception:
            continue

    # Verdicts that fire imply at least one rule's predicate was satisfied;
    # the engine encodes this in extracted_features by giving the rule's
    # bound feature name a True value.
    for key, value in result.extracted_features.items():
        if key.startswith('__'):
            continue
        if value is True:
            rule_names.add(key)

    # Additionally include any verdict effect names so the sink output is
    # symmetric with what ends up in the Druid datasource.
    for verdict in result.effects.get(VerdictEffect, []):
        try:
            if isinstance(verdict, VerdictEffect):
                rule_names.add(f'verdict::{verdict.verdict}')
        except Exception:
            continue

    return sorted(rule_names)
