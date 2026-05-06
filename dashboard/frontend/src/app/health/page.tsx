import { HealthMetrics } from '@/components/HealthMetrics';
import { KPICard } from '@/components/KPICard';
import {
  fetcher,
  type ErrorsResponse,
  type PipelineHealthResponse,
} from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function fmtThroughput(n: number): string {
  if (n >= 1) return `${n.toFixed(2)} ev/s`;
  if (n > 0) return `${(n * 60).toFixed(2)} ev/min`;
  return '0';
}

export default async function HealthPage() {
  let health: PipelineHealthResponse | null = null;
  let errors: ErrorsResponse | null = null;
  let error: string | null = null;
  try {
    [health, errors] = await Promise.all([
      fetcher<PipelineHealthResponse>('/api/dashboard/pipeline/health?hours=1'),
      fetcher<ErrorsResponse>('/api/dashboard/errors?limit=25'),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Pipeline Health</h1>
        <p className="text-sm text-muted mt-1">
          Throughput, latency percentiles, drop rate, and most recent pipeline errors (last hour).
        </p>
      </header>

      {error && (
        <div className="bg-card border border-accent-danger/40 text-accent-danger rounded-lg p-4 text-sm">
          Could not load health: {error}
        </div>
      )}

      {health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Throughput"
            value={fmtThroughput(health.throughput_per_sec)}
            accent="primary"
          />
          <KPICard label="Drop Rate" value={fmtPercent(health.drop_rate)} accent="warning" />
          <KPICard label="Error Rate" value={fmtPercent(health.error_rate)} accent="danger" />
          <KPICard
            label="Consumer Lag"
            value={health.consumer_lag != null ? fmtNumber(health.consumer_lag) : '—'}
            accent="success"
          />
        </div>
      )}

      {health && <HealthMetrics health={health} />}

      {errors && (
        <div className="bg-card rounded-xl border border-cardAlt p-5">
          <h3 className="text-white font-semibold mb-3">Recent errors</h3>
          {errors.errors.length === 0 ? (
            <p className="text-muted text-sm">No pipeline errors in the recent window.</p>
          ) : (
            <ul className="divide-y divide-cardAlt">
              {errors.errors.map((err) => (
                <li key={err.action_id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-accent-primary">{err.action_id}</span>
                    <span className="text-xs text-muted">
                      {err.timestamp ? new Date(err.timestamp).toLocaleString() : '—'}
                    </span>
                  </div>
                  {err.action_name && <p className="text-soft text-sm mt-1">{err.action_name}</p>}
                  {err.rules_source_location && (
                    <p className="text-xs text-muted mt-1">at {err.rules_source_location}</p>
                  )}
                  {err.traceback && (
                    <pre className="mt-2 bg-canvas rounded-md p-3 text-xs text-accent-danger overflow-x-auto max-h-40 overflow-y-auto">
                      {err.traceback}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
