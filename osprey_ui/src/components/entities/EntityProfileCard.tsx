import * as React from 'react';
import { Card, Col, Empty, Row, Spin, Statistic, Tag, Typography } from 'antd';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { getEntityProfile } from '../../actions/DashboardActions';
import { EntityProfileResponse } from '../../types/DashboardTypes';

import styles from './EntityProfileCard.module.css';

interface EntityProfileCardProps {
  entityType: string;
  entityId: string;
  /** When true, render in a more compact form (e.g. inside the right rail of the QueryView). */
  compact?: boolean;
  /** Refresh tick: bump this to force a re-fetch from the parent. */
  refreshKey?: number;
}

const STATUS_COLORS: Record<string, string> = {
  added: 'green',
  manually_added: 'green',
  removed: 'red',
  manually_removed: 'red',
  expired: 'gold',
  unknown: 'default',
};

const EntityProfileCard: React.FC<EntityProfileCardProps> = ({
  entityType,
  entityId,
  compact = false,
  refreshKey = 0,
}) => {
  const [profile, setProfile] = React.useState<EntityProfileResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEntityProfile(entityType, entityId)
      .then((res) => {
        if (!cancelled) setProfile(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, refreshKey]);

  const sparklineOptions: Highcharts.Options = React.useMemo(() => {
    const data = (profile?.activity ?? []).map((p) => [Date.parse(p.timestamp), p.count] as [number, number]);
    return {
      chart: {
        type: 'areaspline',
        height: 60,
        margin: [4, 0, 4, 0],
        backgroundColor: 'transparent',
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: '#dbdcdf',
        formatter() {
          const ts = Highcharts.dateFormat('%b %e %l:%M%p', this.x as number);
          return `<div style="font-size:11px"><strong>${ts}</strong><br/>${this.y} events</div>`;
        },
      },
      xAxis: { type: 'datetime', visible: false },
      yAxis: { visible: false },
      plotOptions: {
        areaspline: {
          marker: { enabled: false },
          lineWidth: 1.5,
          color: '#1227ce',
          fillOpacity: 0.18,
        },
      },
      series: [{ type: 'areaspline', name: 'Activity', data }],
    };
  }, [profile]);

  if (loading && profile == null) {
    return (
      <Card className={compact ? styles.compactCard : styles.card} title="Entity Profile" bordered>
        <div className={styles.center}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (profile == null) {
    return (
      <Card className={compact ? styles.compactCard : styles.card} title="Entity Profile" bordered>
        <Empty description="Profile unavailable" />
      </Card>
    );
  }

  return (
    <Card
      className={compact ? styles.compactCard : styles.card}
      title={
        <div className={styles.title}>
          <Typography.Text strong>{entityType}</Typography.Text>
          <Typography.Text className={styles.identifier}>{entityId}</Typography.Text>
        </div>
      }
      bordered
    >
      <Row gutter={[12, 12]}>
        <Col span={8}>
          <Statistic title="Rules triggered" value={profile.rules_triggered} />
        </Col>
        <Col span={8}>
          <Statistic title="Labels applied" value={profile.labels_applied} />
        </Col>
        <Col span={8}>
          <Statistic title="Verdicts" value={profile.verdicts_issued} />
        </Col>
      </Row>

      <div className={styles.section}>
        <Typography.Text type="secondary" className={styles.sectionLabel}>
          Activity (last 24h)
        </Typography.Text>
        <HighchartsReact highcharts={Highcharts} options={sparklineOptions} />
      </div>

      <div className={styles.section}>
        <Typography.Text type="secondary" className={styles.sectionLabel}>
          Labels
        </Typography.Text>
        <div className={styles.tagList}>
          {profile.label_breakdown.length === 0 ? (
            <Typography.Text type="secondary">None</Typography.Text>
          ) : (
            profile.label_breakdown.map((entry, idx) => (
              <Tag color={STATUS_COLORS[entry.status] ?? 'default'} key={idx}>
                {entry.label_name} · {entry.status}
                {entry.count > 1 ? ` ×${entry.count}` : ''}
              </Tag>
            ))
          )}
        </div>
      </div>

      {Object.keys(profile.related_entities).length > 0 && (
        <div className={styles.section}>
          <Typography.Text type="secondary" className={styles.sectionLabel}>
            Related entities (recent activity)
          </Typography.Text>
          {Object.entries(profile.related_entities).map(([key, values]) => (
            <div key={key} className={styles.relatedRow}>
              <Typography.Text strong className={styles.relatedKey}>
                {key}:
              </Typography.Text>
              <div className={styles.tagList}>
                {values.map((value) => (
                  <Tag key={value}>{value}</Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default EntityProfileCard;
