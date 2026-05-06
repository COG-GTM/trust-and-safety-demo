'use client';

import { useMemo, useState } from 'react';

import type { RuleStat } from '@/lib/api';

type SortKey = 'rule_name' | 'match_count' | 'match_rate' | 'avg_execution_time_ms' | 'last_triggered';

interface Props {
  rules: RuleStat[];
}

export function RulesTable({ rules }: Props) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('match_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const filtered = rules.filter((r) => r.rule_name.toLowerCase().includes(filter.toLowerCase()));
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rules, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="bg-card rounded-xl border border-cardAlt p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Rules Performance</h3>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter rules…"
          className="bg-canvas border border-cardAlt rounded-md px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-primary"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-cardAlt text-soft">
            <tr>
              <ColumnHeader label="Rule" sortKey="rule_name" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              <ColumnHeader label="Matches" sortKey="match_count" current={sortKey} dir={sortDir} onToggle={toggleSort} align="right" />
              <ColumnHeader label="Match Rate" sortKey="match_rate" current={sortKey} dir={sortDir} onToggle={toggleSort} align="right" />
              <ColumnHeader label="Avg Latency" sortKey="avg_execution_time_ms" current={sortKey} dir={sortDir} onToggle={toggleSort} align="right" />
              <ColumnHeader label="Last Triggered" sortKey="last_triggered" current={sortKey} dir={sortDir} onToggle={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  No rules matched in this window.
                </td>
              </tr>
            ) : (
              sorted.map((rule, idx) => (
                <tr
                  key={rule.rule_name}
                  className={idx % 2 === 0 ? 'bg-card' : 'bg-cardAlt'}
                >
                  <td className="px-4 py-2 text-white">{rule.rule_name}</td>
                  <td className="px-4 py-2 text-right text-white">{rule.match_count.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-soft">{(rule.match_rate * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right text-soft">
                    {rule.avg_execution_time_ms != null ? `${rule.avg_execution_time_ms.toFixed(2)} ms` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-soft">
                    {rule.last_triggered ? new Date(rule.last_triggered).toLocaleString() : '—'}
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

interface ColumnHeaderProps {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  onToggle: (key: SortKey) => void;
  align?: 'left' | 'right';
}

function ColumnHeader({ label, sortKey, current, dir, onToggle, align = 'left' }: ColumnHeaderProps) {
  const isActive = sortKey === current;
  return (
    <th
      className={`px-4 py-2 cursor-pointer select-none text-xs uppercase tracking-wider ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={() => onToggle(sortKey)}
    >
      <span className={isActive ? 'text-accent-primary' : 'text-soft'}>
        {label}
        {isActive && <span className="ml-1">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}
