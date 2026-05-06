"""Pydantic response schemas shared across routers."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TimeWindow(BaseModel):
    start: datetime
    end: datetime
    bucket: str = Field(description='hour | minute | day')


class SummaryResponse(BaseModel):
    window: TimeWindow
    total_events: int
    total_flagged: int
    total_dropped: int
    flag_rate: float
    error_rate: float
    avg_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[float] = None


class TimelinePoint(BaseModel):
    bucket: datetime
    total: int
    flagged: int
    dropped: int


class TimelineResponse(BaseModel):
    window: TimeWindow
    points: List[TimelinePoint]


class RuleStat(BaseModel):
    rule_name: str
    match_count: int
    match_rate: float
    avg_execution_time_ms: Optional[float] = None
    last_triggered: Optional[datetime] = None


class RulesResponse(BaseModel):
    window: TimeWindow
    total_events: int
    rules: List[RuleStat]


class VerdictBreakdownEntry(BaseModel):
    verdict: str
    count: int


class VerdictBreakdownResponse(BaseModel):
    window: TimeWindow
    total: int
    breakdown: List[VerdictBreakdownEntry]


class TopLabel(BaseModel):
    label: str
    count: int


class LabelMutation(BaseModel):
    entity_key: str
    label: str
    status: Optional[str] = None
    timestamp: Optional[datetime] = None


class LabelsResponse(BaseModel):
    top: List[TopLabel]
    recent_mutations: List[LabelMutation]


class EffectSummaryEntry(BaseModel):
    effect_type: str
    count: int


class EffectsSummaryResponse(BaseModel):
    window: TimeWindow
    total: int
    effects: List[EffectSummaryEntry]


class ErrorEntry(BaseModel):
    action_id: int
    action_name: Optional[str] = None
    timestamp: Optional[datetime] = None
    rules_source_location: Optional[str] = None
    traceback: Optional[str] = None


class ErrorsResponse(BaseModel):
    errors: List[ErrorEntry]


class PipelineHealthResponse(BaseModel):
    window: TimeWindow
    throughput_per_sec: float
    p50_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[float] = None
    p99_latency_ms: Optional[float] = None
    drop_rate: float
    error_rate: float
    consumer_lag: Optional[int] = None


class FlaggedEventSummary(BaseModel):
    action_id: int
    action_name: Optional[str] = None
    timestamp: datetime
    verdict: Optional[str] = None
    matched_rules: List[str] = Field(default_factory=list)
    effects: List[str] = Field(default_factory=list)
    had_errors: bool = False
    execution_duration_ms: Optional[float] = None


class FlaggedEventsResponse(BaseModel):
    window: TimeWindow
    page: int
    page_size: int
    total: int
    events: List[FlaggedEventSummary]


class EventDetailResponse(BaseModel):
    action_id: int
    action_name: Optional[str] = None
    timestamp: Optional[datetime] = None
    verdict: Optional[str] = None
    matched_rules: List[str] = Field(default_factory=list)
    effects: List[str] = Field(default_factory=list)
    extracted_features: Dict[str, Any] = Field(default_factory=dict)
    error_traces: List[Dict[str, Any]] = Field(default_factory=list)
    action_data: Optional[Dict[str, Any]] = None
    execution_duration_ms: Optional[float] = None
    sample_rate: Optional[int] = None
