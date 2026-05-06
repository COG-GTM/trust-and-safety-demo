import * as React from 'react';
import { Card, Spin } from 'antd';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { TimeseriesResponse } from '../../../api/dashboard';

import styles from '../ExecutiveDashboard.module.css';

interface Props {
  totalSeries: TimeseriesResponse | null;
  flaggedSeries: TimeseriesResponse | null;
  loading: boolean;
}

const EventVolumeChart: React.FC<Props> = ({ totalSeries, flaggedSeries, loading }) => {
  const options: Highcharts.Options = React.useMemo(() => {
    const totalData = (totalSeries?.points ?? []).map((p) => [Date.parse(p.timestamp), p.value]);
    const flaggedData = (flaggedSeries?.points ?? []).map((p) => [Date.parse(p.timestamp), p.value]);

    return {
      chart: { type: 'area', height: 320 },
      title: { text: '' },
      credits: { enabled: false },
      legend: { enabled: true },
      xAxis: { type: 'datetime', title: { text: '' } },
      yAxis: { title: { text: 'Events' }, allowDecimals: false },
      tooltip: { shared: true, xDateFormat: '%b %e %l:%M%p' },
      plotOptions: {
        area: { fillOpacity: 0.25, marker: { enabled: false } },
      },
      series: [
        {
          name: 'Total events',
          type: 'area',
          color: '#1227ce',
          data: totalData,
        },
        {
          name: 'Flagged events',
          type: 'area',
          color: '#b23a32',
          data: flaggedData,
        },
      ],
    };
    // Recompute when underlying point arrays change identity.
  }, [totalSeries, flaggedSeries]);

  return (
    <Card title="Event Volume Over Time" className={styles.chartCard}>
      <Spin spinning={loading}>
        <HighchartsReact highcharts={Highcharts} options={options} />
      </Spin>
    </Card>
  );
};

export default EventVolumeChart;
