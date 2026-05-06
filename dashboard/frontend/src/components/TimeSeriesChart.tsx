'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { TimelinePoint } from '@/lib/api';

function formatBucket(value: string): string {
  try {
    const date = new Date(value);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

interface Props {
  points: TimelinePoint[];
  height?: number;
}

export function TimeSeriesChart({ points, height = 320 }: Props) {
  const data = points.map((p) => ({
    ...p,
    bucketLabel: formatBucket(p.bucket),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <XAxis
          dataKey="bucketLabel"
          stroke="#94A3B8"
          tick={{ fill: '#CBD5E1', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
        />
        <YAxis
          stroke="#94A3B8"
          tick={{ fill: '#CBD5E1', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
        />
        <Tooltip
          contentStyle={{
            background: '#1E293B',
            border: '1px solid #243449',
            borderRadius: 8,
            color: '#FFFFFF',
          }}
          labelStyle={{ color: '#CBD5E1' }}
        />
        <Legend wrapperStyle={{ color: '#CBD5E1' }} />
        <Line
          type="monotone"
          dataKey="total"
          name="Total"
          stroke="#22D3EE"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="flagged"
          name="Flagged"
          stroke="#F87171"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
