/**
 * Shared helpers for dashboard widget components.
 */

import * as React from 'react';

import { DashboardLayoutJson, DashboardTimeRange, DashboardWidget } from '../../types/DashboardTypes';
import { resolveTimeRange } from '../../utils/DashboardUtils';

export interface WidgetRenderContext {
  /** Resolved start timestamp (ISO 8601). */
  start: string;
  /** Resolved end timestamp (ISO 8601). */
  end: string;
  /** Effective query filter applied to the widget. */
  queryFilter: string;
  /** Refresh tick — a counter that increments when widgets should re-fetch. */
  refreshKey: number;
}

export function buildWidgetContext(
  widget: DashboardWidget,
  layout: DashboardLayoutJson,
  refreshKey: number
): WidgetRenderContext {
  const tr: DashboardTimeRange = widget.timeRange ?? layout.defaultTimeRange ?? { interval: '24h' };
  const resolved = resolveTimeRange(tr);
  const widgetFilter = widget.dataSource.queryFilter?.trim();
  const globalFilter = layout.globalQueryFilter?.trim();
  const queryFilter = [globalFilter, widgetFilter].filter(Boolean).join(' AND ');
  return {
    start: resolved.startISO,
    end: resolved.endISO,
    queryFilter,
    refreshKey,
  };
}

export function useDashboardRefreshTick(intervalSeconds: number | undefined) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!intervalSeconds || intervalSeconds <= 0) return undefined;
    const handle = window.setInterval(() => setTick((t) => t + 1), intervalSeconds * 1000);
    return () => window.clearInterval(handle);
  }, [intervalSeconds]);
  const force = React.useCallback(() => setTick((t) => t + 1), []);
  return { tick, force };
}
