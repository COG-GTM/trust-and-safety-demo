import { useState } from "react";

import { api } from "../api/client";
import { renderAsync } from "../components/AsyncState";
import MetricCard from "../components/MetricCard";
import { TimeSeriesChart } from "../components/charts";
import { useAsyncResource } from "../hooks/useAsyncResource";
import {
  formatDuration,
  formatNumber,
  formatPercent,
  shortBucket,
} from "../utils/format";

const LOOKBACK_OPTIONS = [
  { label: "Last hour", value: 1 },
  { label: "Last 24 hours", value: 24 },
  { label: "Last 7 days", value: 24 * 7 },
];

export default function PipelineHealth() {
  const [lookback, setLookback] = useState(24);
  const state = useAsyncResource(
    () => api.pipelineHealth({ lookback_hours: lookback }),
    [lookback],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Pipeline health</h2>
          <p>Throughput, latency, drop rate, and error rate from the worker.</p>
        </div>
      </div>

      <div className="filter-bar">
        <label htmlFor="health-lookback">Window</label>
        <select
          id="health-lookback"
          value={lookback}
          onChange={(e) => setLookback(Number(e.target.value))}
        >
          {LOOKBACK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {renderAsync(state, (data) => {
        const throughput = data.throughput_timeseries.map((p) => ({
          label: shortBucket(p.timestamp),
          throughput: p.value,
        }));
        const latency = data.latency.map((p) => ({
          label: shortBucket(p.timestamp),
          p50: p.p50_ms,
          p95: p.p95_ms,
          p99: p.p99_ms,
        }));
        const errors = data.error_timeseries.map((p) => ({
          label: shortBucket(p.timestamp),
          errors: p.value,
        }));

        return (
          <>
            <section className="metric-grid">
              <MetricCard
                title="Throughput"
                value={`${data.throughput_eps.toFixed(2)} eps`}
                subtitle="Events per second"
              />
              <MetricCard
                title="Avg latency"
                value={formatDuration(data.avg_latency_ms ?? 0)}
                subtitle="From handled_message"
              />
              <MetricCard
                title="Error rate"
                value={formatPercent(data.error_rate)}
                subtitle="Across handled events"
              />
              <MetricCard
                title="Drop rate"
                value={formatPercent(data.drop_rate)}
                subtitle="Implied by sample_rate"
              />
            </section>

            <section className="card" style={{ marginBottom: 24 }}>
              <h3>Throughput</h3>
              <TimeSeriesChart
                data={throughput}
                series={[
                  {
                    key: "throughput",
                    label: "Events / sec",
                    color: "#22D3EE",
                  },
                ]}
              />
            </section>

            <section className="card" style={{ marginBottom: 24 }}>
              <h3>Execution time percentiles</h3>
              <TimeSeriesChart
                data={latency}
                series={[
                  { key: "p50", label: "p50 (ms)", color: "#22D3EE" },
                  { key: "p95", label: "p95 (ms)", color: "#F59E0B" },
                  { key: "p99", label: "p99 (ms)", color: "#EF4444" },
                ]}
              />
            </section>

            <section className="section-grid">
              <div className="card">
                <h3>Error count over time</h3>
                <TimeSeriesChart
                  data={errors}
                  series={[
                    { key: "errors", label: "Errors", color: "#EF4444" },
                  ]}
                />
              </div>
              <div className="card">
                <h3>
                  Recent errors ({formatNumber(data.recent_errors.length)})
                </h3>
                {data.recent_errors.length === 0 ? (
                  <div className="empty-state">No recent errors recorded.</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_errors.slice(0, 20).map((row, idx) => (
                        <tr key={idx}>
                          <td>{String(row.timestamp ?? "—")}</td>
                          <td className="action">
                            {String(row.action_name ?? "—")}
                          </td>
                          <td>{String(row.message ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        );
      })}
    </>
  );
}
