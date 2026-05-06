import * as React from 'react';
import { Empty, Spin } from 'antd';

import { resolveWindowToRange } from '../../../actions/AnalyticsActions';
import { getTopNQueryResults } from '../../../actions/EventActions';
import { DimensionResult } from '../../../types/QueryTypes';
import { TopEntitiesWidgetConfig, WidgetTimeWindow } from '../../../types/DashboardTypes';

import styles from './Widgets.module.css';

interface Props {
  config: TopEntitiesWidgetConfig;
}

const TopEntitiesWidget: React.FC<Props> = ({ config }) => {
  const window: WidgetTimeWindow = config.window ?? '24h';
  const queryFilter = config.queryFilter ?? '';
  const dimension = config.dimension;
  const limit = config.limit ?? 10;

  const [rows, setRows] = React.useState<DimensionResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    if (!dimension) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    const { start, end } = resolveWindowToRange(window);
    getTopNQueryResults(
      { start, end, queryFilter, interval: 'custom', entityFeatureFilters: new Set() },
      dimension,
      limit
    ).then((result) => {
      if (cancelled) return;
      const flattened: DimensionResult[] = [];
      for (const period of result.current_period) {
        for (const item of period.result) {
          flattened.push(item);
        }
      }
      setRows(flattened.slice(0, limit));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [window, queryFilter, dimension, limit]);

  if (isLoading) return <Spin />;
  if (!dimension) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Configure a dimension" />;
  }
  if (rows.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;
  }

  const max = rows.reduce((acc, item) => Math.max(acc, item.count), 0) || 1;

  return (
    <div className={styles.distributionList}>
      {rows.map((row, index) => {
        const value = row[dimension] ?? '(unknown)';
        const pct = (row.count / max) * 100;
        return (
          <div key={`${value}-${index}`} className={styles.distributionRow}>
            <div className={styles.distributionLabel} title={String(value)}>
              {String(value)}
            </div>
            <div className={styles.distributionBar}>
              <div className={styles.distributionBarFill} style={{ width: `${pct}%` }} />
            </div>
            <div className={styles.distributionCount}>{row.count.toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
};

export default TopEntitiesWidget;
