-- Migration 001: dashboard_event_metrics table.
--
-- Stores one row per ExecutionResult emitted by DashboardMetricsOutputSink.
-- Indexed on (timestamp, action_name, verdict) for the query patterns used
-- by the dashboard backend (`dashboard/backend/app/services/metrics_service.py`).

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

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON dashboard_event_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_action_name ON dashboard_event_metrics(action_name);
CREATE INDEX IF NOT EXISTS idx_metrics_verdict ON dashboard_event_metrics(verdict);
