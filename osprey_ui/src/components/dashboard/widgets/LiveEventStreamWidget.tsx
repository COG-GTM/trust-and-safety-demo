import * as React from 'react';
import { Empty, Spin } from 'antd';
import dayjs from 'dayjs';

import { resolveWindowToRange } from '../../../actions/AnalyticsActions';
import { getScanQueryResults } from '../../../actions/EventActions';
import { OspreyEvent, ScanQueryOrder } from '../../../types/QueryTypes';
import { LiveStreamWidgetConfig, WidgetTimeWindow } from '../../../types/DashboardTypes';

import styles from './Widgets.module.css';

interface Props {
  config: LiveStreamWidgetConfig;
}

const REFRESH_INTERVAL_MS = 30_000;

const LiveEventStreamWidget: React.FC<Props> = ({ config }) => {
  const window: WidgetTimeWindow = config.window ?? '1h';
  const queryFilter = config.queryFilter ?? '';
  const limit = config.limit ?? 25;

  const [events, setEvents] = React.useState<OspreyEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const { start, end } = resolveWindowToRange(window);
      const result = await getScanQueryResults(
        { start, end, queryFilter, interval: 'custom', entityFeatureFilters: new Set() },
        ScanQueryOrder.DESCENDING,
        limit
      );
      if (cancelled) return;
      setEvents(result.events.slice(0, limit));
      setIsLoading(false);
    };

    refresh();
    const intervalId = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [window, queryFilter, limit]);

  if (isLoading) return <Spin />;

  if (events.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching events" />;
  }

  return (
    <div className={styles.eventList}>
      {events.map((event) => {
        const actionName = event.extracted_features?.ActionName ?? '(unknown action)';
        return (
          <div key={event.id} className={styles.eventRow}>
            <div className={styles.eventTimestamp}>{dayjs(event.timestamp).format('M/D h:mm:ssa')}</div>
            <div className={styles.eventActionName}>{String(actionName)}</div>
          </div>
        );
      })}
    </div>
  );
};

export default LiveEventStreamWidget;
