import * as React from 'react';
import { Card, Empty, Spin } from 'antd';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { VerdictsBreakdownResponse } from '../../../api/dashboard';

import styles from '../ExecutiveDashboard.module.css';

interface Props {
  data: VerdictsBreakdownResponse | null;
  loading: boolean;
}

const COLORS = ['#1227ce', '#3e7025', '#b88a00', '#b23a32', '#5b3da6', '#0c8082'];

const VerdictDistributionChart: React.FC<Props> = ({ data, loading }) => {
  const { options, hasData } = React.useMemo(() => {
    const points = data?.points ?? [];
    const verdictNames = Array.from(new Set(points.map((p) => p.verdict)));
    const buckets = Array.from(new Set(points.map((p) => p.timestamp))).sort();
    if (verdictNames.length === 0 || buckets.length === 0) {
      return { options: { title: { text: '' } } as Highcharts.Options, hasData: false };
    }

    const seriesByVerdict: Record<string, number[]> = Object.fromEntries(
      verdictNames.map((v) => [v, buckets.map(() => 0)])
    );
    for (const p of points) {
      const idx = buckets.indexOf(p.timestamp);
      if (idx >= 0) {
        seriesByVerdict[p.verdict][idx] = p.count;
      }
    }

    const opts: Highcharts.Options = {
      chart: { type: 'column', height: 320 },
      title: { text: '' },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime',
        categories: buckets.map((t) => Highcharts.dateFormat('%b %e %l%p', Date.parse(t))),
      },
      yAxis: { min: 0, title: { text: 'Verdicts' }, stackLabels: { enabled: false } },
      legend: { enabled: true },
      plotOptions: { column: { stacking: 'normal' } },
      tooltip: { shared: true },
      series: verdictNames.map((v, i) => ({
        type: 'column',
        name: v,
        data: seriesByVerdict[v],
        color: COLORS[i % COLORS.length],
      })),
    };
    return { options: opts, hasData: true };
  }, [data]);

  return (
    <Card title="Verdict Distribution Over Time" className={styles.chartCard}>
      <Spin spinning={loading}>
        {hasData ? (
          <HighchartsReact highcharts={Highcharts} options={options} />
        ) : (
          <div className={styles.emptyState}>
            <Empty description="No verdicts in this window" />
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default VerdictDistributionChart;
