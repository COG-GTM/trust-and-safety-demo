import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fetcher, type LabelsResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LabelsPage() {
  let data: LabelsResponse | null = null;
  let error: string | null = null;
  try {
    data = await fetcher<LabelsResponse>('/api/dashboard/labels/top?limit=15&mutations_limit=25');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Labels &amp; Entities</h1>
        <p className="text-sm text-muted mt-1">
          Top labels currently applied across entities, plus the most recent label state changes.
        </p>
      </header>

      {error && (
        <div className="bg-card border border-accent-danger/40 text-accent-danger rounded-lg p-4 text-sm">
          Could not load labels: {error}
        </div>
      )}

      {data && (
        <>
          <div className="bg-card rounded-xl border border-cardAlt p-5">
            <h3 className="text-white font-semibold mb-3">Top labels</h3>
            <LabelsBarChart data={data.top.map((l) => ({ name: l.label, value: l.count }))} />
          </div>

          <div className="bg-card rounded-xl border border-cardAlt p-5">
            <h3 className="text-white font-semibold mb-3">Recent label mutations</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-cardAlt text-soft">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Entity</th>
                    <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Label</th>
                    <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_mutations.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted">
                        No labels applied yet.
                      </td>
                    </tr>
                  ) : (
                    data.recent_mutations.map((m, idx) => (
                      <tr
                        key={`${m.entity_key}-${m.label}-${idx}`}
                        className={idx % 2 === 0 ? 'bg-card' : 'bg-cardAlt'}
                      >
                        <td className="px-4 py-2 font-mono text-xs text-soft">{m.entity_key}</td>
                        <td className="px-4 py-2 text-white">{m.label}</td>
                        <td className="px-4 py-2 text-soft">{m.status ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LabelsBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
        <Bar dataKey="value" fill="#A78BFA" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
