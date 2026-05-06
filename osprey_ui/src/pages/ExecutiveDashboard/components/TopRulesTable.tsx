import * as React from 'react';
import { Card, Empty, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useHistory } from 'react-router-dom';

import { Routes } from '../../../Constants';
import { RuleStat, TopRulesResponse } from '../../../api/dashboard';

import styles from '../ExecutiveDashboard.module.css';

interface Props {
  data: TopRulesResponse | null;
  loading: boolean;
}

const TopRulesTable: React.FC<Props> = ({ data, loading }) => {
  const history = useHistory();

  const columns: ColumnsType<RuleStat> = React.useMemo(
    () => [
      {
        title: 'Rule',
        dataIndex: 'rule',
        key: 'rule',
        render: (rule: string) => (
          <a
            onClick={() => {
              history.push({
                pathname: Routes.HOME,
                search: `?queryFilter=${encodeURIComponent(`${rule} == 1`)}`,
              });
            }}
          >
            {rule}
          </a>
        ),
      },
      {
        title: 'Match Count',
        dataIndex: 'matches',
        key: 'matches',
        align: 'right',
        sorter: (a, b) => a.matches - b.matches,
        defaultSortOrder: 'descend',
      },
      {
        title: '% of Total',
        dataIndex: 'percentage',
        key: 'percentage',
        align: 'right',
        render: (value: number) => <Tag color="blue">{(value * 100).toFixed(1)}%</Tag>,
      },
    ],
    [history]
  );

  const rows = data?.rules ?? [];

  return (
    <Card title="Top Triggered Rules" className={styles.tableCard}>
      <Spin spinning={loading}>
        {rows.length === 0 ? (
          <div className={styles.emptyState}>
            <Empty description="No rule activity in this window" />
          </div>
        ) : (
          <Table<RuleStat> rowKey="rule" columns={columns} dataSource={rows} pagination={false} size="middle" />
        )}
      </Spin>
    </Card>
  );
};

export default TopRulesTable;
