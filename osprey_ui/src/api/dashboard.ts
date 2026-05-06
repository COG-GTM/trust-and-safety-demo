import HTTPUtils, { HTTPResponse } from '../utils/HTTPUtils';

export type DashboardWindow = '24h' | '7d' | '30d' | '90d';
export type DashboardGranularity = 'minute' | 'hour' | 'day' | 'week';
export type DashboardMetric = 'total_events' | 'flagged_events' | 'flag_rate' | 'labels_applied' | 'errors';
export type EntityType = 'User' | 'IP' | 'Email' | 'Domain';

export interface WindowRange {
  start: string;
  end: string;
}

export interface VerdictBreakdownItem {
  verdict: string;
  count: number;
}

export interface DashboardSummary {
  window: WindowRange;
  total_events: number;
  flagged_events: number;
  flag_rate: number;
  unique_entities_flagged: number;
  labels_applied: number;
  error_events: number;
  verdicts_breakdown: VerdictBreakdownItem[];
}

export interface TimeseriesPoint {
  timestamp: string;
  value: number;
}

export interface TimeseriesResponse {
  metric: DashboardMetric;
  granularity: DashboardGranularity;
  window: WindowRange;
  points: TimeseriesPoint[];
}

export interface RuleStat {
  rule: string;
  matches: number;
  percentage: number;
}

export interface TopRulesResponse {
  rules: RuleStat[];
  total_matches: number;
}

export interface EntityStat {
  entity_id: string;
  flag_count: number;
}

export interface TopEntitiesResponse {
  entity_type: EntityType;
  entities: EntityStat[];
}

export interface VerdictPoint {
  timestamp: string;
  verdict: string;
  count: number;
}

export interface VerdictsBreakdownResponse {
  granularity: DashboardGranularity;
  window: WindowRange;
  points: VerdictPoint[];
}

export interface LabelsActivityPoint {
  timestamp: string;
  automated: number;
  manual: number;
}

export interface LabelsActivityResponse {
  granularity: DashboardGranularity;
  window: WindowRange;
  points: LabelsActivityPoint[];
  labelled_entities_total: number;
}

export interface ThroughputPoint {
  timestamp: string;
  events: number;
  errors: number;
}

export interface PipelineHealthResponse {
  window: WindowRange;
  total_events: number;
  error_events: number;
  events_per_minute: number;
  error_rate: number;
  latest_event: string | null;
  throughput: ThroughputPoint[];
}

async function fetchOrThrow<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const response: HTTPResponse = await HTTPUtils.get(path, { params });
  if (!response.ok) {
    throw response.error;
  }
  return response.data as T;
}

export interface SummaryParams {
  window: DashboardWindow;
}

export interface TimeseriesParams {
  window: DashboardWindow;
  granularity: DashboardGranularity;
  metric: DashboardMetric;
}

export interface TopRulesParams {
  window: DashboardWindow;
  limit?: number;
}

export interface TopEntitiesParams {
  window: DashboardWindow;
  limit?: number;
  entityType?: EntityType;
}

export interface VerdictsParams {
  window: DashboardWindow;
  granularity: DashboardGranularity;
}

export interface LabelsParams {
  window: DashboardWindow;
  granularity: DashboardGranularity;
}

export interface HealthParams {
  window: DashboardWindow;
}

export const fetchDashboardSummary = ({ window }: SummaryParams): Promise<DashboardSummary> =>
  fetchOrThrow<DashboardSummary>('dashboard/summary', { window });

export const fetchDashboardTimeseries = (params: TimeseriesParams): Promise<TimeseriesResponse> =>
  fetchOrThrow<TimeseriesResponse>('dashboard/timeseries', {
    window: params.window,
    granularity: params.granularity,
    metric: params.metric,
  });

export const fetchTopRules = ({ window, limit = 10 }: TopRulesParams): Promise<TopRulesResponse> =>
  fetchOrThrow<TopRulesResponse>('dashboard/top-rules', { window, limit });

export const fetchTopEntities = ({
  window,
  limit = 10,
  entityType = 'User',
}: TopEntitiesParams): Promise<TopEntitiesResponse> =>
  fetchOrThrow<TopEntitiesResponse>('dashboard/top-entities', {
    window,
    limit,
    /* eslint-disable-next-line */
    entity_type: entityType,
  });

export const fetchVerdictsBreakdown = (params: VerdictsParams): Promise<VerdictsBreakdownResponse> =>
  fetchOrThrow<VerdictsBreakdownResponse>('dashboard/verdicts-breakdown', {
    window: params.window,
    granularity: params.granularity,
  });

export const fetchLabelsActivity = (params: LabelsParams): Promise<LabelsActivityResponse> =>
  fetchOrThrow<LabelsActivityResponse>('dashboard/labels-activity', {
    window: params.window,
    granularity: params.granularity,
  });

export const fetchPipelineHealth = ({ window }: HealthParams): Promise<PipelineHealthResponse> =>
  fetchOrThrow<PipelineHealthResponse>('dashboard/pipeline-health', { window });
