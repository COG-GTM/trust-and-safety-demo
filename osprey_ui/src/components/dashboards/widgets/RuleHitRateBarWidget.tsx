import * as React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Spin, Empty } from 'antd';

import { getRulesPerformance } from '../../../actions/DashboardActions';
import { AnalyticsGroupByItem, DashboardWidget } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';

interface Props {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

const RuleHitRateBarWidget = ({ widget, ctx }: Props) => {
  const [items, setItems] = React.useState<AnalyticsGroupByItem[] | null>(null);
  const dimension = widget.dataSource.dimension ?? 'RuleName';
  const limit = widget.dataSource.limit ?? 15;

  React.useEffect(() => {
    let cancelled = false;
    setItems(null);
    getRulesPerformance({
      start: ctx.start,
      end: ctx.end,
      query_filter: ctx.queryFilter,
      dimension,
      limit,
    }).then((res) => {
      if (cancelled) return;
      const flattened: AnalyticsGroupByItem[] = [];
      for (const period of res.current_period ?? []) {
        for (const row of period.result ?? []) flattened.push(row);
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

  const sorted = [...items].sort((a, b) => Number(b.count) - Number(a.count));
  const categories = sorted.map((item) => String(item[dimension] ?? 'unknown'));
  const counts = sorted.map((item) => Number(item.count) || 0);

  const options: Highcharts.Options = {
    chart: { type: 'bar', height: Math.max(220, sorted.length * 22), backgroundColor: 'transparent' },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: { categories },
    yAxis: { title: { text: 'Hits' } },
    plotOptions: { bar: { color: widget.options?.primaryColor ?? '#3e7025' } },
    series: [{ type: 'bar', data: counts, name: dimension }],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default RuleHitRateBarWidget;
