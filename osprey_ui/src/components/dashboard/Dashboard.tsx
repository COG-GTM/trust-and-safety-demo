import * as React from 'react';
import { Col, Row, Select, Typography, Tooltip, Tag } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

import {
  getDashboardSummary,
  getRecentAlerts,
  getVerdictDistribution,
  getLabelActivity,
} from '../../actions/DashboardActions';
import {
  SummaryResponse,
  RecentAlertsResponse,
  VerdictDistributionResponse,
  LabelActivityResponse,
} from '../../types/DashboardTypes';
import { BaseQueryRequest } from '../../types/QueryTypes';
import useAutoRefreshStore from '../../stores/AutoRefreshStore';
import { Routes } from '../../Constants';

import AutoRefreshToggle from '../common/AutoRefreshToggle';
import LabelActivityChart from '../charts/LabelActivityChart';
import VerdictDistributionChart from '../charts/VerdictDistributionChart';

import MetricCard from './MetricCard';
import RecentAlerts from './RecentAlerts';
import styles from './Dashboard.module.css';

const LOOKBACK_OPTIONS: { label: string; hours: number }[] = [
  { label: 'Last 1 hour', hours: 1 },
  { label: 'Last 6 hours', hours: 6 },
  { label: 'Last 24 hours', hours: 24 },
  { label: 'Last 7 days', hours: 24 * 7 },
];

const SUMMARY_COLOR_EVENTS = '#1227ce';
const SUMMARY_COLOR_RULES = '#8e5ea2';
const SUMMARY_COLOR_LABELS = '#3e7025';
const SUMMARY_COLOR_VERDICTS = '#b23a32';

function buildQuery(hours: number): BaseQueryRequest {
  const end = dayjs.utc();
  const start = end.subtract(hours, 'hour');
  return {
    interval: 'custom',
    start: start.format(),
    end: end.format(),
    queryFilter: '',
  };
}

function granularityForHours(hours: number): string {
  if (hours <= 6) return 'minute';
  if (hours <= 24) return 'hour';
  return 'day';
}

const Dashboard: React.FC = () => {
  const [hours, setHours] = React.useState<number>(24);
  const [summary, setSummary] = React.useState<SummaryResponse | null>(null);
  const [alerts, setAlerts] = React.useState<RecentAlertsResponse | null>(null);
  const [verdicts, setVerdicts] = React.useState<VerdictDistributionResponse | null>(null);
  const [labelActivity, setLabelActivity] = React.useState<LabelActivityResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const tick = useAutoRefreshStore((state) => state.tick);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = buildQuery(hours);
    const granularity = granularityForHours(hours);

    Promise.all([
      getDashboardSummary(query, granularity),
      getRecentAlerts(query, 25),
      getVerdictDistribution(query),
      getLabelActivity(query, granularity, 8),
    ])
      .then(([summaryRes, alertsRes, verdictsRes, labelActivityRes]) => {
        if (cancelled) return;
        setSummary(summaryRes);
        setAlerts(alertsRes);
        setVerdicts(verdictsRes);
        setLabelActivity(labelActivityRes);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hours, tick]);

  const summaryFooter = (count: number, label: string) =>
    count === 0 ? (
      <span className={styles.footerMuted}>No {label} in window</span>
    ) : (
      <span>
        {label} per minute: {(count / (hours * 60)).toFixed(2)}
      </span>
    );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Typography.Title level={3} className={styles.title}>
          Dashboard
        </Typography.Title>
        <div className={styles.toolbar}>
          <Tooltip title="Time window for dashboard metrics">
            <Select
              value={hours}
              onChange={(value) => setHours(value as number)}
              className={styles.lookback}
              size="middle"
            >
              {LOOKBACK_OPTIONS.map((opt) => (
                <Select.Option key={opt.hours} value={opt.hours}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </Tooltip>
          <AutoRefreshToggle />
          <Link to={Routes.RULE_PERFORMANCE} className={styles.deepLink}>
            <Tag color="blue">Rule Performance →</Tag>
          </Link>
          <Link to={Routes.HOME} className={styles.deepLink}>
            <Tag color="default">Event Stream →</Tag>
          </Link>
        </div>
      </div>

      <Row gutter={[16, 16]} className={styles.metricsRow}>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="Events Processed"
            series={summary?.events ?? { total: 0, points: [] }}
            color={SUMMARY_COLOR_EVENTS}
            loading={loading && summary == null}
            footer={summaryFooter(summary?.events.total ?? 0, 'events')}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="Rules Fired"
            series={summary?.rules_fired ?? { total: 0, points: [] }}
            color={SUMMARY_COLOR_RULES}
            loading={loading && summary == null}
            footer={summaryFooter(summary?.rules_fired.total ?? 0, 'rule fires')}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="Labels Applied"
            series={summary?.labels_applied ?? { total: 0, points: [] }}
            color={SUMMARY_COLOR_LABELS}
            loading={loading && summary == null}
            footer={summaryFooter(summary?.labels_applied.total ?? 0, 'labels')}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="Verdicts Issued"
            series={summary?.verdicts_issued ?? { total: 0, points: [] }}
            color={SUMMARY_COLOR_VERDICTS}
            loading={loading && summary == null}
            footer={summaryFooter(summary?.verdicts_issued.total ?? 0, 'verdicts')}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles.bottomRow}>
        <Col xs={24} lg={14}>
          <div className={styles.card}>
            <Typography.Title level={5} className={styles.cardTitle}>
              Recent Alerts
            </Typography.Title>
            <Typography.Text type="secondary" className={styles.cardSubtitle}>
              The most recent rule-triggered effects (bans, label mutations).
            </Typography.Text>
            <RecentAlerts alerts={alerts?.alerts ?? []} loading={loading && alerts == null} />
          </div>
        </Col>
        <Col xs={24} lg={10}>
          <div className={styles.card}>
            <Typography.Title level={5} className={styles.cardTitle}>
              Verdict Distribution
            </Typography.Title>
            <Typography.Text type="secondary" className={styles.cardSubtitle}>
              Allow vs. ban verdicts emitted in the selected window.
            </Typography.Text>
            <VerdictDistributionChart
              data={verdicts ?? { buckets: [], total: 0 }}
              loading={loading && verdicts == null}
            />
          </div>
          <div className={styles.card} style={{ marginTop: 16 }}>
            <Typography.Title level={5} className={styles.cardTitle}>
              Label Activity
            </Typography.Title>
            <Typography.Text type="secondary" className={styles.cardSubtitle}>
              Top labels added/removed over time.
            </Typography.Text>
            <LabelActivityChart
              data={labelActivity ?? { points: [], label_names: [] }}
              loading={loading && labelActivity == null}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
