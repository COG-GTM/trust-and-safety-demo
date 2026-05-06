import * as React from 'react';
import { Col, Row } from 'antd';

import {
  fetchDashboardSummary,
  fetchDashboardTimeseries,
  fetchLabelsActivity,
  fetchPipelineHealth,
  fetchTopEntities,
  fetchTopRules,
  fetchVerdictsBreakdown,
} from '../../api/dashboard';
import useDashboardStore from '../../stores/dashboardStore';

import DashboardControls from './components/DashboardControls';
import EventVolumeChart from './components/EventVolumeChart';
import KPICards from './components/KPICards';
import PipelineHealthCharts from './components/PipelineHealthCharts';
import TopEntitiesTable from './components/TopEntitiesTable';
import TopRulesTable from './components/TopRulesTable';
import VerdictDistributionChart from './components/VerdictDistributionChart';
import { useDashboardQuery } from './useDashboardQuery';

import styles from './ExecutiveDashboard.module.css';

const ExecutiveDashboard: React.FC = () => {
  const window = useDashboardStore((s) => s.window);
  const granularity = useDashboardStore((s) => s.granularity);
  const entityType = useDashboardStore((s) => s.entityType);

  const summary = useDashboardQuery(() => fetchDashboardSummary({ window }), [window]);
  // Compare against the immediately-preceding window of the same length
  // (e.g. last 24h vs the 24h before that) so KPI trend percentages are
  // meaningful.
  const previous = useDashboardQuery(() => fetchDashboardSummary({ window, offset: 1 }), [window]);
  const totalSeries = useDashboardQuery(
    () => fetchDashboardTimeseries({ window, granularity, metric: 'total_events' }),
    [window, granularity]
  );
  const flaggedSeries = useDashboardQuery(
    () => fetchDashboardTimeseries({ window, granularity, metric: 'flagged_events' }),
    [window, granularity]
  );
  const verdicts = useDashboardQuery(() => fetchVerdictsBreakdown({ window, granularity }), [window, granularity]);
  const topRules = useDashboardQuery(() => fetchTopRules({ window, limit: 10 }), [window]);
  const topEntities = useDashboardQuery(
    () => fetchTopEntities({ window, limit: 10, entityType }),
    [window, entityType]
  );
  const labelsActivity = useDashboardQuery(() => fetchLabelsActivity({ window, granularity }), [window, granularity]);
  const health = useDashboardQuery(() => fetchPipelineHealth({ window }), [window]);

  return (
    <div className={styles.dashboardPage}>
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>Executive Dashboard</h1>
        <span className={styles.dashboardSubtitle}>
          Trust &amp; safety pipeline at a glance — flagged events, rule performance, label activity, and operational
          health.
        </span>
      </div>

      <DashboardControls />

      <div className={styles.section}>
        <KPICards current={summary.data} previous={previous.data} loading={summary.loading} />
      </div>

      <Row gutter={[16, 16]} className={styles.section}>
        <Col xs={24} xl={12}>
          <EventVolumeChart
            totalSeries={totalSeries.data}
            flaggedSeries={flaggedSeries.data}
            loading={totalSeries.loading || flaggedSeries.loading}
          />
        </Col>
        <Col xs={24} xl={12}>
          <VerdictDistributionChart data={verdicts.data} loading={verdicts.loading} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles.section}>
        <Col xs={24} xl={12}>
          <TopRulesTable data={topRules.data} loading={topRules.loading} />
        </Col>
        <Col xs={24} xl={12}>
          <TopEntitiesTable data={topEntities.data} loading={topEntities.loading} />
        </Col>
      </Row>

      <div className={styles.section}>
        <PipelineHealthCharts
          health={health.data}
          labels={labelsActivity.data}
          loading={health.loading || labelsActivity.loading}
        />
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
