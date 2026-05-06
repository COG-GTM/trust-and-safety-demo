import * as React from 'react';
import { Empty, Spin } from 'antd';
import dayjs from 'dayjs';
import Highcharts, { SeriesOptionsType } from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { resolveWindowToRange } from '../../../actions/AnalyticsActions';
import { getTimeseriesQueryResults } from '../../../actions/EventActions';
import { TimeseriesResult } from '../../../types/QueryTypes';
import { TimeseriesWidgetConfig, WidgetTimeWindow } from '../../../types/DashboardTypes';

import styles from './Widgets.module.css';

interface Props {
  config: TimeseriesWidgetConfig;
}

function buildSeries(data: TimeseriesResult[]): SeriesOptionsType[] {
  if (data.length === 0) return [];
  return [
    {
      type: 'column',
      name: '# Events',
      color: '#1227ce',
      groupPadding: 0,
      data: data.map((point) => [Date.parse(point.timestamp), point.result.count]),
    },
  ];
}

const RuleHitsTimeSeriesWidget: React.FC<Props> = ({ config }) => {
  const window: WidgetTimeWindow = config.window ?? '24h';
  const granularity = config.granularity ?? 'hour';
  const queryFilter = config.queryFilter ?? '';

  const [data, setData] = React.useState<TimeseriesResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const { start, end } = resolveWindowToRange(window);
    getTimeseriesQueryResults(
      { start, end, queryFilter, interval: 'custom', entityFeatureFilters: new Set() },
      granularity
    ).then((results) => {
      if (!cancelled) {
        setData(results ?? []);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [window, granularity, queryFilter]);

  const series = buildSeries(data);
  const options: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      type: 'datetime',
      labels: { format: '{value:%b %e %l%p}', rotation: -30 },
    },
    yAxis: { min: 0, title: { text: undefined } },
    tooltip: { xDateFormat: '%b %e, %Y %l:%M%p' },
    time: { timezone: dayjs.tz.guess(), useUTC: false },
    series,
  };

  return (
    <div className={styles.chartWrapper}>
      <Spin spinning={isLoading}>
        <div className={styles.chartArea}>
          {series.length === 0 && !isLoading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
          ) : (
            <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
          )}
        </div>
      </Spin>
    </div>
  );
};

export default RuleHitsTimeSeriesWidget;
