import * as React from 'react';
import { Empty, Spin } from 'antd';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { VerdictDistributionResponse } from '../../types/DashboardTypes';

interface VerdictDistributionChartProps {
  data: VerdictDistributionResponse;
  loading?: boolean;
  height?: number;
}

const VERDICT_COLORS: Record<string, string> = {
  allow: '#3e7025',
  ban: '#b23a32',
  errors: '#faad14',
};

const VERDICT_LABELS: Record<string, string> = {
  allow: 'Allow',
  ban: 'Ban',
  errors: 'Errors',
};

const VerdictDistributionChart: React.FC<VerdictDistributionChartProps> = ({ data, loading, height = 240 }) => {
  const options: Highcharts.Options = React.useMemo(() => {
    const slices = data.buckets
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        name: VERDICT_LABELS[bucket.verdict] ?? bucket.verdict,
        y: bucket.count,
        color: VERDICT_COLORS[bucket.verdict],
      }));

    return {
      chart: { type: 'pie', height, backgroundColor: 'transparent', animation: false },
      title: { text: undefined },
      credits: { enabled: false },
      tooltip: {
        pointFormat: '<b>{point.y}</b> ({point.percentage:.1f}%)',
      },
      plotOptions: {
        pie: {
          innerSize: '60%',
          dataLabels: {
            enabled: true,
            format: '{point.name}: {point.percentage:.0f}%',
            style: { fontSize: '11px' },
          },
          borderWidth: 1,
          borderColor: '#ffffff',
        },
      },
      series: [
        {
          type: 'pie',
          name: 'Verdicts',
          data: slices,
        },
      ],
    };
  }, [data, height]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (data.total === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="No verdicts in window" />
      </div>
    );
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default VerdictDistributionChart;
