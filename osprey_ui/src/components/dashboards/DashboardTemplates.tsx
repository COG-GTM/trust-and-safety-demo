/**
 * Pre-built dashboard layouts users can start from.
 */

import { DashboardLayoutJson, DashboardWidget, DashboardWidgetTypes } from '../../types/DashboardTypes';
import { DEFAULT_TIME_RANGE } from '../../stores/DashboardStore';
import { defaultTitleForType, makeWidgetId } from '../../utils/DashboardUtils';

function widget(
  type: keyof typeof DashboardWidgetTypes,
  layout: { x: number; y: number; w: number; h: number },
  overrides: Partial<DashboardWidget> = {}
): DashboardWidget {
  const widgetType = DashboardWidgetTypes[type];
  return {
    id: makeWidgetId(),
    type: widgetType,
    title: overrides.title ?? defaultTitleForType(widgetType),
    layout,
    dataSource: overrides.dataSource ?? {},
    options: overrides.options,
  };
}

function build(widgets: DashboardWidget[]): DashboardLayoutJson {
  return {
    version: 1,
    widgets,
    defaultTimeRange: DEFAULT_TIME_RANGE,
    globalQueryFilter: '',
    refreshIntervalSeconds: 30,
    gridColumns: 12,
  };
}

export interface DashboardTemplate {
  key: string;
  name: string;
  description: string;
  build: () => DashboardLayoutJson;
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    key: 'operations-overview',
    name: 'Operations Overview',
    description: 'Throughput, verdict mix, error rate, and event volume at a glance.',
    build: () =>
      build([
        widget('THROUGHPUT_GAUGE', { x: 0, y: 0, w: 3, h: 3 }, { dataSource: { granularity: 'minute' } }),
        widget('ERROR_RATE_INDICATOR', { x: 3, y: 0, w: 3, h: 3 }),
        widget(
          'VERDICT_DISTRIBUTION_PIE',
          { x: 6, y: 0, w: 6, h: 5 },
          { dataSource: { dimension: 'Verdict', limit: 10 } }
        ),
        widget(
          'TIME_SERIES_CHART',
          { x: 0, y: 3, w: 6, h: 5 },
          { title: 'Events processed', dataSource: { granularity: 'hour' } }
        ),
        widget(
          'HEATMAP_CALENDAR',
          { x: 0, y: 8, w: 12, h: 4 },
          { title: 'Hourly volume', dataSource: { granularity: 'hour' } }
        ),
      ]),
  },
  {
    key: 'rule-performance',
    name: 'Rule Performance',
    description: 'Per-rule hit rates and time-series trends. Useful for tuning rules.',
    build: () =>
      build([
        widget('RULE_HIT_RATE_BAR', { x: 0, y: 0, w: 6, h: 6 }, { dataSource: { dimension: 'RuleName', limit: 20 } }),
        widget(
          'TIME_SERIES_CHART',
          { x: 6, y: 0, w: 6, h: 6 },
          { title: 'Rule hits over time', dataSource: { granularity: 'hour' } }
        ),
        widget(
          'ERROR_RATE_INDICATOR',
          { x: 0, y: 6, w: 4, h: 3 },
          { title: 'Rule errors', dataSource: { granularity: 'hour' } }
        ),
      ]),
  },
  {
    key: 'entity-investigation',
    name: 'Entity Investigation',
    description: 'Top entities by activity, recent label mutations, and label distribution.',
    build: () =>
      build([
        widget('TOP_ENTITIES_TABLE', { x: 0, y: 0, w: 6, h: 6 }, { dataSource: { dimension: 'EntityKey', limit: 25 } }),
        widget('LABEL_ACTIVITY_TABLE', { x: 6, y: 0, w: 6, h: 6 }),
        widget(
          'TIME_SERIES_CHART',
          { x: 0, y: 6, w: 12, h: 4 },
          { title: 'Entity events over time', dataSource: { granularity: 'hour' } }
        ),
      ]),
  },
];

export const EMPTY_LAYOUT: DashboardLayoutJson = build([]);
