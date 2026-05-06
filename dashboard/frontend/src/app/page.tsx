import { Suspense } from 'react';

import { KPICard } from '@/components/KPICard';
import { TimeSeriesChart } from '@/components/TimeSeriesChart';
import { VerdictPieChart } from '@/components/VerdictPieChart';
import {
  fetcher,
  type RulesResponse,
  type SummaryResponse,
  type TimelineResponse,
  type VerdictBreakdownResponse,
} from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadData() {
  const [summary, timeline, verdicts, rules] = await Promise.all([
    fetcher<SummaryResponse>('/api/dashboard/summary?hours=24'),
    fetcher<TimelineResponse>('/api/dashboard/events/timeline?hours=24&bucket=hour'),
    fetcher<VerdictBreakdownResponse>('/api/dashboard/verdicts/breakdown?hours=24'),
    fetcher<RulesResponse>('/api/dashboard/rules/stats?hours=24'),
  ]);
  return { summary, timeline, verdicts, rules };
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function fmtMs(n: number | null): string {
  return n != null ? `${n.toFixed(1)} ms` : '—';
}

export default async function ExecutiveSummaryPage() {
  let data: Awaited<ReturnType<typeof loadData>> | null = null;
  let error: string | null = null;
  try {
    data = await loadData();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Executive Summary</h1>
          <p className="text-sm text-muted mt-1">
            Last 24 hours of trust &amp; safety activity. Auto-refreshes on page reload.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-card border border-accent-danger/40 text-accent-danger rounded-lg p-4 text-sm">
          Could not load metrics: {error}
        </div>
      )}

      {data && (
        <>
          <Suspense>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <KPICard label="Events (24h)" value={fmtNumber(data.summary.total_events)} accent="primary" />
              <KPICard label="Flagged" value={fmtNumber(data.summary.total_flagged)} accent="violet" />
              <KPICard label="Flag Rate" value={fmtPercent(data.summary.flag_rate)} accent="warning" />
              <KPICard label="Error Rate" value={fmtPercent(data.summary.error_rate)} accent="danger" />
              <KPICard
                label="Avg Latency"
                value={fmtMs(data.summary.avg_latency_ms)}
                subtitle={`p95: ${fmtMs(data.summary.p95_latency_ms)}`}
                accent="success"
              />
            </div>
          </Suspense>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card rounded-xl border border-cardAlt p-5">
              <h3 className="text-white font-semibold mb-3">Events Processed vs. Flagged</h3>
              <TimeSeriesChart points={data.timeline.points} />
            </div>
            <div className="bg-card rounded-xl border border-cardAlt p-5">
              <h3 className="text-white font-semibold mb-3">Verdict Distribution</h3>
              <VerdictPieChart data={data.verdicts.breakdown} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-cardAlt p-5">
            <h3 className="text-white font-semibold mb-4">Top 5 Triggered Rules</h3>
            <ul className="divide-y divide-cardAlt">
              {data.rules.rules.slice(0, 5).map((rule) => (
                <li key={rule.rule_name} className="flex items-center justify-between py-2">
                  <span className="text-white text-sm">{rule.rule_name}</span>
                  <span className="text-soft text-sm">
                    {fmtNumber(rule.match_count)}{' '}
                    <span className="text-muted">({fmtPercent(rule.match_rate)})</span>
                  </span>
                </li>
              ))}
              {data.rules.rules.length === 0 && (
                <li className="py-6 text-center text-muted text-sm">
                  No rules have triggered in this window yet.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
