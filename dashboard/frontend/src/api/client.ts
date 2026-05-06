/**
 * Thin fetch-based client for the Osprey dashboard backend. The base URL
 * defaults to the same-origin "/api" prefix so the Vite dev-server proxy
 * (and our nginx config in docker) can take care of forwarding to the
 * backend.
 */

const BASE_URL = import.meta.env.VITE_DASHBOARD_API_BASE_URL ?? "";

async function request<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(
    url.toString().replace(window.location.origin, BASE_URL || ""),
    {
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `API ${path} failed: ${response.status} ${response.statusText} ${text}`,
    );
  }
  return response.json() as Promise<T>;
}

export interface OverviewWindow {
  label: string;
  total_events: number;
  flagged_events: number;
  flag_rate: number;
  error_count: number;
  error_rate: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface TopRuleRow {
  rule_name: string;
  trigger_count: number;
}

export interface VerdictBreakdownRow {
  verdict: string;
  count: number;
}

export interface OverviewResponse {
  generated_at: string;
  windows: OverviewWindow[];
  top_rules: TopRuleRow[];
  verdict_breakdown: VerdictBreakdownRow[];
  events_timeseries: TimeSeriesPoint[];
  flagged_events_timeseries: TimeSeriesPoint[];
}

export interface FlaggedEventRow {
  timestamp: string;
  action_id: number;
  action_name: string;
  verdicts: string[];
  rules_triggered: string[];
  entity_id: string | null;
  entity_type: string | null;
}

export interface FlaggedEventsResponse {
  timeseries: TimeSeriesPoint[];
  by_verdict: VerdictBreakdownRow[];
  by_action_name: Array<{ action_name: string; count: number }>;
  rows: FlaggedEventRow[];
  total: number;
  next_page_token: string | null;
}

export interface RuleMetricRow {
  rule_name: string;
  trigger_count: number;
  trigger_rate_per_hour: number;
  avg_execution_time_ms: number | null;
  last_triggered: string | null;
}

export interface RuleMetricsResponse {
  rows: RuleMetricRow[];
  inactive_rules: string[];
  rule_action_heatmap: Array<{
    rule_name: string;
    action_name: string;
    count: number;
  }>;
}

export interface LabelDistributionRow {
  label_name: string;
  count: number;
}

export interface LabelEntityRow {
  entity_key: string;
  label_count: number;
  labels: string[];
}

export interface LabelStatsResponse {
  total_labeled_entities: number;
  distribution: LabelDistributionRow[];
  recently_applied: LabelDistributionRow[];
  expiring_soon: LabelDistributionRow[];
  top_entities: LabelEntityRow[];
}

export interface PipelineLatencyPoint {
  timestamp: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface PipelineHealthResponse {
  throughput_eps: number;
  drop_rate: number;
  error_rate: number;
  avg_latency_ms: number | null;
  latency: PipelineLatencyPoint[];
  throughput_timeseries: TimeSeriesPoint[];
  error_timeseries: TimeSeriesPoint[];
  recent_errors: Array<Record<string, unknown>>;
  input_streams: Array<Record<string, unknown>>;
}

export interface EventDetailResponse {
  action_id: number;
  action_name: string;
  timestamp: string;
  sample_rate: number;
  extracted_features: Record<string, unknown>;
  verdicts: string[];
  rules_triggered: string[];
  label_mutations: Array<Record<string, unknown>>;
  error_infos: Array<Record<string, unknown>>;
  raw: Record<string, unknown>;
}

export const api = {
  overview: () => request<OverviewResponse>("/overview"),
  flaggedEvents: (params: {
    lookback_hours?: number;
    action_name?: string;
    verdict?: string;
  }) => request<FlaggedEventsResponse>("/events/flagged", params),
  eventDetail: (eventId: number) =>
    request<EventDetailResponse>(`/events/${eventId}`),
  ruleMetrics: (params: { lookback_hours?: number }) =>
    request<RuleMetricsResponse>("/rules/metrics", params),
  labelStats: () => request<LabelStatsResponse>("/labels/stats"),
  pipelineHealth: (params: { lookback_hours?: number }) =>
    request<PipelineHealthResponse>("/pipeline/health", params),
};
