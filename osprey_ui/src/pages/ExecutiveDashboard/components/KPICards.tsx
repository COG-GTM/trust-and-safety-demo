import * as React from 'react';
import { Card, Col, Row, Statistic, Tooltip } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

import { DashboardSummary } from '../../../api/dashboard';

import styles from '../ExecutiveDashboard.module.css';

interface KPICardsProps {
  current: DashboardSummary | null;
  previous: DashboardSummary | null;
  loading: boolean;
}

interface TrendProps {
  current: number;
  previous: number;
  inverse?: boolean;
}

const Trend: React.FC<TrendProps> = ({ current, previous, inverse }) => {
  if (previous === 0 || previous == null) {
    return <span className={styles.trendNeutral}>—</span>;
  }
  const delta = ((current - previous) / previous) * 100;
  const positive = inverse ? delta < 0 : delta > 0;
  const Icon = delta >= 0 ? ArrowUpOutlined : ArrowDownOutlined;
  const className = delta === 0 ? styles.trendNeutral : positive ? styles.trendPositive : styles.trendNegative;
  return (
    <span className={className}>
      <Icon /> {Math.abs(delta).toFixed(1)}%
    </span>
  );
};

const flagRateColor = (rate: number): string => {
  if (rate < 0.05) return '#3e7025';
  if (rate < 0.15) return '#b88a00';
  return '#b23a32';
};

const KPICards: React.FC<KPICardsProps> = ({ current, previous, loading }) => {
  const totalEvents = current?.total_events ?? 0;
  const flaggedEvents = current?.flagged_events ?? 0;
  const flagRate = current?.flag_rate ?? 0;
  const labelsApplied = current?.labels_applied ?? 0;
  const uniqueEntities = current?.unique_entities_flagged ?? 0;
  const verdicts = (current?.verdicts_breakdown ?? []).reduce((sum, v) => sum + v.count, 0);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={8} xl={4}>
        <Card loading={loading} className={styles.kpiCard}>
          <Statistic title="Total Events" value={totalEvents} />
          <Trend current={totalEvents} previous={previous?.total_events ?? 0} />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} xl={4}>
        <Card loading={loading} className={styles.kpiCard}>
          <Statistic title="Flagged Events" value={flaggedEvents} />
          <Trend current={flaggedEvents} previous={previous?.flagged_events ?? 0} inverse />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} xl={4}>
        <Card loading={loading} className={styles.kpiCard}>
          <Tooltip title="Share of events that triggered a verdict, label mutation, or ban effect">
            <Statistic
              title="Flag Rate"
              value={(flagRate * 100).toFixed(2)}
              suffix="%"
              valueStyle={{ color: flagRateColor(flagRate) }}
            />
          </Tooltip>
          <Trend current={flagRate} previous={previous?.flag_rate ?? 0} inverse />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} xl={4}>
        <Card loading={loading} className={styles.kpiCard}>
          <Statistic title="Labels Applied" value={labelsApplied} />
          <Trend current={labelsApplied} previous={previous?.labels_applied ?? 0} />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} xl={4}>
        <Card loading={loading} className={styles.kpiCard}>
          <Statistic title="Unique Entities Flagged" value={uniqueEntities} />
          <Trend current={uniqueEntities} previous={previous?.unique_entities_flagged ?? 0} inverse />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} xl={4}>
        <Card loading={loading} className={styles.kpiCard}>
          <Statistic title="Verdicts Issued" value={verdicts} />
          <Trend
            current={verdicts}
            previous={(previous?.verdicts_breakdown ?? []).reduce((sum, v) => sum + v.count, 0)}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default KPICards;
