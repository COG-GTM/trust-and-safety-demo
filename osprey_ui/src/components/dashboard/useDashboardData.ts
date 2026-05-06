import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';

import { getTimeseriesQueryResults, getScanQueryResults } from '../../actions/EventActions';
import { OspreyEvent, ScanQueryOrder } from '../../types/QueryTypes';

export interface KpiData {
  totalEvents: number;
  flaggedEvents: number;
  flaggedRate: number;
  flaggedPostCount: number;
  uniqueUsers: number;
  banActions: number;
  errorRate: number;
  avgEventsPerHour: number;
}

export interface HourlyBucket {
  hour: number;
  total: number;
  posts: number;
  logins: number;
  flagged: number;
  flagRate: number;
}

export interface FlaggedUser {
  userId: string;
  flagCount: number;
  totalEvents: number;
  flagRate: number;
}

export interface FlaggedEvent {
  id: string;
  timestamp: string;
  userId: string;
  postText: string;
  banReason: string;
  labelMutation: string;
}

export interface ActionBreakdown {
  name: string;
  count: number;
}

export interface TimeseriesPoint {
  timestamp: string;
  count: number;
}

export interface DashboardData {
  kpis: KpiData;
  hourlyBuckets: HourlyBucket[];
  topFlaggedUsers: FlaggedUser[];
  flaggedEvents: FlaggedEvent[];
  actionBreakdown: ActionBreakdown[];
  timeseries: TimeseriesPoint[];
  isLoading: boolean;
}

function computeDashboardMetrics(events: OspreyEvent[]): Omit<DashboardData, 'timeseries' | 'isLoading'> {
  const totalEvents = events.length;

  const userEventMap = new Map<string, { total: number; flagged: number }>();
  const hourlyMap = new Map<number, { total: number; posts: number; logins: number; flagged: number }>();
  const actionCounts = new Map<string, number>();
  const flaggedEventsList: FlaggedEvent[] = [];

  let flaggedCount = 0;
  let flaggedPostCount = 0;
  let banCount = 0;
  let errorCount = 0;

  for (const event of events) {
    const features = event.extracted_features;
    const userId = features.UserId ?? 'unknown';
    const eventType = features.EventType ?? features.ActionName ?? '';
    const isFlagged = features.ContainsHello === true || features.ContainsHello === 'true';
    const hasBan = features.__ban_user != null && features.__ban_user !== '';
    const hasError = (features.__error_count ?? 0) > 0;

    // Action counts
    actionCounts.set(eventType, (actionCounts.get(eventType) ?? 0) + 1);

    // Flagged / ban / error
    if (isFlagged) flaggedCount++;
    if (isFlagged && eventType === 'create_post') flaggedPostCount++;
    if (hasBan) banCount++;
    if (hasError) errorCount++;

    // Per-user tracking
    const userEntry = userEventMap.get(userId) ?? { total: 0, flagged: 0 };
    userEntry.total++;
    if (isFlagged) userEntry.flagged++;
    userEventMap.set(userId, userEntry);

    // Hourly buckets
    const hour = dayjs(event.timestamp).hour();
    const hourEntry = hourlyMap.get(hour) ?? { total: 0, posts: 0, logins: 0, flagged: 0 };
    hourEntry.total++;
    if (eventType === 'create_post') hourEntry.posts++;
    if (eventType === 'login') hourEntry.logins++;
    if (isFlagged) hourEntry.flagged++;
    hourlyMap.set(hour, hourEntry);

    // Flagged events feed
    if (isFlagged && flaggedEventsList.length < 20) {
      flaggedEventsList.push({
        id: event.id,
        timestamp: event.timestamp,
        userId,
        postText: features.PostText ?? '',
        banReason: features.__ban_user ?? '',
        labelMutation: features.__entity_label_mutations ?? '',
      });
    }
  }

  // KPIs
  const uniqueUsers = userEventMap.size;
  const hours = new Set(events.map((e) => dayjs(e.timestamp).format('YYYY-MM-DD HH'))).size || 1;

  const kpis: KpiData = {
    totalEvents: totalEvents,
    flaggedEvents: flaggedCount,
    flaggedRate: totalEvents > 0 ? (flaggedCount / totalEvents) * 100 : 0,
    flaggedPostCount,
    uniqueUsers,
    banActions: banCount,
    errorRate: totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0,
    avgEventsPerHour: Math.round(totalEvents / hours),
  };

  // Hourly buckets sorted
  const hourlyBuckets: HourlyBucket[] = [];
  for (let h = 0; h < 24; h++) {
    const entry = hourlyMap.get(h) ?? { total: 0, posts: 0, logins: 0, flagged: 0 };
    hourlyBuckets.push({
      hour: h,
      total: entry.total,
      posts: entry.posts,
      logins: entry.logins,
      flagged: entry.flagged,
      flagRate: entry.total > 0 ? (entry.flagged / entry.total) * 100 : 0,
    });
  }

  // Top flagged users
  const topFlaggedUsers: FlaggedUser[] = [...userEventMap.entries()]
    .filter(([, data]) => data.flagged > 0)
    .map(([userId, data]) => ({
      userId,
      flagCount: data.flagged,
      totalEvents: data.total,
      flagRate: (data.flagged / data.total) * 100,
    }))
    .sort((a, b) => b.flagCount - a.flagCount)
    .slice(0, 15);

  // Action breakdown
  const actionBreakdown: ActionBreakdown[] = [...actionCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { kpis, hourlyBuckets, topFlaggedUsers, flaggedEvents: flaggedEventsList, actionBreakdown };
}

export function useDashboardData(): DashboardData {
  const [events, setEvents] = useState<OspreyEvent[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const now = dayjs.utc();
      const start = now.subtract(1, 'day').toISOString();
      const end = now.toISOString();

      const baseQuery = { start, end, queryFilter: '', interval: 'day' as const };

      try {
        // Fetch timeseries
        const tsData = await getTimeseriesQueryResults(baseQuery, 'hour');
        setTimeseries(tsData.map((p) => ({ timestamp: p.timestamp, count: p.result.count })));

        // Fetch all events (paginate through)
        const allEvents: OspreyEvent[] = [];
        let offset: string | null = null;
        let hasMore = true;

        while (hasMore) {
          const result = await getScanQueryResults(baseQuery, ScanQueryOrder.DESCENDING, 100, offset);
          allEvents.push(...result.events);
          offset = result.offset;
          hasMore = result.offset != null && result.events.length > 0;
        }

        setEvents(allEvents);
      } catch {
        // If API fails, we'll show empty state
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const metrics = useMemo(() => computeDashboardMetrics(events), [events]);

  return { ...metrics, timeseries, isLoading };
}
