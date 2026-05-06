"""Pydantic models returned by the dashboard API.

These intentionally mirror the relevant pieces of ``ExecutionResult``
(extracted features, verdicts, rule effects, error infos) so the frontend can
consume them without any knowledge of the underlying Druid / Postgres / MinIO
schemas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Shared building blocks
# ---------------------------------------------------------------------------


class TimeRangeQuery(BaseModel):
    """Optional time-range parameters accepted by most analytics endpoints."""

    start: Optional[datetime] = Field(default=None, description='Lower bound of the analytics window (UTC).')
    end: Optional[datetime] = Field(default=None, description='Upper bound of the analytics window (UTC).')
    lookback_hours: Optional[int] = Field(
        default=None, ge=1, le=24 * 30, description='Lookback window if start/end omitted.'
    )


class TimeSeriesPoint(BaseModel):
    """A single bucket of a time-series chart."""

    timestamp: datetime
    value: float


class VerdictBreakdownRow(BaseModel):
    verdict: str
    count: int


class TopRuleRow(BaseModel):
    rule_name: str
    trigger_count: int


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------


class OverviewWindow(BaseModel):
    label: str
    total_events: int
    flagged_events: int
    flag_rate: float
    error_count: int
    error_rate: float


class OverviewResponse(BaseModel):
    """Executive summary numbers for the homepage."""

    generated_at: datetime
    windows: List[OverviewWindow]
    top_rules: List[TopRuleRow]
    verdict_breakdown: List[VerdictBreakdownRow]
    events_timeseries: List[TimeSeriesPoint]
    flagged_events_timeseries: List[TimeSeriesPoint]


# ---------------------------------------------------------------------------
# Flagged events
# ---------------------------------------------------------------------------


class FlaggedEventRow(BaseModel):
    timestamp: datetime
    action_id: int
    action_name: str
    verdicts: List[str]
    rules_triggered: List[str] = Field(default_factory=list)
    entity_id: Optional[str] = None
    entity_type: Optional[str] = None


class FlaggedEventsResponse(BaseModel):
    timeseries: List[TimeSeriesPoint]
    by_verdict: List[VerdictBreakdownRow]
    by_action_name: List[Dict[str, Any]]
    rows: List[FlaggedEventRow]
    total: int
    next_page_token: Optional[str] = None


class EventDetail(BaseModel):
    """Full execution-result style payload used by the drill-down page."""

    action_id: int
    action_name: str
    timestamp: datetime
    sample_rate: int
    extracted_features: Dict[str, Any] = Field(default_factory=dict)
    verdicts: List[str] = Field(default_factory=list)
    rules_triggered: List[str] = Field(default_factory=list)
    label_mutations: List[Dict[str, Any]] = Field(default_factory=list)
    error_infos: List[Dict[str, Any]] = Field(default_factory=list)
    raw: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Rule metrics
# ---------------------------------------------------------------------------


class RuleMetricRow(BaseModel):
    rule_name: str
    trigger_count: int
    trigger_rate_per_hour: float
    avg_execution_time_ms: Optional[float] = None
    last_triggered: Optional[datetime] = None


class RuleMetricsResponse(BaseModel):
    rows: List[RuleMetricRow]
    inactive_rules: List[str] = Field(default_factory=list)
    rule_action_heatmap: List[Dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------


class LabelDistributionRow(BaseModel):
    label_name: str
    count: int


class LabelEntityRow(BaseModel):
    entity_key: str
    label_count: int
    labels: List[str]


class LabelStatsResponse(BaseModel):
    total_labeled_entities: int
    distribution: List[LabelDistributionRow]
    recently_applied: List[LabelDistributionRow]
    expiring_soon: List[LabelDistributionRow]
    top_entities: List[LabelEntityRow]


# ---------------------------------------------------------------------------
# Pipeline health
# ---------------------------------------------------------------------------


class PipelineLatencyPoint(BaseModel):
    timestamp: datetime
    p50_ms: float
    p95_ms: float
    p99_ms: float


class PipelineHealthResponse(BaseModel):
    throughput_eps: float
    drop_rate: float
    error_rate: float
    avg_latency_ms: Optional[float] = None
    latency: List[PipelineLatencyPoint]
    throughput_timeseries: List[TimeSeriesPoint]
    error_timeseries: List[TimeSeriesPoint]
    recent_errors: List[Dict[str, Any]] = Field(default_factory=list)
    input_streams: List[Dict[str, Any]] = Field(default_factory=list)
