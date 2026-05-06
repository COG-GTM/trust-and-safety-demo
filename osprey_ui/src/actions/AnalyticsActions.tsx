import { DistributionResponse, KpiSummaryResponse, WidgetTimeWindow } from '../types/DashboardTypes';
import HTTPUtils, { HTTPResponse } from '../utils/HTTPUtils';

export interface AnalyticsRequest {
  window: WidgetTimeWindow;
  queryFilter?: string;
  dimension?: string;
  limit?: number;
  granularity?: string;
}

export function resolveWindowToRange(window: WidgetTimeWindow): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  const start = new Date(now);
  switch (window) {
    case '1h':
      start.setHours(start.getHours() - 1);
      break;
    case '24h':
      start.setDate(start.getDate() - 1);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
    default:
      start.setDate(start.getDate() - 30);
  }
  return { start: start.toISOString(), end };
}

function buildBaseRequest(req: AnalyticsRequest) {
  const { start, end } = resolveWindowToRange(req.window);
  /* eslint-disable */
  return {
    start,
    end,
    query_filter: req.queryFilter ?? '',
    entity: null,
  };
  /* eslint-enable */
}

export async function getRuleDistribution(req: AnalyticsRequest): Promise<DistributionResponse> {
  const response: HTTPResponse = await HTTPUtils.post('analytics/rule-distribution', {
    ...buildBaseRequest(req),
    dimension: req.dimension ?? 'ActionName',
    limit: req.limit ?? 10,
  });
  if (!response.ok) return { dimension: req.dimension ?? 'ActionName', distribution: [] };
  return response.data as DistributionResponse;
}

export async function getEffectsBreakdown(req: AnalyticsRequest): Promise<DistributionResponse> {
  const response: HTTPResponse = await HTTPUtils.post('analytics/effects-breakdown', {
    ...buildBaseRequest(req),
    dimension: req.dimension ?? 'EffectName',
    limit: req.limit ?? 10,
  });
  if (!response.ok) return { dimension: req.dimension ?? 'EffectName', distribution: [] };
  return response.data as DistributionResponse;
}

export async function getKpiSummary(req: AnalyticsRequest): Promise<KpiSummaryResponse> {
  const { start, end } = resolveWindowToRange(req.window);
  const response: HTTPResponse = await HTTPUtils.post('analytics/kpi-summary', {
    ...buildBaseRequest(req),
    granularity: req.granularity ?? 'hour',
  });
  if (!response.ok) {
    return { total_events: 0, total_buckets: 0, start, end };
  }
  return response.data as KpiSummaryResponse;
}
