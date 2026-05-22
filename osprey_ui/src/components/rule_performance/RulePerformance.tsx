import * as React from 'react';
import { Card, Col, Row, Select, Statistic, Table, Tooltip, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import Highcharts, { SeriesOptionsType } from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import dayjs from 'dayjs';

import { getRulePerformance } from '../../actions/DashboardActions';
import { RuleHitRow, RulePerformanceResponse } from '../../types/DashboardTypes';
import { BaseQueryRequest } from '../../types/QueryTypes';
import useAutoRefreshStore from '../../stores/AutoRefreshStore';

import AutoRefreshToggle from '../common/AutoRefreshToggle';
import styles from './RulePerformance.module.css';

const LOOKBACK_OPTIONS: { label: string; hours: number }[] = [
  { label: 'Last 1 hour', hours: 1 },
  { label: 'Last 6 hours', hours: 6 },
  { label: 'Last 24 hours', hours: 24 },
  { label: 'Last 7 days', hours: 24 * 7 },
];

const PALETTE = ['#1227ce', '#8e5ea2', '#3e7025', '#b23a32', '#0075e0', '#faad14', '#5f626d', '#0c1b8d'];

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

interface PercentChangeProps {
  row: RuleHitRow;
}

const PercentChange: React.FC<PercentChangeProps> = ({ row }) => {
  if (row.percentage_change == null) {
    return <span className={styles.muted}>—</span>;
  }
  const value = row.percentage_change;
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? ArrowUpOutlined : isDown ? ArrowDownOutlined : null;
  const cls = isUp ? styles.up : isDown ? styles.down : styles.flat;
  return (
    <span className={cls}>
      {Icon != null && <Icon className={styles.changeIcon} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

const RulePerformance: React.FC = () => {
  const [hours, setHours] = React.useState<number>(24);
  const [data, setData] = React.useState<RulePerformanceResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const tick = useAutoRefreshStore((state) => state.tick);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = buildQuery(hours);
    getRulePerformance(query, granularityForHours(hours), 10)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hours, tick]);

  const columns = React.useMemo(
    () => [
      {
        title: 'Rule (Entity / Label)',
        dataIndex: 'rule_key',
        key: 'rule_key',
        render: (value: string, row: RuleHitRow) => (
          <Tooltip title={row.rule_key}>
            <strong>{row.label_name ?? value}</strong>
            {row.entity_type ? <span className={styles.muted}> · {row.entity_type}</span> : null}
          </Tooltip>
        ),
        sorter: (a: RuleHitRow, b: RuleHitRow) => a.rule_key.localeCompare(b.rule_key),
      },
      {
        title: 'Hits (current)',
        dataIndex: 'current_count',
        key: 'current_count',
        sorter: (a: RuleHitRow, b: RuleHitRow) => a.current_count - b.current_count,
        defaultSortOrder: 'descend' as const,
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: 'Hits (prev)',
        dataIndex: 'previous_count',
        key: 'previous_count',
        sorter: (a: RuleHitRow, b: RuleHitRow) => a.previous_count - b.previous_count,
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: 'Δ',
        dataIndex: 'difference',
        key: 'difference',
        sorter: (a: RuleHitRow, b: RuleHitRow) => a.difference - b.difference,
        render: (value: number) => (value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString()),
      },
      {
        title: 'Change',
        key: 'percentage_change',
        sorter: (a: RuleHitRow, b: RuleHitRow) => (a.percentage_change ?? 0) - (b.percentage_change ?? 0),
        render: (_: unknown, row: RuleHitRow) => <PercentChange row={row} />,
      },
    ],
    []
  );

  const seriesOptions: Highcharts.Options = React.useMemo(() => {
    const series = data?.series ?? [];
    const grouped: Record<string, [number, number][]> = {};
    for (const point of series) {
      const ts = Date.parse(point.timestamp);
      if (!grouped[point.rule_key]) grouped[point.rule_key] = [];
      grouped[point.rule_key].push([ts, point.count]);
    }
    const seriesList: SeriesOptionsType[] = Object.entries(grouped).map(([key, points], idx) => ({
      type: 'areaspline',
      name: key,
      data: points.sort((a, b) => a[0] - b[0]),
      color: PALETTE[idx % PALETTE.length],
      fillOpacity: 0.25,
    }));

    return {
      chart: { type: 'areaspline', height: 320, backgroundColor: 'transparent', animation: false },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { itemStyle: { fontSize: '11px' } },
      tooltip: { shared: true, xDateFormat: '%b %e %l:%M%p' },
      xAxis: { type: 'datetime' },
      yAxis: { title: { text: undefined }, gridLineColor: '#dbdcdf', gridLineDashStyle: 'Dash' },
      plotOptions: {
        areaspline: {
          stacking: 'normal',
          marker: { enabled: false },
          lineWidth: 1.5,
        },
      },
      series: seriesList,
    };
  }, [data]);

  const fpRate = data?.false_positive_rate ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Typography.Title level={3} className={styles.title}>
          Rule Performance
        </Typography.Title>
        <div className={styles.toolbar}>
          <Select value={hours} onChange={(value) => setHours(value as number)} className={styles.lookback}>
            {LOOKBACK_OPTIONS.map((opt) => (
              <Select.Option key={opt.hours} value={opt.hours}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
          <AutoRefreshToggle />
        </div>
      </div>

      <Row gutter={[16, 16]} className={styles.statsRow}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total rule fires"
              value={(data?.rules ?? []).reduce((sum, r) => sum + r.current_count, 0)}
              loading={loading && data == null}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Distinct rules in window"
              value={data?.rules.length ?? 0}
              loading={loading && data == null}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Tooltip title="Fraction of rule fires that produced a 'trusted' or 'verified' label, suggesting a possible earlier false positive.">
              <Statistic
                title="False-positive indicator"
                precision={2}
                suffix="%"
                value={fpRate == null ? 0 : fpRate * 100}
                valueStyle={{ color: fpRate != null && fpRate > 0.05 ? '#b23a32' : undefined }}
                loading={loading && data == null}
              />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      <Card className={styles.section}>
        <Typography.Title level={5} className={styles.sectionTitle}>
          Rules Hit Frequency
        </Typography.Title>
        <Typography.Text type="secondary" className={styles.sectionSubtitle}>
          Top rules by hit count, with Δ and % change vs. the prior period of equal length.
        </Typography.Text>
        <Table
          dataSource={data?.rules ?? []}
          columns={columns}
          loading={loading && data == null}
          rowKey="rule_key"
          size="small"
          pagination={false}
        />
      </Card>

      <Card className={styles.section}>
        <Typography.Title level={5} className={styles.sectionTitle}>
          Rule Hit Rate Over Time
        </Typography.Title>
        <Typography.Text type="secondary" className={styles.sectionSubtitle}>
          Stacked time series of the top rules in the selected window. Spikes can indicate incident-driven rule
          activity.
        </Typography.Text>
        <HighchartsReact highcharts={Highcharts} options={seriesOptions} />
      </Card>
    </div>
  );
};

export default RulePerformance;
