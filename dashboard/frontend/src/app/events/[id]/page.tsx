import Link from 'next/link';

import { fetcher, type EventDetailResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { id: string };
}

export default async function EventDetailPage({ params }: PageProps) {
  let data: EventDetailResponse | null = null;
  let error: string | null = null;
  try {
    data = await fetcher<EventDetailResponse>(`/api/dashboard/events/${params.id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">Event</p>
          <h1 className="text-2xl font-semibold text-white font-mono">{params.id}</h1>
        </div>
        <Link href="/events" className="text-sm text-accent-primary hover:underline">
          ← Back to events
        </Link>
      </header>

      {error && (
        <div className="bg-card border border-accent-danger/40 text-accent-danger rounded-lg p-4 text-sm">
          Could not load event: {error}
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Action" value={data.action_name ?? '—'} />
            <Field label="Verdict" value={data.verdict ?? '—'} />
            <Field
              label="Timestamp"
              value={data.timestamp ? new Date(data.timestamp).toLocaleString() : '—'}
            />
            <Field
              label="Latency"
              value={data.execution_duration_ms != null ? `${data.execution_duration_ms.toFixed(2)} ms` : '—'}
            />
          </section>

          <section className="bg-card rounded-xl border border-cardAlt p-5 space-y-3">
            <h3 className="text-white font-semibold">Matched Rules</h3>
            {data.matched_rules.length === 0 ? (
              <p className="text-muted text-sm">No matched rules.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {data.matched_rules.map((rule) => (
                  <li
                    key={rule}
                    className="px-3 py-1 rounded-full bg-cardAlt text-soft text-xs border border-canvas"
                  >
                    {rule}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-card rounded-xl border border-cardAlt p-5 space-y-3">
            <h3 className="text-white font-semibold">Effects</h3>
            {data.effects.length === 0 ? (
              <p className="text-muted text-sm">No effects produced.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {data.effects.map((effect) => (
                  <li
                    key={effect}
                    className="px-3 py-1 rounded-full bg-cardAlt text-soft text-xs border border-canvas"
                  >
                    {effect}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-card rounded-xl border border-cardAlt p-5">
            <h3 className="text-white font-semibold mb-3">Extracted Features</h3>
            <pre className="bg-canvas rounded-md p-4 text-xs text-soft overflow-x-auto max-h-96 overflow-y-auto">
              {JSON.stringify(data.extracted_features, null, 2)}
            </pre>
          </section>

          {data.error_traces.length > 0 && (
            <section className="bg-card rounded-xl border border-accent-danger/40 p-5">
              <h3 className="text-accent-danger font-semibold mb-3">Errors</h3>
              <pre className="bg-canvas rounded-md p-4 text-xs text-accent-danger overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(data.error_traces, null, 2)}
              </pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-xl border border-cardAlt p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-white text-sm font-medium break-all">{value}</p>
    </div>
  );
}
