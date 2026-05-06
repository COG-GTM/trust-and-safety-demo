/**
 * Type definitions for the analytics dashboard feature.
 *
 * A dashboard is a named collection of widgets laid out in a grid. Each widget
 * has a `type` (determines the visualization), a `dataSource` (determines what
 * the widget queries), an optional time range override and refresh interval,
 * and `options` for visual tweaks.
 */

export const DashboardWidgetTypes = {
  TIME_SERIES_CHART: 'timeSeriesChart',
  VERDICT_DISTRIBUTION_PIE: 'verdictDistributionPie',
  RULE_HIT_RATE_BAR: 'ruleHitRateBar',
  THROUGHPUT_GAUGE: 'throughputGauge',
  LABEL_ACTIVITY_TABLE: 'labelActivityTable',
  ERROR_RATE_INDICATOR: 'errorRateIndicator',
  TOP_ENTITIES_TABLE: 'topEntitiesTable',
  HEATMAP_CALENDAR: 'heatmapCalendar',
} as const;

export type DashboardWidgetType = (typeof DashboardWidgetTypes)[keyof typeof DashboardWidgetTypes];

export const ALL_DASHBOARD_WIDGET_TYPES: DashboardWidgetType[] = Object.values(DashboardWidgetTypes);

export interface DashboardTimeRange {
  /**
   * Either a relative interval like "1h", "24h", "7d" or "custom" if explicit
   * start/end timestamps are provided.
   */
  interval: string;
  /**
   * ISO 8601 string. Only meaningful when `interval === 'custom'` but always
   * stored so widgets can render historical snapshots without a backend round
   * trip.
   */
  start?: string;
  /**
   * ISO 8601 string. Only meaningful when `interval === 'custom'`.
   */
  end?: string;
}

export interface DashboardWidgetDataSource {
  /**
   * Druid filter expression in Osprey's SML query language. Empty string means
   * "all events".
   */
  queryFilter?: string;
  /**
   * Druid dimension to group by, when relevant for the widget type.
   */
  dimension?: string;
  /**
   * Time bucket size for time-series queries. One of: minute, hour, day, etc.
   */
  granularity?: string;
  /**
   * Limit for top-N style widgets.
   */
  limit?: number;
  /**
   * Verdict, action, or rule name to filter on.
   */
  actionName?: string;
}

export interface DashboardWidgetOptions {
  description?: string;
  /**
   * Hex color to override the widget's primary chart color.
   */
  primaryColor?: string;
  /**
   * Show a series total below the chart for time-series widgets.
   */
  showTotal?: boolean;
}

export interface DashboardWidgetLayout {
  /** Column index, 0 - (gridColumns - 1). */
  x: number;
  /** Row index, 0 - infinity. */
  y: number;
  /** Width in columns. */
  w: number;
  /** Height in row units. */
  h: number;
}

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  layout: DashboardWidgetLayout;
  dataSource: DashboardWidgetDataSource;
  options?: DashboardWidgetOptions;
  /** Optional per-widget time range overriding the dashboard global. */
  timeRange?: DashboardTimeRange;
  /** Refresh interval in seconds, 0 means "use dashboard global". */
  refreshIntervalSeconds?: number;
}

export interface DashboardLayoutJson {
  version: number;
  widgets: DashboardWidget[];
  /** Default global time range applied when no widget override is set. */
  defaultTimeRange?: DashboardTimeRange;
  /** Dashboard-wide query filter (SML expression). */
  globalQueryFilter?: string;
  /** Refresh interval in seconds, 0 = no auto refresh. */
  refreshIntervalSeconds?: number;
  gridColumns?: number;
}

export interface DashboardSummary {
  id: string;
  name: string;
  owner: string;
  description?: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardRecord extends DashboardSummary {
  layout_json: DashboardLayoutJson;
}

export interface CreateDashboardRequest {
  name: string;
  description?: string;
  layout_json?: DashboardLayoutJson;
  is_template?: boolean;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  layout_json?: DashboardLayoutJson;
  is_template?: boolean;
}

/* ------------------------------------------------------------------ */
/* Analytics response types                                            */
/* ------------------------------------------------------------------ */

export interface AnalyticsTimeseriesPoint {
  timestamp: string;
  result: { count: number } & Record<string, number>;
}

export interface AnalyticsGroupByItem {
  count: number;
  /** Druid TopN puts the dimension value under the dimension key. */
  [dimension: string]: string | number | undefined;
}

export interface AnalyticsGroupByPeriod {
  timestamp: string;
  result: AnalyticsGroupByItem[];
}

export interface AnalyticsGroupByResponse {
  current_period: AnalyticsGroupByPeriod[];
  previous_period?: AnalyticsGroupByPeriod[] | null;
  comparison?: unknown;
}

export interface AnalyticsLabelsSummary {
  total_entities: number;
  top_labels: { label_name: string; count: number }[];
  recent: { entity_key: string; labels: Record<string, unknown> }[];
}
