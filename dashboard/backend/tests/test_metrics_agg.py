"""Unit tests for the percentile helper used by the metrics aggregator."""

from backend.services.metrics_agg import _percentile


def test_percentile_empty_returns_zero() -> None:
    assert _percentile([], 0.5) == 0.0


def test_percentile_single_value() -> None:
    assert _percentile([10.0], 0.5) == 10.0
    assert _percentile([10.0], 0.99) == 10.0


def test_percentile_simple_distribution() -> None:
    values = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert _percentile(values, 0.5) == 3.0
    assert _percentile(values, 0.99) == 5.0 - (1.0 - 0.96)  # ≈ 4.96


def test_percentile_p95_above_median() -> None:
    values = [float(i) for i in range(1, 101)]
    assert _percentile(values, 0.95) >= _percentile(values, 0.5)
