import * as React from 'react';
import { Empty, Spin } from 'antd';
import Highcharts, { SeriesOptionsType } from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { LabelActivityResponse } from '../../types/DashboardTypes';

interface LabelActivityChartProps {
  data: LabelActivityResponse;
  loading?: boolean;
  height?: number;
}

const PALETTE = ['#1227ce', '#8e5ea2', '#3e7025', '#b23a32', '#0075e0', '#faad14', '#5f626d', '#0c1b8d'];

const LabelActivityChart: React.FC<LabelActivityChartProps> = ({ data, loading, height = 240 }) => {
  const options: Highcharts.Options = React.useMemo(() => {
    // Bucket adds/removes by (timestamp, label_name).
    const seriesByLabel: Record<string, Map<number, number>> = {};
    for (const point of data.points) {
      const ts = Date.parse(point.timestamp);
      const addedKey = `${point.label_name} (added)`;
      const removedKey = `${point.label_name} (removed)`;
      if (!seriesByLabel[addedKey]) seriesByLabel[addedKey] = new Map();
      if (!seriesByLabel[removedKey]) seriesByLabel[removedKey] = new Map();
      seriesByLabel[addedKey].set(ts, (seriesByLabel[addedKey].get(ts) ?? 0) + point.added);
      seriesByLabel[removedKey].set(ts, (seriesByLabel[removedKey].get(ts) ?? 0) + point.removed);
    }

    const seriesEntries = Object.entries(seriesByLabel)
      .filter(([, points]) => Array.from(points.values()).some((v) => v > 0))
      .map(([name, points], idx) => ({
        type: 'column' as const,
        name,
        data: Array.from(points.entries())
          .sort(([a], [b]) => a - b)
          .map(([ts, value]) => [ts, value]),
        color: PALETTE[idx % PALETTE.length],
        // Removes show below the axis to make additions vs removals visually
        // distinguishable on the same chart.
        negativeColor: name.endsWith('(removed)') ? '#b23a32' : undefined,
      }));

    return {
      chart: { type: 'column', height, animation: false, backgroundColor: 'transparent' },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { itemStyle: { fontSize: '11px' } },
      xAxis: {
        type: 'datetime',
        labels: { style: { fontSize: '11px' } },
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: '#dbdcdf',
        gridLineDashStyle: 'Dash',
      },
      tooltip: {
        shared: true,
        xDateFormat: '%b %e %l:%M%p',
      },
      plotOptions: {
        column: { stacking: 'normal', borderRadius: 1 },
      },
      series: seriesEntries as SeriesOptionsType[],
    };
  }, [data, height]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (data.points.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="No label activity in window" />
      </div>
    );
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default LabelActivityChart;
