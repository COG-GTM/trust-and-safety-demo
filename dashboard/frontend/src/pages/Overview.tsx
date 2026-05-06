import { api } from "../api/client";
import { renderAsync } from "../components/AsyncState";
import MetricCard from "../components/MetricCard";
import {
  BarChartSimple,
  PieChartSimple,
  TimeSeriesChart,
} from "../components/charts";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { formatNumber, formatPercent, shortBucket } from "../utils/format";

export default function Overview() {
  const state = useAsyncResource(api.overview, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Executive overview</h2>
          <p>
            Cross-stack snapshot of flagged events, rule activity, and pipeline
            performance.
          </p>
        </div>
      </div>

      {renderAsync(state, (data) => {
        const window24h = data.windows.find((w) => w.label === "24h");
        const totalEvents = window24h?.total_events ?? 0;
        const flagged = window24h?.flagged_events ?? 0;
        const flagRate = window24h?.flag_rate ?? 0;
        const errorRate = window24h?.error_rate ?? 0;
        const tsData = data.events_timeseries.map((point, idx) => ({
          label: shortBucket(point.timestamp),
          total: point.value,
          flagged: data.flagged_events_timeseries[idx]?.value ?? 0,
        }));
        const verdictPie = data.verdict_breakdown.map((row) => ({
          label: row.verdict,
          value: row.count,
        }));
        const topRulesBar = data.top_rules.map((row) => ({
          label: row.rule_name,
          value: row.trigger_count,
        }));

        return (
          <>
            <section className="metric-grid">
              <MetricCard
                title="Total events (24h)"
                value={formatNumber(totalEvents)}
                subtitle="Processed by the engine"
              />
              <MetricCard
                title="Flagged events (24h)"
                value={formatNumber(flagged)}
                subtitle={`${formatPercent(flagRate)} flag rate`}
              />
              <MetricCard
                title="Error rate (24h)"
                value={formatPercent(errorRate)}
                subtitle="SML evaluation errors"
              />
              <MetricCard
                title="Top rule"
                value={data.top_rules[0]?.rule_name ?? "—"}
                subtitle={
                  data.top_rules[0]
                    ? `${formatNumber(data.top_rules[0].trigger_count)} triggers`
                    : "No rules fired"
                }
              />
            </section>

            <section className="card" style={{ marginBottom: 24 }}>
              <h3>Events processed vs. flagged</h3>
              <TimeSeriesChart
                data={tsData}
                series={[
                  { key: "total", label: "Total events", color: "#22D3EE" },
                  { key: "flagged", label: "Flagged events", color: "#F59E0B" },
                ]}
              />
            </section>

            <section className="section-grid">
              <div className="card">
                <h3>Top triggered rules</h3>
                <BarChartSimple data={topRulesBar} />
              </div>
              <div className="card">
                <h3>Verdict distribution</h3>
                <PieChartSimple data={verdictPie} />
              </div>
            </section>

            <section className="card">
              <h3>Window comparison</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Window</th>
                    <th>Total events</th>
                    <th>Flagged</th>
                    <th>Flag rate</th>
                    <th>Errors</th>
                    <th>Error rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.windows.map((row) => (
                    <tr key={row.label}>
                      <td className="action">{row.label}</td>
                      <td>{formatNumber(row.total_events)}</td>
                      <td>{formatNumber(row.flagged_events)}</td>
                      <td>{formatPercent(row.flag_rate)}</td>
                      <td>{formatNumber(row.error_count)}</td>
                      <td>{formatPercent(row.error_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        );
      })}
    </>
  );
}
