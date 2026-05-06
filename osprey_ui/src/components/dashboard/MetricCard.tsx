import * as React from 'react';
import { Card, Statistic } from 'antd';

import { MetricSeries } from '../../types/DashboardTypes';

import Sparkline from './Sparkline';
import styles from './MetricCard.module.css';

interface MetricCardProps {
  title: string;
  series: MetricSeries;
  color?: string;
  footer?: React.ReactNode;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, series, color, footer, loading }) => {
  return (
    <Card className={styles.card} bordered loading={loading}>
      <div className={styles.header}>
        <Statistic
          title={title}
          value={series.total}
          valueStyle={{ fontSize: 28, fontWeight: 600 }}
          groupSeparator=","
        />
      </div>
      <div className={styles.spark}>
        <Sparkline points={series.points} color={color} ariaLabel={`${title} sparkline`} />
      </div>
      {footer != null && <div className={styles.footer}>{footer}</div>}
    </Card>
  );
};

export default MetricCard;
