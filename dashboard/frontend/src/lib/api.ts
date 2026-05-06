const isServer = typeof window === 'undefined';

function rawApiBase(): string {
  if (isServer) {
    return (
      process.env.DASHBOARD_API_INTERNAL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://dashboard-backend:8080'
    );
  }
  return process.env.NEXT_PUBLIC_API_URL || '';
}

export function apiUrl(path: string): string {
  const base = rawApiBase().replace(/\/$/, '');
  if (!base) return path; // browser: use Next.js rewrites at /api/dashboard/*
  return `${base}${path}`;
}

export async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export interface SummaryResponse {
  window: { start: string; end: string; bucket: string };
  total_events: number;
  total_flagged: number;
  total_dropped: number;
  flag_rate: number;
  error_rate: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
}

export interface TimelinePoint {
  bucket: string;
  total: number;
  flagged: number;
  dropped: number;
}

export interface TimelineResponse {
  window: { start: string; end: string; bucket: string };
  points: TimelinePoint[];
}

export interface RuleStat {
  rule_name: string;
  match_count: number;
  match_rate: number;
  avg_execution_time_ms: number | null;
  last_triggered: string | null;
}

export interface RulesResponse {
  window: { start: string; end: string; bucket: string };
  total_events: number;
  rules: RuleStat[];
}

export interface VerdictBreakdownEntry {
  verdict: string;
  count: number;
}

export interface VerdictBreakdownResponse {
  window: { start: string; end: string; bucket: string };
  total: number;
  breakdown: VerdictBreakdownEntry[];
}

export interface TopLabel {
  label: string;
  count: number;
}

export interface LabelMutation {
  entity_key: string;
  label: string;
  status: string | null;
  timestamp: string | null;
}

export interface LabelsResponse {
  top: TopLabel[];
  recent_mutations: LabelMutation[];
}

export interface EffectSummaryEntry {
  effect_type: string;
  count: number;
}

export interface EffectsSummaryResponse {
  window: { start: string; end: string; bucket: string };
  total: number;
  effects: EffectSummaryEntry[];
}

export interface ErrorEntry {
  action_id: number;
  action_name: string | null;
  timestamp: string | null;
  rules_source_location: string | null;
  traceback: string | null;
}

export interface ErrorsResponse {
  errors: ErrorEntry[];
}

export interface PipelineHealthResponse {
  window: { start: string; end: string; bucket: string };
  throughput_per_sec: number;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  p99_latency_ms: number | null;
  drop_rate: number;
  error_rate: number;
  consumer_lag: number | null;
}

export interface FlaggedEventSummary {
  action_id: number;
  action_name: string | null;
  timestamp: string;
  verdict: string | null;
  matched_rules: string[];
  effects: string[];
  had_errors: boolean;
  execution_duration_ms: number | null;
}

export interface FlaggedEventsResponse {
  window: { start: string; end: string; bucket: string };
  page: number;
  page_size: number;
  total: number;
  events: FlaggedEventSummary[];
}

export interface EventDetailResponse {
  action_id: number;
  action_name: string | null;
  timestamp: string | null;
  verdict: string | null;
  matched_rules: string[];
  effects: string[];
  extracted_features: Record<string, unknown>;
  error_traces: Record<string, unknown>[];
  action_data: Record<string, unknown> | null;
  execution_duration_ms: number | null;
  sample_rate: number | null;
}

export const ACCENT_COLORS = [
  '#22D3EE',
  '#6366F1',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#A78BFA',
  '#FB7185',
  '#F59E0B',
];
