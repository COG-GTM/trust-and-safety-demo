import { useState } from "react";

import { api } from "../api/client";
import { renderAsync } from "../components/AsyncState";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { formatDuration, formatNumber, formatTimestamp } from "../utils/format";

const LOOKBACK_OPTIONS = [
  { label: "Last 24 hours", value: 24 },
  { label: "Last 7 days", value: 24 * 7 },
  { label: "Last 30 days", value: 24 * 30 },
];

export default function RuleMetrics() {
  const [lookback, setLookback] = useState(24);
  const state = useAsyncResource(
    () => api.ruleMetrics({ lookback_hours: lookback }),
    [lookback],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Rule metrics</h2>
          <p>Per-rule trigger counts, rates and execution times.</p>
        </div>
      </div>

      <div className="filter-bar">
        <label htmlFor="rules-lookback">Window</label>
        <select
          id="rules-lookback"
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

      {renderAsync(state, (data) => (
        <>
          <section className="card" style={{ marginBottom: 24 }}>
            <h3>{formatNumber(data.rows.length)} rules with activity</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule name</th>
                  <th>Triggers</th>
                  <th>Rate / hour</th>
                  <th>Avg execution</th>
                  <th>Last triggered</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.rule_name}>
                    <td className="action">{row.rule_name}</td>
                    <td>{formatNumber(row.trigger_count)}</td>
                    <td>{row.trigger_rate_per_hour.toFixed(2)}</td>
                    <td>{formatDuration(row.avg_execution_time_ms)}</td>
                    <td>{formatTimestamp(row.last_triggered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {data.rule_action_heatmap.length > 0 ? (
            <section className="card">
              <h3>Rule × action breakdown</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Action</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rule_action_heatmap.map((row, idx) => (
                    <tr key={`${row.rule_name}-${row.action_name}-${idx}`}>
                      <td className="action">{row.rule_name}</td>
                      <td>{row.action_name}</td>
                      <td>{formatNumber(row.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      ))}
    </>
  );
}
