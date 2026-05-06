import * as React from 'react';
import { Spin } from 'antd';

import { getKpiSummary } from '../../../actions/AnalyticsActions';
import { KpiSummaryResponse, KpiWidgetConfig, WidgetTimeWindow } from '../../../types/DashboardTypes';

import styles from './Widgets.module.css';

interface Props {
  config: KpiWidgetConfig;
}

const EventVolumeKPIWidget: React.FC<Props> = ({ config }) => {
  const window: WidgetTimeWindow = config.window ?? '24h';
  const queryFilter = config.queryFilter ?? '';

  const [data, setData] = React.useState<KpiSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getKpiSummary({ window, queryFilter }).then((result) => {
      if (!cancelled) {
        setData(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [window, queryFilter]);

  if (isLoading) {
    return (
      <div className={styles.kpiContainer}>
        <Spin />
      </div>
    );
  }

  const totalEvents = data?.total_events ?? 0;

  return (
    <div className={styles.kpiContainer}>
      <div className={styles.kpiNumber}>{totalEvents.toLocaleString()}</div>
      <div className={styles.kpiLabel}>events processed</div>
      <div className={styles.kpiSubLabel}>over {window}</div>
    </div>
  );
};

export default EventVolumeKPIWidget;
