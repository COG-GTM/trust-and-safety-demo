'use client';

import Link from 'next/link';

import type { FlaggedEventSummary } from '@/lib/api';

interface Props {
  events: FlaggedEventSummary[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
}

export function EventsTable({ events, page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  return (
    <div className="bg-card rounded-xl border border-cardAlt p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">Flagged Events</h3>
          <p className="text-xs text-muted mt-1">{total.toLocaleString()} events in window</p>
        </div>
        {onPageChange && (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className="px-3 py-1 rounded-md border border-cardAlt text-soft hover:text-white disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              Prev
            </button>
            <span className="text-muted">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              className="px-3 py-1 rounded-md border border-cardAlt text-soft hover:text-white disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-cardAlt text-soft">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Action ID</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Action</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Timestamp</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Verdict</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Rules</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Effects</th>
              <th className="px-4 py-2 text-right text-xs uppercase tracking-wider">Latency</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted">
                  No flagged events in this window.
                </td>
              </tr>
            ) : (
              events.map((event, idx) => (
                <tr key={`${event.action_id}-${idx}`} className={idx % 2 === 0 ? 'bg-card' : 'bg-cardAlt'}>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/events/${event.action_id}`} className="text-accent-primary hover:underline">
                      {event.action_id}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-white">{event.action_name ?? '—'}</td>
                  <td className="px-4 py-2 text-soft">{new Date(event.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 text-soft">
                    {event.verdict ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-canvas border border-cardAlt text-xs">
                        {event.verdict}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-soft text-xs">
                    {event.matched_rules.slice(0, 3).join(', ')}
                    {event.matched_rules.length > 3 && ` +${event.matched_rules.length - 3}`}
                  </td>
                  <td className="px-4 py-2 text-soft text-xs">
                    {event.effects.slice(0, 3).join(', ')}
                    {event.effects.length > 3 && ` +${event.effects.length - 3}`}
                  </td>
                  <td className="px-4 py-2 text-right text-soft">
                    {event.execution_duration_ms != null
                      ? `${event.execution_duration_ms.toFixed(1)} ms`
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
