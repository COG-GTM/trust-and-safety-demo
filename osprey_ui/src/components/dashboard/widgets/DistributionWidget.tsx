import * as React from 'react';
import { Empty, Spin } from 'antd';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { getEffectsBreakdown, getRuleDistribution } from '../../../actions/AnalyticsActions';
import { DistributionEntry, DistributionWidgetConfig, WidgetTimeWindow } from '../../../types/DashboardTypes';

import styles from './Widgets.module.css';

const COLORS = ['#1227ce', '#3550e0', '#5c70e8', '#8693f0', '#aab4f6', '#3e7025', '#b23a32', '#e89339', '#9d4ad4'];

interface Props {
  config: DistributionWidgetConfig;
  source: 'rule' | 'effects';
  defaultDimension: string;
}

const DistributionWidget: React.FC<Props> = ({ config, source, defaultDimension }) => {
  const window: WidgetTimeWindow = config.window ?? '24h';
  const queryFilter = config.queryFilter ?? '';
  const dimension = config.dimension ?? defaultDimension;
  const limit = config.limit ?? 8;

  const [entries, setEntries] = React.useState<DistributionEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const fetcher = source === 'rule' ? getRuleDistribution : getEffectsBreakdown;
    fetcher({ window, queryFilter, dimension, limit }).then((response) => {
      if (cancelled) return;
      setEntries(response.distribution.slice(0, limit));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [source, window, queryFilter, dimension, limit]);

  if (isLoading) {
    return <Spin />;
  }

  if (entries.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;
  }

  const options: Highcharts.Options = {
    chart: { type: 'pie', backgroundColor: 'transparent' },
    title: { text: undefined },
    credits: { enabled: false },
    tooltip: { pointFormat: '<b>{point.y}</b> events ({point.percentage:.1f}%)' },
    plotOptions: {
      pie: {
        innerSize: '55%',
        dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.0f}%' },
      },
    },
    series: [
      {
        type: 'pie',
        name: dimension,
        data: entries.map((entry, index) => ({
          name: entry.name,
          y: entry.count,
          color: COLORS[index % COLORS.length],
        })),
      },
    ],
  };

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.chartArea}>
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </div>
    </div>
  );
};

export default DistributionWidget;
