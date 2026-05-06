import { BaseQueryRequest } from '../types/QueryTypes';
import {
  SummaryResponse,
  RulePerformanceResponse,
  LabelActivityResponse,
  VerdictDistributionResponse,
  RecentAlertsResponse,
  EntityProfileResponse,
} from '../types/DashboardTypes';
import HTTPUtils, { HTTPResponse } from '../utils/HTTPUtils';

import { getBaseRequest } from './EventActions';

const EMPTY_SERIES = { total: 0, points: [] };

const EMPTY_SUMMARY: SummaryResponse = {
  events: EMPTY_SERIES,
  rules_fired: EMPTY_SERIES,
  labels_applied: EMPTY_SERIES,
  verdicts_issued: EMPTY_SERIES,
};

export async function getDashboardSummary(
  query: BaseQueryRequest,
  granularity: string = 'hour'
): Promise<SummaryResponse> {
  const response: HTTPResponse = await HTTPUtils.post('dashboard/summary', {
    ...getBaseRequest(query),
    granularity,
  });
  if (!response.ok) return EMPTY_SUMMARY;
  return response.data as SummaryResponse;
}

export async function getRulePerformance(
  query: BaseQueryRequest,
  granularity: string = 'hour',
  topN: number = 10
): Promise<RulePerformanceResponse> {
  const response: HTTPResponse = await HTTPUtils.post('dashboard/rule-performance', {
    ...getBaseRequest(query),
    granularity,
    /* eslint-disable-next-line */
    top_n: topN,
  });
  if (!response.ok) return { rules: [], series: [], false_positive_rate: null };
  return response.data as RulePerformanceResponse;
}

export async function getLabelActivity(
  query: BaseQueryRequest,
  granularity: string = 'hour',
  topN: number = 10
): Promise<LabelActivityResponse> {
  const response: HTTPResponse = await HTTPUtils.post('dashboard/label-activity', {
    ...getBaseRequest(query),
    granularity,
    /* eslint-disable-next-line */
    top_n: topN,
  });
  if (!response.ok) return { points: [], label_names: [] };
  return response.data as LabelActivityResponse;
}

export async function getVerdictDistribution(query: BaseQueryRequest): Promise<VerdictDistributionResponse> {
  const response: HTTPResponse = await HTTPUtils.post('dashboard/verdict-distribution', {
    ...getBaseRequest(query),
  });
  if (!response.ok) return { buckets: [], total: 0 };
  return response.data as VerdictDistributionResponse;
}

export async function getRecentAlerts(query: BaseQueryRequest, limit: number = 25): Promise<RecentAlertsResponse> {
  const response: HTTPResponse = await HTTPUtils.post('dashboard/recent-alerts', {
    ...getBaseRequest(query),
    limit,
  });
  if (!response.ok) return { alerts: [] };
  return response.data as RecentAlertsResponse;
}

export async function getEntityProfile(entityType: string, entityId: string): Promise<EntityProfileResponse | null> {
  const response: HTTPResponse = await HTTPUtils.get(
    `entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/profile`
  );
  if (!response.ok) return null;
  return response.data as EntityProfileResponse;
}
