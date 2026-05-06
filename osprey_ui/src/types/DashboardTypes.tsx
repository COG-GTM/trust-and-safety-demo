import { Layout } from 'react-grid-layout';

export const WidgetTypes = {
  KPI: 'kpi',
  RULE_HITS_TIMESERIES: 'rule_hits_timeseries',
  RULE_DISTRIBUTION: 'rule_distribution',
  EFFECTS_BREAKDOWN: 'effects_breakdown',
  TOP_ENTITIES: 'top_entities',
  LIVE_EVENT_STREAM: 'live_event_stream',
  LABEL_ACTIVITY: 'label_activity',
} as const;

export type WidgetType = (typeof WidgetTypes)[keyof typeof WidgetTypes];

export type WidgetTimeWindow = '1h' | '24h' | '7d' | '30d';
export const TIME_WINDOWS: { value: WidgetTimeWindow; label: string }[] = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export type WidgetGranularity = 'minute' | 'fifteen_minute' | 'thirty_minute' | 'hour' | 'day' | 'week' | 'month';

export interface BaseWidgetConfig {
  title?: string;
  queryFilter?: string;
  window?: WidgetTimeWindow;
}

export interface KpiWidgetConfig extends BaseWidgetConfig {
  metric?: 'total_events' | 'total_buckets';
}

export interface TimeseriesWidgetConfig extends BaseWidgetConfig {
  granularity?: WidgetGranularity;
}

export interface DistributionWidgetConfig extends BaseWidgetConfig {
  dimension?: string;
  limit?: number;
}

export interface TopEntitiesWidgetConfig extends BaseWidgetConfig {
  dimension: string;
  limit?: number;
}

export interface LiveStreamWidgetConfig extends BaseWidgetConfig {
  limit?: number;
}

export type WidgetConfig =
  | (KpiWidgetConfig & { type: typeof WidgetTypes.KPI })
  | (TimeseriesWidgetConfig & { type: typeof WidgetTypes.RULE_HITS_TIMESERIES })
  | (DistributionWidgetConfig & { type: typeof WidgetTypes.RULE_DISTRIBUTION })
  | (DistributionWidgetConfig & { type: typeof WidgetTypes.EFFECTS_BREAKDOWN })
  | (TopEntitiesWidgetConfig & { type: typeof WidgetTypes.TOP_ENTITIES })
  | (LiveStreamWidgetConfig & { type: typeof WidgetTypes.LIVE_EVENT_STREAM })
  | (BaseWidgetConfig & { type: typeof WidgetTypes.LABEL_ACTIVITY });

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  config: BaseWidgetConfig & Record<string, unknown>;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  rgl: Layout[];
}

export interface Dashboard {
  id: string;
  name: string;
  created_by: string;
  layout_json: DashboardLayout;
  created_at: string | null;
  updated_at: string | null;
}

export interface DashboardCreateRequest {
  name: string;
  layout_json: DashboardLayout;
}

export interface DashboardUpdateRequest {
  name?: string;
  layout_json?: DashboardLayout;
}

export interface DistributionEntry {
  name: string;
  count: number;
}

export interface DistributionResponse {
  dimension: string;
  distribution: DistributionEntry[];
}

export interface KpiSummaryResponse {
  total_events: number;
  total_buckets: number;
  start: string;
  end: string;
}

export const WIDGET_LABELS: Record<WidgetType, string> = {
  [WidgetTypes.KPI]: 'Event Volume KPI',
  [WidgetTypes.RULE_HITS_TIMESERIES]: 'Rule Hits Time Series',
  [WidgetTypes.RULE_DISTRIBUTION]: 'Rule Distribution',
  [WidgetTypes.EFFECTS_BREAKDOWN]: 'Effects Breakdown',
  [WidgetTypes.TOP_ENTITIES]: 'Top Entities',
  [WidgetTypes.LIVE_EVENT_STREAM]: 'Live Event Stream',
  [WidgetTypes.LABEL_ACTIVITY]: 'Label Activity',
};

export const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  [WidgetTypes.KPI]: 'Total events processed over a configurable window.',
  [WidgetTypes.RULE_HITS_TIMESERIES]: 'Time-series chart of rule execution hits.',
  [WidgetTypes.RULE_DISTRIBUTION]: 'Pie chart of which rules fired most often.',
  [WidgetTypes.EFFECTS_BREAKDOWN]: 'Distribution of effects triggered by rules.',
  [WidgetTypes.TOP_ENTITIES]: 'Top N most frequently flagged entities.',
  [WidgetTypes.LIVE_EVENT_STREAM]: 'Scrolling feed of recent matching events.',
  [WidgetTypes.LABEL_ACTIVITY]: 'Most recently labeled entities.',
};

export const DEFAULT_WIDGET_LAYOUTS: Record<WidgetType, { w: number; h: number; minW?: number; minH?: number }> = {
  [WidgetTypes.KPI]: { w: 3, h: 3, minW: 2, minH: 2 },
  [WidgetTypes.RULE_HITS_TIMESERIES]: { w: 8, h: 6, minW: 4, minH: 4 },
  [WidgetTypes.RULE_DISTRIBUTION]: { w: 4, h: 6, minW: 3, minH: 4 },
  [WidgetTypes.EFFECTS_BREAKDOWN]: { w: 4, h: 6, minW: 3, minH: 4 },
  [WidgetTypes.TOP_ENTITIES]: { w: 4, h: 6, minW: 3, minH: 4 },
  [WidgetTypes.LIVE_EVENT_STREAM]: { w: 4, h: 8, minW: 3, minH: 4 },
  [WidgetTypes.LABEL_ACTIVITY]: { w: 4, h: 6, minW: 3, minH: 4 },
};
