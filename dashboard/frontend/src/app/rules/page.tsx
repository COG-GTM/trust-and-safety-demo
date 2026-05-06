import { RulesTable } from '@/components/RulesTable';
import { fetcher, type RulesResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RulesPage() {
  let data: RulesResponse | null = null;
  let error: string | null = null;
  try {
    data = await fetcher<RulesResponse>('/api/dashboard/rules/stats?hours=24');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Rules Performance</h1>
        <p className="text-sm text-muted mt-1">
          Rule match counts, hit rates, and average execution times over the last 24 hours.
        </p>
      </header>
      {error && (
        <div className="bg-card border border-accent-danger/40 text-accent-danger rounded-lg p-4 text-sm">
          Could not load rules: {error}
        </div>
      )}
      {data && <RulesTable rules={data.rules} />}
    </div>
  );
}
