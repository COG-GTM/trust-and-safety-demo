import * as React from 'react';
import { Empty, Spin, Tag, Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

import { RecentAlert } from '../../types/DashboardTypes';

import styles from './RecentAlerts.module.css';

function makeUserEntityRoute(userId: string): string {
  return `/entity/${encodeURIComponent('User')}/${encodeURIComponent(userId)}`;
}

interface RecentAlertsProps {
  alerts: RecentAlert[];
  loading?: boolean;
}

// Parse a label-mutation string of the form "EntityType/LabelName/Status".
function parseLabelMutation(value: string): { entityType?: string; labelName?: string; status?: string } {
  const [entityType, labelName, status] = value.split('/');
  return { entityType, labelName, status };
}

// Parse a ban-user reason of the form "<userId>|<reason>".
function parseBan(value: string): { userId?: string; reason?: string } {
  const idx = value.indexOf('|');
  if (idx < 0) return { userId: value };
  return { userId: value.slice(0, idx), reason: value.slice(idx + 1) };
}

function statusLabel(status: string | undefined): string {
  switch (status) {
    case '1':
      return 'added';
    case '2':
      return 'removed';
    case '3':
      return 'expired';
    case '4':
      return 'manually added';
    case '5':
      return 'manually removed';
    default:
      return status ?? '';
  }
}

const RecentAlerts: React.FC<RecentAlertsProps> = ({ alerts, loading }) => {
  if (loading) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className={styles.center}>
        <Empty description="No recent rule effects" />
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {alerts.map((alert, idx) => {
        const userId = alert.user_id;
        const entityLink = userId != null ? makeUserEntityRoute(userId) : null;
        const ts = dayjs(alert.timestamp);

        return (
          <div className={styles.row} key={`${alert.action_id}-${idx}`}>
            <div className={styles.timestamp}>
              <Tooltip title={ts.format('YYYY-MM-DD HH:mm:ss')}>{ts.fromNow()}</Tooltip>
            </div>
            <div className={styles.body}>
              <div className={styles.headline}>
                {entityLink ? (
                  <Link className={styles.entity} to={entityLink}>
                    {userId}
                  </Link>
                ) : (
                  <span className={styles.entity}>(no user)</span>
                )}
                {alert.action_name && <Tag color="blue">{alert.action_name}</Tag>}
              </div>
              <div className={styles.tags}>
                {alert.rule_effects.map((mutation, i) => {
                  const { entityType, labelName, status } = parseLabelMutation(mutation);
                  return (
                    <Tag color="purple" key={`label-${i}`}>
                      {entityType ?? '?'} · {labelName ?? '?'} ({statusLabel(status)})
                    </Tag>
                  );
                })}
                {alert.verdicts.map((verdict, i) => {
                  const { userId: bannedUser, reason } = parseBan(verdict);
                  return (
                    <Tag color="red" key={`verdict-${i}`}>
                      ban {bannedUser ?? ''}
                      {reason ? ` · ${reason}` : ''}
                    </Tag>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecentAlerts;
