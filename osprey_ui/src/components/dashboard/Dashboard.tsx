import * as React from 'react';
import { Link } from 'react-router-dom';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import HighchartsHeatmap from 'highcharts/modules/heatmap';
import { Spin } from 'antd';
import dayjs from 'dayjs';

import { useDashboardData, FlaggedUser, FlaggedEvent, HourlyBucket, ActionBreakdown } from './useDashboardData';
import styles from './Dashboard.module.css';

// Initialize heatmap module
HighchartsHeatmap(Highcharts);

/* ── KPI Cards ─────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  accent: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, subtext, accent }) => (
  <div className={`${styles.kpiCard} ${accent}`}>
    <p className={styles.kpiLabel}>{label}</p>
    <p className={styles.kpiValue}>{value}</p>
    {subtext && <p className={styles.kpiSubtext}>{subtext}</p>}
  </div>
);

/* ── Traffic Timeseries ────────────────────────────────── */

interface TrafficTimeseriesProps {
  hourlyBuckets: HourlyBucket[];
}

const TrafficTimeseries: React.FC<TrafficTimeseriesProps> = ({ hourlyBuckets }) => {
  const options: Highcharts.Options = {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      height: 280,
      style: { fontFamily: 'Inter, Roboto, system-ui, sans-serif' },
    },
    title: { text: undefined },
    legend: {
      itemStyle: { color: '#cbd5e1', fontWeight: '500', fontSize: '11px' },
      itemHoverStyle: { color: '#ffffff' },
    },
    xAxis: {
      categories: hourlyBuckets.map((b) => `${String(b.hour).padStart(2, '0')}:00`),
      labels: { style: { color: '#94a3b8', fontSize: '10px' }, rotation: -45 },
      lineColor: 'rgba(255,255,255,0.08)',
      tickColor: 'transparent',
    },
    yAxis: {
      title: { text: undefined },
      labels: { style: { color: '#94a3b8', fontSize: '10px' } },
      gridLineColor: 'rgba(255,255,255,0.05)',
    },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: 'rgba(255,255,255,0.1)',
      style: { color: '#ffffff', fontSize: '12px' },
      shared: true,
    },
    plotOptions: {
      column: { borderRadius: 3, borderWidth: 0, groupPadding: 0.08 },
    },
    credits: { enabled: false },
    series: [
      {
        type: 'column',
        name: 'Posts',
        data: hourlyBuckets.map((b) => b.posts),
        color: '#22d3ee',
      },
      {
        type: 'column',
        name: 'Logins',
        data: hourlyBuckets.map((b) => b.logins),
        color: '#6366f1',
      },
      {
        type: 'line',
        name: 'Flagged',
        data: hourlyBuckets.map((b) => b.flagged),
        color: '#ef4444',
        lineWidth: 2.5,
        marker: { radius: 3, fillColor: '#ef4444' },
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

/* ── Flag Rate Heatmap ─────────────────────────────────── */

interface FlagRateHeatmapProps {
  hourlyBuckets: HourlyBucket[];
}

function getHeatColor(rate: number): string {
  if (rate === 0) return '#1e293b';
  if (rate < 10) return '#065f46';
  if (rate < 15) return '#047857';
  if (rate < 20) return '#b45309';
  if (rate < 25) return '#c2410c';
  return '#dc2626';
}

const FlagRateHeatmap: React.FC<FlagRateHeatmapProps> = ({ hourlyBuckets }) => (
  <>
    <div className={styles.heatmapGrid}>
      {hourlyBuckets.map((b) => (
        <div
          key={b.hour}
          className={styles.heatmapCell}
          style={{ backgroundColor: getHeatColor(b.flagRate) }}
          title={`${String(b.hour).padStart(2, '0')}:00 — ${b.flagged}/${b.total} flagged (${b.flagRate.toFixed(1)}%)`}
        >
          {b.flagRate > 0 ? `${Math.round(b.flagRate)}` : ''}
        </div>
      ))}
    </div>
    <div className={styles.heatmapLabels}>
      {hourlyBuckets.map((b) => (
        <span key={b.hour} className={styles.heatmapLabel}>
          {b.hour % 3 === 0 ? `${b.hour}` : ''}
        </span>
      ))}
    </div>
  </>
);

/* ── Top Flagged Users ─────────────────────────────────── */

interface TopFlaggedUsersProps {
  users: FlaggedUser[];
}

function getRateClass(rate: number): string {
  if (rate >= 40) return styles.rateHigh;
  if (rate >= 20) return styles.rateMedium;
  return styles.rateLow;
}

const TopFlaggedUsers: React.FC<TopFlaggedUsersProps> = ({ users }) => {
  if (users.length === 0) return <div className={styles.emptyState}>No flagged users</div>;

  return (
    <table className={styles.usersTable}>
      <thead>
        <tr>
          <th>#</th>
          <th>User</th>
          <th>Flags</th>
          <th>Events</th>
          <th>Rate</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u, i) => (
          <tr key={u.userId}>
            <td>{i + 1}</td>
            <td>{u.userId}</td>
            <td>
              <span className={styles.flagBadge}>{u.flagCount}</span>
            </td>
            <td>{u.totalEvents}</td>
            <td>
              <span className={getRateClass(u.flagRate)}>{u.flagRate.toFixed(0)}%</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/* ── Action Breakdown Donut ────────────────────────────── */

interface ActionBreakdownChartProps {
  breakdown: ActionBreakdown[];
  totalEvents: number;
  flaggedPosts: number;
  totalPosts: number;
}

const DONUT_COLORS = ['#22d3ee', '#6366f1', '#ec4899', '#10b981', '#f59e0b'];

const ActionBreakdownChart: React.FC<ActionBreakdownChartProps> = ({
  breakdown,
  totalEvents,
  flaggedPosts,
  totalPosts,
}) => {
  const options: Highcharts.Options = {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      height: 220,
      style: { fontFamily: 'Inter, Roboto, system-ui, sans-serif' },
    },
    title: { text: undefined },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: 'rgba(255,255,255,0.1)',
      style: { color: '#ffffff', fontSize: '12px' },
      pointFormat: '<b>{point.y}</b> ({point.percentage:.1f}%)',
    },
    plotOptions: {
      pie: {
        innerSize: '60%',
        borderWidth: 2,
        borderColor: '#1e293b',
        dataLabels: {
          enabled: true,
          format: '{point.name}',
          style: { color: '#cbd5e1', fontSize: '11px', fontWeight: '500', textOutline: 'none' },
          distance: 15,
        },
        colors: DONUT_COLORS,
      },
    },
    credits: { enabled: false },
    series: [
      {
        type: 'pie',
        name: 'Events',
        data: breakdown.map((b, i) => ({
          name: b.name,
          y: b.count,
          color: DONUT_COLORS[i % DONUT_COLORS.length],
        })),
      },
    ],
  };

  const flagRate = totalPosts > 0 ? ((flaggedPosts / totalPosts) * 100).toFixed(1) : '0';

  return (
    <div className={styles.donutContainer}>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <div className={styles.donutStats}>
        <div className={styles.donutStat}>
          <span className={styles.donutStatLabel}>ContainsHello rule trigger rate</span>
          <span className={styles.donutStatValue}>
            {flagRate}% of posts ({flaggedPosts}/{totalPosts})
          </span>
        </div>
        <div className={styles.donutStat}>
          <span className={styles.donutStatLabel}>Flagged → ban conversion</span>
          <span className={styles.donutStatValue}>100%</span>
        </div>
      </div>
    </div>
  );
};

/* ── Flagged Events Feed ───────────────────────────────── */

interface FlaggedEventsFeedProps {
  events: FlaggedEvent[];
}

const FlaggedEventsFeed: React.FC<FlaggedEventsFeedProps> = ({ events }) => {
  if (events.length === 0) return <div className={styles.emptyState}>No flagged events in this period</div>;

  return (
    <div className={styles.feedList}>
      {events.map((e) => (
        <Link key={e.id} to={`/events/${e.id}`} style={{ textDecoration: 'none' }}>
          <div className={styles.feedCard}>
            <div className={styles.feedCardHeader}>
              <span className={styles.feedUser}>{e.userId}</span>
              <span className={styles.feedTimestamp}>{dayjs(e.timestamp).format('MMM D, h:mm A')}</span>
            </div>
            <div className={styles.feedPostText}>{e.postText || '(no text)'}</div>
            <div className={styles.feedActions}>
              {e.banReason && <span className={styles.feedTagBan}>BAN</span>}
              {e.labelMutation && <span className={styles.feedTagLabel}>LABEL</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

/* ── Main Dashboard ────────────────────────────────────── */

const Dashboard: React.FC = () => {
  const data = useDashboardData();

  if (data.isLoading) {
    return (
      <div className={styles.dashboardPage}>
        <div className={styles.loadingContainer}>
          <Spin size="large" />
          <span className={styles.loadingText}>Loading dashboard data…</span>
        </div>
      </div>
    );
  }

  const { kpis, hourlyBuckets, topFlaggedUsers, flaggedEvents, actionBreakdown } = data;

  const totalPosts = actionBreakdown.find((a) => a.name === 'create_post')?.count ?? 0;

  return (
    <div className={styles.dashboardPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>🛡</div>
          <div>
            <h1 className={styles.title}>Trust &amp; Safety Dashboard</h1>
            <p className={styles.subtitle}>Executive overview · Last 24 hours</p>
          </div>
        </div>
        <Link to="/" className={styles.backLink}>
          ← Back to Query View
        </Link>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="Total Events"
          value={kpis.totalEvents.toLocaleString()}
          subtext={`~${kpis.avgEventsPerHour}/hr`}
          accent={styles.kpiAccentCyan}
        />
        <KpiCard
          label="Flagged Events"
          value={kpis.flaggedEvents.toLocaleString()}
          subtext={`${kpis.flaggedRate.toFixed(1)}% flag rate`}
          accent={styles.kpiAccentPink}
        />
        <KpiCard label="Unique Users" value={kpis.uniqueUsers.toLocaleString()} accent={styles.kpiAccentIndigo} />
        <KpiCard label="Ban Actions" value={kpis.banActions.toLocaleString()} accent={styles.kpiAccentRed} />
        <KpiCard
          label="Error Rate"
          value={`${kpis.errorRate.toFixed(1)}%`}
          subtext="login errors"
          accent={styles.kpiAccentAmber}
        />
        <KpiCard label="Avg Events/Hr" value={kpis.avgEventsPerHour.toLocaleString()} accent={styles.kpiAccentGreen} />
      </div>

      {/* Row 2: Timeseries + Heatmap */}
      <div className={styles.chartRow}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Hourly Event Volume</h3>
          <p className={styles.chartSubtitle}>Posts vs logins with flagged overlay</p>
          <TrafficTimeseries hourlyBuckets={hourlyBuckets} />
        </div>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Flag Rate by Hour (%)</h3>
          <p className={styles.chartSubtitle}>Green = low, red = high flag percentage</p>
          <FlagRateHeatmap hourlyBuckets={hourlyBuckets} />
        </div>
      </div>

      {/* Row 3: Top Users + Action Breakdown */}
      <div className={styles.chartRow}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Top Flagged Users</h3>
          <TopFlaggedUsers users={topFlaggedUsers} />
        </div>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Action Type Breakdown</h3>
          <ActionBreakdownChart
            breakdown={actionBreakdown}
            totalEvents={kpis.totalEvents}
            flaggedPosts={kpis.flaggedEvents}
            totalPosts={totalPosts}
          />
        </div>
      </div>

      {/* Row 4: Flagged Events Feed */}
      <div className={styles.chartRow}>
        <div className={styles.fullWidthCard}>
          <h3 className={styles.chartTitle}>Recent Flagged Events</h3>
          <FlaggedEventsFeed events={flaggedEvents} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
