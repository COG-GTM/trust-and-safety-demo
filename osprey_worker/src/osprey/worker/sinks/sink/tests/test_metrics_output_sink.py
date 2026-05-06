"""Tests for ``DashboardMetricsOutputSink`` and its row-builder helper."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Sequence, Type
from unittest.mock import MagicMock, patch

import pytest
from osprey.engine.executor.execution_context import ExecutionResult
from osprey.engine.language_types.effects import EffectBase
from osprey.engine.language_types.verdicts import VerdictEffect
from osprey.worker.sinks.sink.metrics_output_sink import (
    DashboardMetricsOutputSink,
    _build_row,
    _collect_triggered_rule_names,
)


@dataclass
class _StubAction:
    action_id: int
    action_name: str
    timestamp: datetime
    secret_data: Dict[str, Any] = field(default_factory=dict)


def _make_result(
    *,
    extracted_features: Dict[str, Any] | None = None,
    effects: Mapping[Type[EffectBase], Sequence[EffectBase]] | None = None,
    error_infos: Sequence[Any] = (),
    sample_rate: int = 100,
    action_id: int = 42,
    action_name: str = 'create_post',
) -> ExecutionResult:
    return ExecutionResult(
        extracted_features=extracted_features or {},
        action=_StubAction(
            action_id=action_id,
            action_name=action_name,
            timestamp=datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc),
        ),  # type: ignore[arg-type]
        effects=effects or {},
        error_infos=list(error_infos),
        sample_rate=sample_rate,
    )


def test_will_do_work_is_always_true() -> None:
    sink = DashboardMetricsOutputSink()
    assert sink.will_do_work(_make_result()) is True


def test_build_row_extracts_basic_metadata() -> None:
    result = _make_result(
        extracted_features={'IsSpammer': True, 'IsTrusted': False, '__verdicts': ['reject']},
        effects={VerdictEffect: [VerdictEffect(verdict='reject')]},
        sample_rate=0,
    )
    row = _build_row(result)
    assert row['action_id'] == 42
    assert row['action_name'] == 'create_post'
    assert row['verdict'] == 'reject'
    assert 'IsSpammer' in row['rules_triggered']
    assert 'verdict::reject' in row['rules_triggered']
    assert row['has_errors'] is False
    assert row['error_message'] is None
    assert row['sample_rate'] == 0


def test_build_row_handles_errors() -> None:
    error = MagicMock()
    error.error = ValueError('boom')
    result = _make_result(error_infos=[error])
    row = _build_row(result)
    assert row['has_errors'] is True
    assert row['error_message'] is not None
    assert 'boom' in row['error_message']


def test_collect_rules_skips_internal_features() -> None:
    result = _make_result(
        extracted_features={
            '__rules_fired': True,
            '__verdicts': ['reject'],
            'PublicRule': True,
            'AnotherFeature': False,
        }
    )
    names = _collect_triggered_rule_names(result, [])
    assert 'PublicRule' in names
    assert '__rules_fired' not in names
    assert 'AnotherFeature' not in names


def test_push_inserts_row_via_pipeline_metric() -> None:
    sink = DashboardMetricsOutputSink()
    result = _make_result(extracted_features={'IsSpammer': True})
    with patch('osprey.worker.sinks.sink.metrics_output_sink.PipelineMetric') as mock_metric:
        sink.push(result)
        assert mock_metric.insert.called
        kwargs = mock_metric.insert.call_args.kwargs
        assert kwargs['action_id'] == 42
        assert kwargs['action_name'] == 'create_post'
        assert 'IsSpammer' in kwargs['rules_triggered']


def test_push_swallows_db_errors() -> None:
    """The sink contract is that it must handle its own exceptions."""
    sink = DashboardMetricsOutputSink()
    result = _make_result()
    with patch('osprey.worker.sinks.sink.metrics_output_sink.PipelineMetric') as mock_metric:
        mock_metric.insert.side_effect = RuntimeError('postgres unavailable')
        # Should not raise
        sink.push(result)


def test_stop_is_a_noop() -> None:
    sink = DashboardMetricsOutputSink()
    assert sink.stop() is None


@pytest.mark.parametrize(
    'sample_rate, expected_in_row',
    [
        (0, 0),
        (50, 50),
        (100, 100),
    ],
)
def test_sample_rate_round_trips(sample_rate: int, expected_in_row: int) -> None:
    result = _make_result(sample_rate=sample_rate)
    row = _build_row(result)
    assert row['sample_rate'] == expected_in_row


def test_rules_triggered_is_sorted_unique_list() -> None:
    result = _make_result(
        extracted_features={'BRule': True, 'ARule': True, 'CRule': True},
        effects={VerdictEffect: [VerdictEffect(verdict='reject')]},
    )
    row = _build_row(result)
    assert row['rules_triggered'] == sorted(row['rules_triggered'])
    assert len(row['rules_triggered']) == len(set(row['rules_triggered']))


def test_build_row_handles_naive_timestamps() -> None:
    result = ExecutionResult(
        extracted_features={},
        action=_StubAction(
            action_id=1,
            action_name='login',
            timestamp=datetime(2024, 5, 1, 12, 0),  # naive
        ),  # type: ignore[arg-type]
        effects={},
        error_infos=[],
        sample_rate=100,
    )
    row = _build_row(result)
    assert row['timestamp'].tzinfo is not None


_: List[Any] = []  # ensure imports are not reordered away
