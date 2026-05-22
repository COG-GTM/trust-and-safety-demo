import * as React from 'react';
import { Col, Row, Typography } from 'antd';

import { getLabelActivity, getVerdictDistribution } from '../../actions/DashboardActions';
import { LabelActivityResponse, VerdictDistributionResponse } from '../../types/DashboardTypes';
import useAutoRefreshStore from '../../stores/AutoRefreshStore';
import useQueryStore from '../../stores/QueryStore';

import LabelActivityChart from './LabelActivityChart';
import VerdictDistributionChart from './VerdictDistributionChart';
import styles from './ChartsExtras.module.css';

function granularityFor(start: string, end: string): string {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'hour';
  const hours = (endMs - startMs) / (1000 * 60 * 60);
  if (hours <= 6) return 'minute';
  if (hours <= 24) return 'hour';
  return 'day';
}

const ChartsExtras: React.FC = () => {
  const executedQuery = useQueryStore((state) => state.executedQuery);
  const tick = useAutoRefreshStore((state) => state.tick);
  const [labelActivity, setLabelActivity] = React.useState<LabelActivityResponse | null>(null);
  const [verdicts, setVerdicts] = React.useState<VerdictDistributionResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  const hasRange = executedQuery.start !== '' && executedQuery.end !== '';

  React.useEffect(() => {
    if (!hasRange) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const baseQuery = {
      interval: executedQuery.interval ?? 'custom',
      start: executedQuery.start,
      end: executedQuery.end,
      queryFilter: executedQuery.queryFilter ?? '',
    };
    const granularity = granularityFor(executedQuery.start, executedQuery.end);
    Promise.all([getLabelActivity(baseQuery, granularity, 8), getVerdictDistribution(baseQuery)])
      .then(([labelRes, verdictRes]) => {
        if (cancelled) return;
        setLabelActivity(labelRes);
        setVerdicts(verdictRes);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [executedQuery.start, executedQuery.end, executedQuery.interval, executedQuery.queryFilter, tick, hasRange]);

  if (!hasRange) return null;

  return (
    <div className={styles.wrapper}>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={14}>
          <div className={styles.card}>
            <Typography.Text strong className={styles.cardTitle}>
              Label Activity
            </Typography.Text>
            <Typography.Text type="secondary" className={styles.cardSubtitle}>
              Top labels added/removed over the queried window.
            </Typography.Text>
            <LabelActivityChart
              data={labelActivity ?? { points: [], label_names: [] }}
              loading={loading && labelActivity == null}
              height={200}
            />
          </div>
        </Col>
        <Col xs={24} md={10}>
          <div className={styles.card}>
            <Typography.Text strong className={styles.cardTitle}>
              Verdict Distribution
            </Typography.Text>
            <Typography.Text type="secondary" className={styles.cardSubtitle}>
              Allow vs. ban verdicts emitted in the queried window.
            </Typography.Text>
            <VerdictDistributionChart
              data={verdicts ?? { buckets: [], total: 0 }}
              loading={loading && verdicts == null}
              height={200}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default ChartsExtras;
