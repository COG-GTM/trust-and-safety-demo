'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { ACCENT_COLORS, type VerdictBreakdownEntry } from '@/lib/api';

interface Props {
  data: VerdictBreakdownEntry[];
  height?: number;
}

export function VerdictPieChart({ data, height = 320 }: Props) {
  const cleaned = data.length ? data : [{ verdict: 'no data', count: 1 }];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={cleaned}
          dataKey="count"
          nameKey="verdict"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          stroke="#0F172A"
          strokeWidth={1}
        >
          {cleaned.map((_, idx) => (
            <Cell key={idx} fill={ACCENT_COLORS[idx % ACCENT_COLORS.length]} />
          ))}
        </Pie>
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
      </PieChart>
    </ResponsiveContainer>
  );
}
