import * as React from 'react';

import { DashboardWidget, DashboardWidgetType, DashboardWidgetTypes } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';
import ErrorRateIndicatorWidget from './ErrorRateIndicatorWidget';
import HeatmapCalendarWidget from './HeatmapCalendarWidget';
import LabelActivityTableWidget from './LabelActivityTableWidget';
import RuleHitRateBarWidget from './RuleHitRateBarWidget';
import ThroughputGaugeWidget from './ThroughputGaugeWidget';
import TimeSeriesChartWidget from './TimeSeriesChartWidget';
import TopEntitiesTableWidget from './TopEntitiesTableWidget';
import VerdictDistributionPieWidget from './VerdictDistributionPieWidget';

interface RendererProps {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

export const WIDGET_REGISTRY: Record<
  DashboardWidgetType,
  { label: string; render: React.ComponentType<RendererProps> }
> = {
  [DashboardWidgetTypes.TIME_SERIES_CHART]: { label: 'Time-series chart', render: TimeSeriesChartWidget },
  [DashboardWidgetTypes.VERDICT_DISTRIBUTION_PIE]: {
    label: 'Verdict distribution pie',
    render: VerdictDistributionPieWidget,
  },
  [DashboardWidgetTypes.RULE_HIT_RATE_BAR]: { label: 'Rule hit-rate bar', render: RuleHitRateBarWidget },
  [DashboardWidgetTypes.THROUGHPUT_GAUGE]: { label: 'Throughput gauge', render: ThroughputGaugeWidget },
  [DashboardWidgetTypes.LABEL_ACTIVITY_TABLE]: { label: 'Label activity table', render: LabelActivityTableWidget },
  [DashboardWidgetTypes.ERROR_RATE_INDICATOR]: { label: 'Error rate indicator', render: ErrorRateIndicatorWidget },
  [DashboardWidgetTypes.TOP_ENTITIES_TABLE]: { label: 'Top entities table', render: TopEntitiesTableWidget },
  [DashboardWidgetTypes.HEATMAP_CALENDAR]: { label: 'Heatmap calendar', render: HeatmapCalendarWidget },
};

export function renderWidget(widget: DashboardWidget, ctx: WidgetRenderContext) {
  const entry = WIDGET_REGISTRY[widget.type];
  if (entry == null) {
    return <div>Unknown widget type: {widget.type}</div>;
  }
  const Renderer = entry.render;
  return <Renderer widget={widget} ctx={ctx} />;
}
