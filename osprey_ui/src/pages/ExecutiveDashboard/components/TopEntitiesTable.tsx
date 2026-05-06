import * as React from 'react';
import { Card, Empty, Select, Space, Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useHistory } from 'react-router-dom';

import { EntityStat, EntityType, TopEntitiesResponse } from '../../../api/dashboard';
import useDashboardStore from '../../../stores/dashboardStore';

import styles from '../ExecutiveDashboard.module.css';

const buildEntityRoute = (type: EntityType, id: string): string =>
  `/entity/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

interface Props {
  data: TopEntitiesResponse | null;
  loading: boolean;
}

const ENTITY_OPTIONS: Array<{ label: EntityType; value: EntityType }> = [
  { label: 'User', value: 'User' },
  { label: 'IP', value: 'IP' },
  { label: 'Email', value: 'Email' },
  { label: 'Domain', value: 'Domain' },
];

const TopEntitiesTable: React.FC<Props> = ({ data, loading }) => {
  const history = useHistory();
  const entityType = useDashboardStore((s) => s.entityType);
  const setEntityType = useDashboardStore((s) => s.setEntityType);

  const columns: ColumnsType<EntityStat> = React.useMemo(
    () => [
      {
        title: 'Entity ID',
        dataIndex: 'entity_id',
        key: 'entity_id',
        render: (entityId: string) => (
          <a
            onClick={() => {
              history.push(buildEntityRoute(entityType, entityId));
            }}
          >
            {entityId}
          </a>
        ),
      },
      {
        title: 'Type',
        key: 'type',
        render: () => entityType,
      },
      {
        title: 'Flag Count',
        dataIndex: 'flag_count',
        key: 'flag_count',
        align: 'right',
        sorter: (a, b) => a.flag_count - b.flag_count,
        defaultSortOrder: 'descend',
      },
    ],
    [entityType, history]
  );

  const rows = data?.entities ?? [];

  return (
    <Card
      title="Top Flagged Entities"
      className={styles.tableCard}
      extra={
        <Space>
          <span className={styles.controlLabel}>Type:</span>
          <Select<EntityType>
            value={entityType}
            options={ENTITY_OPTIONS}
            onChange={setEntityType}
            style={{ width: 120 }}
          />
        </Space>
      }
    >
      <Spin spinning={loading}>
        {rows.length === 0 ? (
          <div className={styles.emptyState}>
            <Empty description="No flagged entities of this type in this window" />
          </div>
        ) : (
          <Table<EntityStat> rowKey="entity_id" columns={columns} dataSource={rows} pagination={false} size="middle" />
        )}
      </Spin>
    </Card>
  );
};

export default TopEntitiesTable;
