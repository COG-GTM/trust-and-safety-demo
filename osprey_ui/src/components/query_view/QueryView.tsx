import * as React from 'react';
import { Route, RouteComponentProps, useRouteMatch } from 'react-router-dom';

import useQueryStore from '../../stores/QueryStore';
import useAutoRefreshStore from '../../stores/AutoRefreshStore';
import { DefaultIntervals } from '../../types/QueryTypes';
import { startRecordingClicks, stopRecordingClicks } from '../../utils/EventListenerUtils';
import { getQueryDateRange, CUSTOM_RANGE_OPTION } from '../../utils/QueryUtils';
import AutoRefreshToggle from '../common/AutoRefreshToggle';
import BulkLabelDrawer from '../bulk_label_drawer/BulkLabelDrawer';
import EntityFeatureFilters from '../entities/EntityFeatureFilters';
import EntityProfileCard from '../entities/EntityProfileCard';
import FeatureFiltersDetailBar from '../entities/FeatureFiltersDetailBar';
import EntityDrawer from '../entities/LabelDrawer';
import EventStream from '../event_stream/EventStream';
import Timeseries from '../timeseries/Timeseries';
import TopN from '../top_n/TopN';
import Charts from '../charts/Charts';
import ChartsExtras from '../charts/ChartsExtras';
import QueryDatePicker from './QueryDatePicker';
import QueryPanel from './QueryPanel';

import { Routes } from '../../Constants';
import styles from './QueryView.module.css';

const QueryView: React.FC = () => {
  const executedQuery = useQueryStore((state) => state.executedQuery);
  const updateExecutedQuery = useQueryStore((state) => state.updateExecutedQuery);
  const [interval, setQueryInterval] = React.useState(executedQuery.interval);
  const [dateRange, setDateRange] = React.useState({ start: executedQuery.start, end: executedQuery.end });

  React.useEffect(() => {
    setQueryInterval(executedQuery.interval);
    setDateRange({ start: executedQuery.start, end: executedQuery.end });
  }, [executedQuery]);

  React.useEffect(() => {
    document.addEventListener('keydown', startRecordingClicks);
    document.addEventListener('keyup', stopRecordingClicks);

    return () => {
      document.removeEventListener('keydown', startRecordingClicks);
      document.removeEventListener('keyup', stopRecordingClicks);
    };
  }, []);

  // Tie the auto-refresh tick to the executed query.  Refreshing only makes
  // sense for non-custom intervals, where the start/end are derived from
  // "now".  Bumping `executedQuery` re-derives the date range and propagates
  // through the existing query-driven components.
  const tick = useAutoRefreshStore((state) => state.tick);
  React.useEffect(() => {
    if (tick === 0) return;
    if (executedQuery.interval == null || executedQuery.interval === CUSTOM_RANGE_OPTION) return;
    updateExecutedQuery({ ...executedQuery, ...getQueryDateRange(executedQuery.interval) });
    // We deliberately depend only on `tick` here; including `executedQuery`
    // would create a feedback loop because `updateExecutedQuery` mutates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const entityRouteMatch = useRouteMatch<{ entityType: string; entityId: string }>(Routes.ENTITY);

  const isDateRangeEmpty = (): boolean => {
    return dateRange.start === '' && dateRange.end === '';
  };

  const handleIntervalChange = (interval: DefaultIntervals | 'custom' | null) => {
    setQueryInterval(interval);

    if (interval !== CUSTOM_RANGE_OPTION)
      updateExecutedQuery({ ...executedQuery, interval, ...getQueryDateRange(interval) });
  };

  const handleDateRangeChange = (updatedDateRange: { start: string; end: string }) => {
    setDateRange(updatedDateRange);
    updateExecutedQuery({ ...executedQuery, interval, ...updatedDateRange });
  };

  return (
    <>
      <div className={styles.queryView}>
        <div className={styles.pageContentLeft}>
          <QueryPanel onIntervalChange={handleIntervalChange} interval={interval} dateRange={dateRange} />
        </div>
        <div className={styles.pageContentRight}>
          <div className={isDateRangeEmpty() ? styles.datePickerBarHidden : styles.datePickerBarShown}>
            <QueryDatePicker
              onIntervalChange={handleIntervalChange}
              onDateRangeChange={handleDateRangeChange}
              interval={interval}
              dateRange={dateRange}
            />
            <div className={styles.toolbarRight}>
              <AutoRefreshToggle />
            </div>
            <Route
              path={Routes.ENTITY}
              // @ts-expect-error (yarn.lock upgrade)
              render={({ match }: RouteComponentProps<{ entityId: string; entityType: string }>) => (
                <EntityFeatureFilters {...match.params} />
              )}
            />
          </div>
          <Route path={Routes.ENTITY}>
            <FeatureFiltersDetailBar />
          </Route>
          <div className={styles.charts}>
            <div className={styles.chartsLeft}>
              <Timeseries />
              <ChartsExtras />
              <Charts />
              <TopN />
            </div>
            <div className={styles.chartsRight}>
              {entityRouteMatch != null && (
                <div className={styles.entityProfileWrapper}>
                  <EntityProfileCard
                    entityType={decodeURIComponent(entityRouteMatch.params.entityType)}
                    entityId={decodeURIComponent(entityRouteMatch.params.entityId)}
                    refreshKey={tick}
                    compact
                  />
                </div>
              )}
              <EventStream />
            </div>
          </div>
          <BulkLabelDrawer />
          <EntityDrawer />
        </div>
      </div>
    </>
  );
};

export default QueryView;
