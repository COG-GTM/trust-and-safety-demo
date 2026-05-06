import * as React from 'react';
import { Empty, Spin } from 'antd';

import { getRuleDistribution } from '../../../actions/AnalyticsActions';
import { BaseWidgetConfig, DistributionEntry, WidgetTimeWindow } from '../../../types/DashboardTypes';

import styles from './Widgets.module.css';

interface Props {
  config: BaseWidgetConfig & { dimension?: string; limit?: number };
}

const LabelActivityWidget: React.FC<Props> = ({ config }) => {
  const window: WidgetTimeWindow = config.window ?? '24h';
  const queryFilter = config.queryFilter ?? '';
  const dimension = config.dimension ?? 'LabelName';
  const limit = config.limit ?? 8;

  const [entries, setEntries] = React.useState<DistributionEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getRuleDistribution({ window, queryFilter, dimension, limit }).then((response) => {
      if (cancelled) return;
      setEntries(response.distribution.slice(0, limit));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [window, queryFilter, dimension, limit]);

  if (isLoading) return <Spin />;
  if (entries.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No label activity" />;
  }

  const max = entries.reduce((acc, item) => Math.max(acc, item.count), 0) || 1;

  return (
    <div className={styles.distributionList}>
      {entries.map((entry) => {
        const pct = (entry.count / max) * 100;
        return (
          <div key={entry.name} className={styles.distributionRow}>
            <div className={styles.distributionLabel} title={entry.name}>
              {entry.name}
            </div>
            <div className={styles.distributionBar}>
              <div className={styles.distributionBarFill} style={{ width: `${pct}%` }} />
            </div>
            <div className={styles.distributionCount}>{entry.count.toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
};

export default LabelActivityWidget;
