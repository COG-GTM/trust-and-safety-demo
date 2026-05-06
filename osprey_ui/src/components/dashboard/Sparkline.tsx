import * as React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { TimeseriesPoint } from '../../types/DashboardTypes';

interface SparklineProps {
  points: TimeseriesPoint[];
  color?: string;
  height?: number;
  ariaLabel?: string;
}

const DEFAULT_COLOR = '#1227ce';

const Sparkline: React.FC<SparklineProps> = ({ points, color = DEFAULT_COLOR, height = 36, ariaLabel }) => {
  const data = React.useMemo(() => points.map((p) => [Date.parse(p.timestamp), p.value] as [number, number]), [points]);

  const options: Highcharts.Options = React.useMemo(
    () => ({
      chart: {
        type: 'areaspline',
        height,
        margin: [2, 0, 2, 0],
        backgroundColor: 'transparent',
        animation: false,
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        outside: true,
        // Match the existing UI's compact tooltip style.
        backgroundColor: '#ffffff',
        borderColor: '#dbdcdf',
        useHTML: true,
        formatter() {
          const ts = Highcharts.dateFormat('%b %e %l:%M%p', this.x as number);
          return `<div style="font-size:11px"><strong>${ts}</strong><br/>${this.y}</div>`;
        },
      },
      xAxis: {
        type: 'datetime',
        visible: false,
        labels: { enabled: false },
        tickLength: 0,
      },
      yAxis: {
        visible: false,
        title: { text: undefined },
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          lineWidth: 1.5,
          fillOpacity: 0.18,
          color,
          states: { hover: { lineWidth: 2 } },
        },
      },
      series: [
        {
          type: 'areaspline',
          name: 'Activity',
          data,
        },
      ],
    }),
    [color, data, height]
  );

  return (
    <div aria-label={ariaLabel} role="img">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
};

export default Sparkline;
