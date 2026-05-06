import * as React from 'react';
import { Spin, Table, Tag } from 'antd';

import { getLabelsSummary } from '../../../actions/DashboardActions';
import { AnalyticsLabelsSummary, DashboardWidget } from '../../../types/DashboardTypes';
import { WidgetRenderContext } from '../widgetUtils';

interface Props {
  widget: DashboardWidget;
  ctx: WidgetRenderContext;
}

const LabelActivityTableWidget = ({ widget, ctx }: Props) => {
  const [summary, setSummary] = React.useState<AnalyticsLabelsSummary | null>(null);
  const limit = widget.dataSource.limit ?? 25;

  React.useEffect(() => {
    let cancelled = false;
    setSummary(null);
    getLabelsSummary(limit).then((s) => {
      if (!cancelled) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.refreshKey, limit]);

  if (summary == null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin />
      </div>
    );
  }

  const rows = summary.recent.map((row, idx) => {
    const labels = row.labels && typeof row.labels === 'object' ? Object.keys(row.labels) : [];
    return {
      key: idx,
      entity: row.entity_key,
      labels,
    };
  });

  return (
    <Table
      size="small"
      pagination={false}
      dataSource={rows}
      scroll={{ y: 220 }}
      columns={[
        { title: 'Entity', dataIndex: 'entity', key: 'entity', ellipsis: true },
        {
          title: 'Labels',
          dataIndex: 'labels',
          key: 'labels',
          render: (labels: string[]) => (
            <span>
              {labels.map((l) => (
                <Tag key={l}>{l}</Tag>
              ))}
            </span>
          ),
        },
      ]}
    />
  );
};

export default LabelActivityTableWidget;
