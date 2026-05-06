import * as React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import dayjs from 'dayjs';
import { Spin } from 'antd';

import { getThroughput } from '../../../actions/DashboardActions';
import { AnalyticsTimeseriesPoint, DashboardWidget } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';

interface Props {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

const ThroughputGaugeWidget = ({ widget, ctx }: Props) => {
  const [points, setPoints] = React.useState<AnalyticsTimeseriesPoint[] | null>(null);
  const granularity = widget.dataSource.granularity ?? 'minute';

  React.useEffect(() => {
    let cancelled = false;
    setPoints(null);
    getThroughput({
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

  const counts = points.map((p) => p.result?.count ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const last = counts[counts.length - 1] ?? 0;
  const bucketSeconds = granularityToSeconds(granularity);
  const eventsPerSec = bucketSeconds ? last / bucketSeconds : 0;

  const sparkOptions: Highcharts.Options = {
    chart: { type: 'areaspline', height: 60, backgroundColor: 'transparent', spacing: [0, 0, 0, 0] },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: { type: 'datetime', visible: false },
    yAxis: { visible: false, min: 0 },
    plotOptions: {
      areaspline: { marker: { enabled: false }, color: widget.options?.primaryColor ?? '#1227ce', fillOpacity: 0.25 },
    },
    series: [
      {
        type: 'areaspline',
        data: points.map((p) => [dayjs(p.timestamp).valueOf(), p.result?.count ?? 0]),
        name: 'Events',
      },
    ],
    tooltip: { enabled: false },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8 }}>
      <div style={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>{eventsPerSec.toFixed(1)} ev/s</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        {total.toLocaleString()} events in window · last bucket {last.toLocaleString()}
      </div>
      <HighchartsReact highcharts={Highcharts} options={sparkOptions} />
    </div>
  );
};

function granularityToSeconds(granularity: string): number {
  switch (granularity) {
    case 'minute':
      return 60;
    case 'fifteen_minute':
      return 60 * 15;
    case 'thirty_minute':
      return 60 * 30;
    case 'hour':
      return 60 * 60;
    case 'day':
      return 60 * 60 * 24;
    default:
      return 60;
  }
}

export default ThroughputGaugeWidget;
