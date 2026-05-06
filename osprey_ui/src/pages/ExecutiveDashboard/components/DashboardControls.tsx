import * as React from 'react';
import { Radio, Select, Space, Switch } from 'antd';

import useDashboardStore from '../../../stores/dashboardStore';
import { DashboardGranularity, DashboardWindow } from '../../../api/dashboard';

import styles from '../ExecutiveDashboard.module.css';

const WINDOW_OPTIONS: Array<{ label: string; value: DashboardWindow }> = [
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d', value: '7d' },
  { label: 'Last 30d', value: '30d' },
  { label: 'Last 90d', value: '90d' },
];

const GRANULARITY_OPTIONS: Array<{ label: string; value: DashboardGranularity }> = [
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
];

const DashboardControls: React.FC = () => {
  const window = useDashboardStore((s) => s.window);
  const granularity = useDashboardStore((s) => s.granularity);
  const autoRefresh = useDashboardStore((s) => s.autoRefresh);
  const setWindow = useDashboardStore((s) => s.setWindow);
  const setGranularity = useDashboardStore((s) => s.setGranularity);
  const setAutoRefresh = useDashboardStore((s) => s.setAutoRefresh);

  return (
    <div className={styles.controlsBar}>
      <Space size="large" wrap>
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={WINDOW_OPTIONS}
          value={window}
          onChange={(e) => setWindow(e.target.value)}
        />
        <Space>
          <span className={styles.controlLabel}>Granularity:</span>
          <Select<DashboardGranularity>
            value={granularity}
            options={GRANULARITY_OPTIONS}
            onChange={setGranularity}
            style={{ width: 120 }}
          />
        </Space>
        <Space>
          <span className={styles.controlLabel}>Auto-refresh (60s):</span>
          <Switch checked={autoRefresh} onChange={setAutoRefresh} />
        </Space>
      </Space>
    </div>
  );
};

export default DashboardControls;
