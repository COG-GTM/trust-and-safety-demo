import * as React from 'react';
import { Card, Col, Row, Spin, Statistic } from 'antd';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { LabelsActivityResponse, PipelineHealthResponse } from '../../../api/dashboard';

import styles from '../ExecutiveDashboard.module.css';

interface Props {
  health: PipelineHealthResponse | null;
  labels: LabelsActivityResponse | null;
  loading: boolean;
}

function buildThroughputOptions(health: PipelineHealthResponse | null): Highcharts.Options {
  const data = (health?.throughput ?? []).map((p) => [Date.parse(p.timestamp), p.events]);
  return {
    chart: { type: 'line', height: 220 },
    title: { text: '' },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: { type: 'datetime' },
    yAxis: { title: { text: 'Events / minute' }, allowDecimals: false },
    tooltip: { xDateFormat: '%b %e %l:%M%p' },
    series: [{ name: 'Events / minute', type: 'line', color: '#1227ce', data }],
  };
}

function buildErrorRateOptions(health: PipelineHealthResponse | null): Highcharts.Options {
  const data = (health?.throughput ?? []).map((p) => [
    Date.parse(p.timestamp),
    p.events > 0 ? (p.errors / p.events) * 100 : 0,
  ]);
  return {
    chart: { type: 'line', height: 220 },
    title: { text: '' },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: { type: 'datetime' },
    yAxis: { title: { text: 'Error rate (%)' }, min: 0 },
    tooltip: { xDateFormat: '%b %e %l:%M%p', valueDecimals: 2, valueSuffix: '%' },
    series: [{ name: 'Error rate', type: 'line', color: '#b23a32', data }],
  };
}

function buildLabelActivityOptions(labels: LabelsActivityResponse | null): Highcharts.Options {
  const points = labels?.points ?? [];
  const categories = points.map((p) => Highcharts.dateFormat('%b %e %l%p', Date.parse(p.timestamp)));
  return {
    chart: { type: 'column', height: 220 },
    title: { text: '' },
    credits: { enabled: false },
    legend: { enabled: true },
    xAxis: { categories },
    yAxis: { title: { text: 'Labels' }, min: 0, allowDecimals: false },
    plotOptions: { column: { stacking: 'normal' } },
    series: [
      {
        name: 'Automated',
        type: 'column',
        color: '#3e7025',
        data: points.map((p) => p.automated),
      },
      {
        name: 'Manual',
        type: 'column',
        color: '#5b3da6',
        data: points.map((p) => p.manual),
      },
    ],
  };
}

const PipelineHealthCharts: React.FC<Props> = ({ health, labels, loading }) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12} xl={8}>
        <Card title="Pipeline Throughput" className={styles.chartCard}>
          <Spin spinning={loading}>
            <Statistic
              title="Events / minute (avg)"
              value={(health?.events_per_minute ?? 0).toFixed(2)}
              className={styles.healthStat}
            />
            <HighchartsReact highcharts={Highcharts} options={buildThroughputOptions(health)} />
          </Spin>
        </Card>
      </Col>
      <Col xs={24} md={12} xl={8}>
        <Card title="Error Rate" className={styles.chartCard}>
          <Spin spinning={loading}>
            <Statistic
              title="Overall error rate"
              value={((health?.error_rate ?? 0) * 100).toFixed(2)}
              suffix="%"
              valueStyle={{ color: (health?.error_rate ?? 0) > 0 ? '#b23a32' : '#3e7025' }}
              className={styles.healthStat}
            />
            <HighchartsReact highcharts={Highcharts} options={buildErrorRateOptions(health)} />
          </Spin>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card title="Label Activity" className={styles.chartCard}>
          <Spin spinning={loading}>
            <Statistic
              title="Labelled entities (current)"
              value={labels?.labelled_entities_total ?? 0}
              className={styles.healthStat}
            />
            <HighchartsReact highcharts={Highcharts} options={buildLabelActivityOptions(labels)} />
          </Spin>
        </Card>
      </Col>
    </Row>
  );
};

export default PipelineHealthCharts;
