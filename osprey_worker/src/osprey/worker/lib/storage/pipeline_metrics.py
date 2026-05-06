"""Storage model for the executive dashboard's ``pipeline_metrics`` table.

Populated by ``DashboardMetricsOutputSink`` when ``OSPREY_DASHBOARD_METRICS_SINK``
is enabled. Each row is one ``ExecutionResult`` summary.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

from .postgres import Model, scoped_session


class PipelineMetric(Model):
    """One row per ``ExecutionResult`` written through the dashboard sink."""

    __tablename__ = 'pipeline_metrics'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    action_id = Column(BigInteger, nullable=True, index=True)
    action_name = Column(String(255), nullable=True, index=True)
    verdict = Column(String(255), nullable=True)
    rules_triggered = Column(ARRAY(String), nullable=False, default=list)
    execution_time_ms = Column(Integer, nullable=False, default=0)
    has_errors = Column(Boolean, nullable=False, default=False, index=True)
    error_message = Column(Text, nullable=True)
    sample_rate = Column(Integer, nullable=False, default=100)
    extras = Column(JSONB, nullable=True)

    @classmethod
    def insert(
        cls,
        *,
        timestamp: datetime,
        action_id: Optional[int],
        action_name: Optional[str],
        verdict: Optional[str],
        rules_triggered: List[str],
        execution_time_ms: int,
        has_errors: bool,
        error_message: Optional[str],
        sample_rate: int,
    ) -> None:
        """Insert a single pipeline-metrics row."""
        with scoped_session(commit=True) as session:
            session.add(
                PipelineMetric(
                    timestamp=timestamp,
                    action_id=action_id,
                    action_name=action_name,
                    verdict=verdict,
                    rules_triggered=rules_triggered,
                    execution_time_ms=execution_time_ms,
                    has_errors=has_errors,
                    error_message=error_message,
                    sample_rate=sample_rate,
                )
            )
