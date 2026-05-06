import * as React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Spin } from 'antd';

import { getAnalyticsTimeseries } from '../../../actions/DashboardActions';
import { AnalyticsTimeseriesPoint, DashboardWidget } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';

interface Props {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

const ErrorRateIndicatorWidget = ({ widget, ctx }: Props) => {
  const [points, setPoints] = React.useState<AnalyticsTimeseriesPoint[] | null>(null);
  const granularity = widget.dataSource.granularity ?? 'hour';
  // The Error Rate widget is, by definition, scoped to errors. Always intersect
  // the merged context filter with HasError = true so that user-supplied filters
  // (e.g. ActionName = "post") narrow the error population rather than replacing
  // it. ctx.queryFilter is wrapped in parens by buildWidgetContext when needed,
  // so 'HasError = true' is safely AND'd as a sibling clause.
  const errorClause = 'HasError = true';
  const trimmedCtx = ctx.queryFilter.trim();
  const effectiveFilter = trimmedCtx ? `${trimmedCtx} AND ${errorClause}` : errorClause;

  React.useEffect(() => {
    let cancelled = false;
    setPoints(null);
    getAnalyticsTimeseries({
      start: ctx.start,
      end: ctx.end,
      query_filter: effectiveFilter,
      granularity,
    }).then((p) => {
      if (!cancelled) setPoints(p);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.start, ctx.end, effectiveFilter, ctx.refreshKey, granularity]);

  if (points == null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin />
      </div>
    );
  }

  const total = points.reduce((acc, p) => acc + (p.result?.count ?? 0), 0);
  const peak = points.reduce((m, p) => Math.max(m, p.result?.count ?? 0), 0);
  const counts = points.map((p) => p.result?.count ?? 0);
  const sparkOptions: Highcharts.Options = {
    chart: { type: 'areaspline', height: 50, backgroundColor: 'transparent', spacing: [0, 0, 0, 0] },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: { visible: false },
    yAxis: { visible: false, min: 0 },
    plotOptions: { areaspline: { marker: { enabled: false }, color: '#b23a32', fillOpacity: 0.3 } },
    series: [{ type: 'areaspline', data: counts, name: 'errors' }],
    tooltip: { enabled: false },
  };

  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 28, fontWeight: 600, color: '#b23a32', lineHeight: 1 }}>{total.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        Errors in window · peak bucket {peak.toLocaleString()}
      </div>
      <HighchartsReact highcharts={Highcharts} options={sparkOptions} />
    </div>
  );
};

export default ErrorRateIndicatorWidget;
