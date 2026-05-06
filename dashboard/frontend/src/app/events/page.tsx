'use client';

import { useEffect, useMemo, useState } from 'react';

import { EventsTable } from '@/components/EventsTable';
import { fetcher, type FlaggedEventsResponse } from '@/lib/api';

export default function EventsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FlaggedEventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    actionName: '',
    verdict: '',
    rule: '',
    effect: '',
    flaggedOnly: true,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('hours', '24');
    params.set('page', String(page));
    params.set('page_size', '25');
    params.set('flagged_only', String(filters.flaggedOnly));
    if (filters.actionName) params.set('action_name', filters.actionName);
    if (filters.verdict) params.set('verdict', filters.verdict);
    if (filters.rule) params.set('rule', filters.rule);
    if (filters.effect) params.set('effect', filters.effect);
    return params.toString();
  }, [page, filters]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetcher<FlaggedEventsResponse>(`/api/dashboard/events/recent?${queryString}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Flagged Events Explorer</h1>
        <p className="text-sm text-muted mt-1">
          Drill into individual events flagged by the rules engine in the last 24 hours.
        </p>
      </header>

      <div className="bg-card rounded-xl border border-cardAlt p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <FilterInput
          label="Action name"
          value={filters.actionName}
          onChange={(v) => setFilters({ ...filters, actionName: v })}
        />
        <FilterInput
          label="Verdict"
          value={filters.verdict}
          onChange={(v) => setFilters({ ...filters, verdict: v })}
        />
        <FilterInput label="Rule" value={filters.rule} onChange={(v) => setFilters({ ...filters, rule: v })} />
        <FilterInput
          label="Effect"
          value={filters.effect}
          onChange={(v) => setFilters({ ...filters, effect: v })}
        />
        <label className="flex items-center gap-2 text-sm text-soft">
          <input
            type="checkbox"
            checked={filters.flaggedOnly}
            onChange={(e) => setFilters({ ...filters, flaggedOnly: e.target.checked })}
            className="accent-accent-primary"
          />
          Flagged only
        </label>
      </div>

      {error && (
        <div className="bg-card border border-accent-danger/40 text-accent-danger rounded-lg p-4 text-sm">
          Could not load events: {error}
        </div>
      )}

      {data && (
        <EventsTable
          events={data.events}
          page={data.page}
          pageSize={data.page_size}
          total={data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-canvas border border-cardAlt rounded-md px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-primary"
        placeholder="any"
      />
    </label>
  );
}
