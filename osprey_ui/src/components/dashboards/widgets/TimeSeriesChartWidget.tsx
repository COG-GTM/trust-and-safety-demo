import * as React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import dayjs from 'dayjs';
import { Spin, Empty } from 'antd';

import { getAnalyticsTimeseries } from '../../../actions/DashboardActions';
import { AnalyticsTimeseriesPoint, DashboardWidget } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';

interface TimeSeriesChartWidgetProps {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

const TimeSeriesChartWidget = ({ widget, ctx }: TimeSeriesChartWidgetProps) => {
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

  if (points.length === 0) {
    return <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const data = points.map((p) => [dayjs(p.timestamp).valueOf(), p.result?.count ?? 0]);
  const total = data.reduce((acc, [, v]) => acc + (typeof v === 'number' ? v : 0), 0);

  const options: Highcharts.Options = {
    chart: { type: 'areaspline', height: 240, backgroundColor: 'transparent' },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: { type: 'datetime' },
    yAxis: { title: { text: undefined } },
    plotOptions: {
      areaspline: {
        marker: { enabled: false },
        fillOpacity: 0.2,
        color: widget.options?.primaryColor ?? '#1227ce',
      },
    },
    series: [{ name: 'Events', type: 'areaspline', data }],
    tooltip: { xDateFormat: '%b %e %l%p' },
  };

  return (
    <div style={{ height: '100%' }}>
      <HighchartsReact highcharts={Highcharts} options={options} />
      {widget.options?.showTotal !== false ? (
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
          Total: {total.toLocaleString()}
        </div>
      ) : null}
    </div>
  );
};

export default TimeSeriesChartWidget;
