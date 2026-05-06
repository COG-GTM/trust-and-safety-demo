'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { PipelineHealthResponse } from '@/lib/api';

interface Props {
  health: PipelineHealthResponse;
}

export function HealthMetrics({ health }: Props) {
  const latencyData = [
    { name: 'p50', value: health.p50_latency_ms ?? 0 },
    { name: 'p95', value: health.p95_latency_ms ?? 0 },
    { name: 'p99', value: health.p99_latency_ms ?? 0 },
  ];
  return (
    <div className="bg-card rounded-xl border border-cardAlt p-5">
      <h3 className="text-white font-semibold mb-4">Latency Distribution</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={latencyData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            stroke="#94A3B8"
            tick={{ fill: '#CBD5E1', fontSize: 12 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
          />
          <YAxis
            stroke="#94A3B8"
            tick={{ fill: '#CBD5E1', fontSize: 12 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
            unit="ms"
          />
          <Tooltip
            contentStyle={{
              background: '#1E293B',
              border: '1px solid #243449',
              borderRadius: 8,
              color: '#FFFFFF',
            }}
            labelStyle={{ color: '#CBD5E1' }}
            formatter={(value: number) => [`${value.toFixed(2)} ms`, 'Latency']}
          />
          <Bar dataKey="value" fill="#22D3EE" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
