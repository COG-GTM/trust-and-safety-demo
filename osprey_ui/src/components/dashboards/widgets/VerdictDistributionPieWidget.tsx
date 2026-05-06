import * as React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Spin, Empty } from 'antd';

import { getVerdictsSummary } from '../../../actions/DashboardActions';
import { AnalyticsGroupByItem, DashboardWidget } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';

interface Props {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

const VerdictDistributionPieWidget = ({ widget, ctx }: Props) => {
  const [items, setItems] = React.useState<AnalyticsGroupByItem[] | null>(null);
  const dimension = widget.dataSource.dimension ?? 'Verdict';
  const limit = widget.dataSource.limit ?? 10;

  React.useEffect(() => {
    let cancelled = false;
    setItems(null);
    getVerdictsSummary({
      start: ctx.start,
      end: ctx.end,
      query_filter: ctx.queryFilter,
      dimension,
      limit,
    }).then((res) => {
      if (cancelled) return;
      const periods = res.current_period ?? [];
      const flattened: AnalyticsGroupByItem[] = [];
      for (const period of periods) {
        for (const row of period.result ?? []) {
          flattened.push(row);
        }
      }
      setItems(flattened);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.start, ctx.end, ctx.queryFilter, ctx.refreshKey, dimension, limit]);

  if (items == null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin />
      </div>
    );
  }
  if (items.length === 0) return <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const data = items.map((item) => ({
    name: String(item[dimension] ?? 'unknown'),
    y: typeof item.count === 'number' ? item.count : 0,
  }));

  const options: Highcharts.Options = {
    chart: { type: 'pie', height: 260, backgroundColor: 'transparent' },
    title: { text: undefined },
    credits: { enabled: false },
    plotOptions: {
      pie: {
        innerSize: '45%',
        dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.0f}%' },
      },
    },
    series: [{ type: 'pie', data, name: dimension }],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default VerdictDistributionPieWidget;
