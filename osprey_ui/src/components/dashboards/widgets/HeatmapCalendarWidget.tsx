import * as React from 'react';
import dayjs from 'dayjs';
import { Spin, Empty } from 'antd';

import { getAnalyticsTimeseries } from '../../../actions/DashboardActions';
import { AnalyticsTimeseriesPoint, DashboardWidget } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';

interface Props {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

/**
 * Compact custom heatmap rendered as plain divs. We avoid Highcharts' heatmap
 * module (not vendored in this repo) so this works with what's already in
 * `package.json`.
 */
const HeatmapCalendarWidget = ({ widget, ctx }: Props) => {
  const [points, setPoints] = React.useState<AnalyticsTimeseriesPoint[] | null>(null);
  const granularity = widget.dataSource.granularity ?? 'hour';

  React.useEffect(() => {
    let cancelled = false;
    setPoints(null);
    getAnalyticsTimeseries({
      start: ctx.start,
      end: ctx.end,
      query_filter: ctx.queryFilter,
      granularity,
    }).then((p) => {
      if (!cancelled) setPoints(p);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.start, ctx.end, ctx.queryFilter, ctx.refreshKey, granularity]);

  if (points == null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin />
      </div>
    );
  }
  if (points.length === 0) return <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const grid: { [day: string]: { [hour: number]: number } } = {};
  let max = 0;
  for (const p of points) {
    const d = dayjs(p.timestamp);
    const dayKey = d.format('YYYY-MM-DD');
    const hour = d.hour();
    const count = p.result?.count ?? 0;
    if (grid[dayKey] == null) grid[dayKey] = {};
    grid[dayKey][hour] = (grid[dayKey][hour] ?? 0) + count;
    if (grid[dayKey][hour] > max) max = grid[dayKey][hour];
  }

  const days = Object.keys(grid).sort();

  return (
    <div style={{ overflow: 'auto', padding: 4 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 10, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', paddingRight: 6, color: 'var(--text-secondary)' }}>Day</th>
            {Array.from({ length: 24 }).map((_, h) => (
              <th key={h} style={{ width: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>
                {h % 6 === 0 ? `${h}:00` : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <td style={{ paddingRight: 6, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {dayjs(day).format('M/D')}
              </td>
              {Array.from({ length: 24 }).map((_, h) => {
                const v = grid[day][h] ?? 0;
                const intensity = max === 0 ? 0 : v / max;
                const bg = intensity === 0 ? '#f0f1f2' : `rgba(18, 39, 206, ${0.1 + intensity * 0.8})`;
                return (
                  <td
                    key={h}
                    title={`${day} ${h}:00 — ${v.toLocaleString()} events`}
                    style={{ width: 16, height: 16, padding: 0, background: bg, border: '1px solid #fff' }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HeatmapCalendarWidget;
