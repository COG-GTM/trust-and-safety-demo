import dayjs from 'dayjs';

import {
  DashboardLayoutJson,
  DashboardTimeRange,
  DashboardWidget,
  DashboardWidgetType,
  DashboardWidgetTypes,
} from '../types/DashboardTypes';

const RELATIVE_INTERVALS: Record<string, [number, dayjs.ManipulateType]> = {
  '15m': [15, 'minute'],
  '1h': [1, 'hour'],
  '6h': [6, 'hour'],
  '24h': [24, 'hour'],
  '7d': [7, 'day'],
  '30d': [30, 'day'],
};

export const TIME_RANGE_OPTIONS = [
  { label: 'Last 15 minutes', value: '15m' },
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

export const GRANULARITY_OPTIONS = [
  { label: 'Minute', value: 'minute' },
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
];

export interface ResolvedTimeRange {
  startISO: string;
  endISO: string;
  /** Human label for the range. */
  label: string;
}

export function resolveTimeRange(timeRange?: DashboardTimeRange): ResolvedTimeRange {
  if (timeRange == null) {
    return resolveTimeRange({ interval: '24h' });
  }
  if (timeRange.interval === 'custom' && timeRange.start && timeRange.end) {
    return {
      startISO: timeRange.start,
      endISO: timeRange.end,
      label: `${dayjs(timeRange.start).format('M/D H:mm')} – ${dayjs(timeRange.end).format('M/D H:mm')}`,
    };
  }
  const tuple = RELATIVE_INTERVALS[timeRange.interval];
  if (tuple == null) {
    return resolveTimeRange({ interval: '24h' });
  }
  const [count, unit] = tuple;
  const end = dayjs();
  const start = end.subtract(count, unit);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    label: TIME_RANGE_OPTIONS.find((o) => o.value === timeRange.interval)?.label ?? timeRange.interval,
  };
}

let _idCounter = 0;
export function makeWidgetId(): string {
  _idCounter += 1;
  return `w_${Date.now().toString(36)}_${_idCounter.toString(36)}`;
}

export function makeDefaultWidget(type: DashboardWidgetType): DashboardWidget {
  return {
    id: makeWidgetId(),
    type,
    title: defaultTitleForType(type),
    layout: defaultLayoutForType(type),
    dataSource: defaultDataSourceForType(type),
    options: {},
  };
}

export function defaultTitleForType(type: DashboardWidgetType): string {
  switch (type) {
    case DashboardWidgetTypes.TIME_SERIES_CHART:
      return 'Events over time';
    case DashboardWidgetTypes.VERDICT_DISTRIBUTION_PIE:
      return 'Verdict distribution';
    case DashboardWidgetTypes.RULE_HIT_RATE_BAR:
      return 'Top rules by hits';
    case DashboardWidgetTypes.THROUGHPUT_GAUGE:
      return 'Current throughput';
    case DashboardWidgetTypes.LABEL_ACTIVITY_TABLE:
      return 'Recent label activity';
    case DashboardWidgetTypes.ERROR_RATE_INDICATOR:
      return 'Error rate';
    case DashboardWidgetTypes.TOP_ENTITIES_TABLE:
      return 'Top entities';
    case DashboardWidgetTypes.HEATMAP_CALENDAR:
      return 'Event volume heatmap';
    default:
      return 'Widget';
  }
}

export function defaultLayoutForType(type: DashboardWidgetType) {
  switch (type) {
    case DashboardWidgetTypes.THROUGHPUT_GAUGE:
    case DashboardWidgetTypes.ERROR_RATE_INDICATOR:
      return { x: 0, y: 0, w: 3, h: 3 };
    case DashboardWidgetTypes.VERDICT_DISTRIBUTION_PIE:
      return { x: 0, y: 0, w: 4, h: 5 };
    case DashboardWidgetTypes.TIME_SERIES_CHART:
    case DashboardWidgetTypes.HEATMAP_CALENDAR:
      return { x: 0, y: 0, w: 8, h: 5 };
    default:
      return { x: 0, y: 0, w: 6, h: 5 };
  }
}

export function defaultDataSourceForType(type: DashboardWidgetType) {
  switch (type) {
    case DashboardWidgetTypes.TIME_SERIES_CHART:
      return { granularity: 'hour', queryFilter: '' };
    case DashboardWidgetTypes.VERDICT_DISTRIBUTION_PIE:
      return { dimension: 'Verdict', limit: 10, queryFilter: '' };
    case DashboardWidgetTypes.RULE_HIT_RATE_BAR:
      return { dimension: 'RuleName', limit: 15, queryFilter: '' };
    case DashboardWidgetTypes.THROUGHPUT_GAUGE:
      return { granularity: 'minute', queryFilter: '' };
    case DashboardWidgetTypes.LABEL_ACTIVITY_TABLE:
      return { limit: 25 };
    case DashboardWidgetTypes.ERROR_RATE_INDICATOR:
      return { granularity: 'hour', queryFilter: 'HasError = true' };
    case DashboardWidgetTypes.TOP_ENTITIES_TABLE:
      return { dimension: 'EntityKey', limit: 25, queryFilter: '' };
    case DashboardWidgetTypes.HEATMAP_CALENDAR:
      return { granularity: 'hour', queryFilter: '' };
    default:
      return {};
  }
}

export function findNextWidgetSlot(layout: DashboardLayoutJson, w: number, h: number) {
  const cols = layout.gridColumns ?? 12;
  // Walk row by row, find first slot where the widget fits without colliding.
  const occupied = new Set<string>();
  for (const widget of layout.widgets) {
    for (let dx = 0; dx < widget.layout.w; dx += 1) {
      for (let dy = 0; dy < widget.layout.h; dy += 1) {
        occupied.add(`${widget.layout.x + dx},${widget.layout.y + dy}`);
      }
    }
  }
  for (let y = 0; y < 200; y += 1) {
    for (let x = 0; x <= cols - w; x += 1) {
      let collides = false;
      for (let dx = 0; dx < w && !collides; dx += 1) {
        for (let dy = 0; dy < h && !collides; dy += 1) {
          if (occupied.has(`${x + dx},${y + dy}`)) collides = true;
        }
      }
      if (!collides) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}
