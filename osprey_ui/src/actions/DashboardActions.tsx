import {
  AnalyticsGroupByResponse,
  AnalyticsLabelsSummary,
  AnalyticsTimeseriesPoint,
  CreateDashboardRequest,
  DashboardRecord,
  DashboardSummary,
  UpdateDashboardRequest,
} from '../types/DashboardTypes';
import HTTPUtils, { HTTPResponse } from '../utils/HTTPUtils';

/* ----------------------- Dashboards CRUD ----------------------- */

export async function listDashboards(userEmail?: string): Promise<DashboardSummary[]> {
  const response: HTTPResponse = await HTTPUtils.get('dashboards', {
    params: userEmail ? { user_email: userEmail } : undefined,
  });
  if (!response.ok) return [];
  return response.data;
}

export async function getDashboard(dashboardId: string): Promise<DashboardRecord | null> {
  const response: HTTPResponse = await HTTPUtils.get(`dashboards/${dashboardId}`);
  if (!response.ok) return null;
  return response.data;
}

export async function createDashboard(payload: CreateDashboardRequest): Promise<DashboardRecord | null> {
  const response: HTTPResponse = await HTTPUtils.post('dashboards', payload);
  if (!response.ok) return null;
  return response.data;
}

export async function updateDashboard(
  dashboardId: string,
  payload: UpdateDashboardRequest
): Promise<DashboardRecord | null> {
  const response: HTTPResponse = await HTTPUtils.patch(`dashboards/${dashboardId}`, payload);
  if (!response.ok) return null;
  return response.data;
}

export async function deleteDashboard(dashboardId: string): Promise<boolean> {
  const response: HTTPResponse = await HTTPUtils.delete(`dashboards/${dashboardId}`);
  return response.ok;
}

/* ----------------------- Analytics ----------------------- */

interface AnalyticsTimeRangeArgs {
  start: string;
  end: string;
  /** SML query filter, '' = all events. */
  query_filter?: string;
}

export interface AnalyticsTimeseriesArgs extends AnalyticsTimeRangeArgs {
  granularity: string;
}

export async function getAnalyticsTimeseries(args: AnalyticsTimeseriesArgs): Promise<AnalyticsTimeseriesPoint[]> {
  const response: HTTPResponse = await HTTPUtils.post('analytics/timeseries', {
    query_filter: '',
    ...args,
    entity: null,
  });
  if (!response.ok) return [];
  return response.data;
}

export interface AnalyticsGroupByArgs extends AnalyticsTimeRangeArgs {
  dimension: string;
  limit?: number;
}

export async function getAnalyticsGroupBy(args: AnalyticsGroupByArgs): Promise<AnalyticsGroupByResponse> {
  const response: HTTPResponse = await HTTPUtils.post('analytics/groupby', {
    query_filter: '',
    limit: 25,
    precision: 0,
    ...args,
    entity: null,
  });
  if (!response.ok) return { current_period: [], previous_period: null, comparison: null };
  return response.data;
}

export async function getVerdictsSummary(args: AnalyticsTimeRangeArgs & { dimension?: string; limit?: number }) {
  const response: HTTPResponse = await HTTPUtils.post('analytics/verdicts/summary', args);
  if (!response.ok) return { current_period: [], previous_period: null, comparison: null };
  return response.data as AnalyticsGroupByResponse;
}

export async function getRulesPerformance(args: AnalyticsTimeRangeArgs & { dimension?: string; limit?: number }) {
  const response: HTTPResponse = await HTTPUtils.post('analytics/rules/performance', args);
  if (!response.ok) return { current_period: [], previous_period: null, comparison: null };
  return response.data as AnalyticsGroupByResponse;
}

export interface AnalyticsThroughputArgs extends AnalyticsTimeRangeArgs {
  granularity?: string;
}

export async function getThroughput(args: AnalyticsThroughputArgs): Promise<AnalyticsTimeseriesPoint[]> {
  const response: HTTPResponse = await HTTPUtils.post('analytics/throughput', {
    granularity: 'minute',
    query_filter: '',
    ...args,
  });
  if (!response.ok) return [];
  return response.data;
}

export async function getLabelsSummary(limit = 25): Promise<AnalyticsLabelsSummary> {
  const response: HTTPResponse = await HTTPUtils.get('analytics/labels/summary', {
    params: { limit },
  });
  if (!response.ok) return { total_entities: 0, top_labels: [], recent: [] };
  return response.data;
}
