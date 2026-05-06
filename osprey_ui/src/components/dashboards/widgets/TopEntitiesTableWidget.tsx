import * as React from 'react';
import { Spin, Table } from 'antd';

import { getAnalyticsGroupBy } from '../../../actions/DashboardActions';
import { AnalyticsGroupByItem, DashboardWidget } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';

interface Props {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

const TopEntitiesTableWidget = ({ widget, ctx }: Props) => {
  const [items, setItems] = React.useState<AnalyticsGroupByItem[] | null>(null);
  const dimension = widget.dataSource.dimension ?? 'EntityKey';
  const limit = widget.dataSource.limit ?? 25;

  React.useEffect(() => {
    let cancelled = false;
    setItems(null);
    getAnalyticsGroupBy({
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

  const dataSource = items.map((row, idx) => ({
    key: idx,
    entity: String(row[dimension] ?? 'unknown'),
    count: Number(row.count) || 0,
  }));

  return (
    <Table
      size="small"
      pagination={false}
      scroll={{ y: 240 }}
      dataSource={dataSource}
      columns={[
        { title: dimension, dataIndex: 'entity', key: 'entity', ellipsis: true },
        { title: 'Events', dataIndex: 'count', key: 'count', align: 'right' as const, width: 90 },
      ]}
    />
  );
};

export default TopEntitiesTableWidget;
