import * as React from 'react';
import { ReloadOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { Select, Tooltip } from 'antd';

import useAutoRefreshStore from '../../stores/AutoRefreshStore';
import { AutoRefreshIntervals, AutoRefreshLabels } from '../../Constants';

import styles from './AutoRefreshToggle.module.css';

const OPTIONS = [
  AutoRefreshIntervals.OFF,
  AutoRefreshIntervals.TEN_SECONDS,
  AutoRefreshIntervals.THIRTY_SECONDS,
  AutoRefreshIntervals.ONE_MINUTE,
  AutoRefreshIntervals.FIVE_MINUTES,
];

const AutoRefreshToggle: React.FC = () => {
  const intervalMs = useAutoRefreshStore((state) => state.intervalMs);
  const setIntervalMs = useAutoRefreshStore((state) => state.setIntervalMs);
  const bumpTick = useAutoRefreshStore((state) => state.bumpTick);

  React.useEffect(() => {
    if (intervalMs === AutoRefreshIntervals.OFF) return;
    const handle = window.setInterval(() => bumpTick(), intervalMs);
    return () => window.clearInterval(handle);
  }, [intervalMs, bumpTick]);

  const isOn = intervalMs !== AutoRefreshIntervals.OFF;

  return (
    <div className={styles.container}>
      <Tooltip title={isOn ? `Auto-refresh every ${AutoRefreshLabels[intervalMs]}` : 'Auto-refresh disabled'}>
        <span className={styles.icon}>{isOn ? <ReloadOutlined spin /> : <PauseCircleOutlined />}</span>
      </Tooltip>
      <Select
        size="small"
        value={intervalMs}
        onChange={(value) => setIntervalMs(value as (typeof OPTIONS)[number])}
        className={styles.select}
        popupMatchSelectWidth={false}
      >
        {OPTIONS.map((option) => (
          <Select.Option key={option} value={option}>
            {AutoRefreshLabels[option]}
          </Select.Option>
        ))}
      </Select>
    </div>
  );
};

export default AutoRefreshToggle;
