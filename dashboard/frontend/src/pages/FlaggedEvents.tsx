import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { renderAsync } from "../components/AsyncState";
import { BarChartSimple, TimeSeriesChart } from "../components/charts";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { formatNumber, formatTimestamp, shortBucket } from "../utils/format";

const LOOKBACK_OPTIONS = [
  { label: "Last hour", value: 1 },
  { label: "Last 24 hours", value: 24 },
  { label: "Last 7 days", value: 24 * 7 },
  { label: "Last 30 days", value: 24 * 30 },
];

export default function FlaggedEvents() {
  const [lookback, setLookback] = useState(24);
  const [actionName, setActionName] = useState("");
  const [verdict, setVerdict] = useState("");

  const state = useAsyncResource(
    () =>
      api.flaggedEvents({
        lookback_hours: lookback,
        action_name: actionName,
        verdict,
      }),
    [lookback, actionName, verdict],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Flagged events</h2>
          <p>Drill into events the engine flagged via verdict effects.</p>
        </div>
      </div>

      <div className="filter-bar">
        <label htmlFor="lookback">Window</label>
        <select
          id="lookback"
          value={lookback}
          onChange={(e) => setLookback(Number(e.target.value))}
        >
          {LOOKBACK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label htmlFor="action-name">Action name</label>
        <input
          id="action-name"
          placeholder="any"
          value={actionName}
          onChange={(e) => setActionName(e.target.value)}
        />

        <label htmlFor="verdict">Verdict</label>
        <input
          id="verdict"
          placeholder="any"
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
        />
      </div>

      {renderAsync(state, (data) => {
        const tsData = data.timeseries.map((point) => ({
          label: shortBucket(point.timestamp),
          flagged: point.value,
        }));
        const verdictBar = data.by_verdict.map((row) => ({
          label: row.verdict,
          value: row.count,
        }));
        const actionBar = data.by_action_name.map((row) => ({
          label: row.action_name,
          value: row.count,
        }));

        return (
          <>
            <section className="card" style={{ marginBottom: 24 }}>
              <h3>Flagged events over time</h3>
              <TimeSeriesChart
                data={tsData}
                series={[
                  { key: "flagged", label: "Flagged events", color: "#F59E0B" },
                ]}
              />
            </section>

            <section className="section-grid">
              <div className="card">
                <h3>Top verdicts</h3>
                <BarChartSimple data={verdictBar} />
              </div>
              <div className="card">
                <h3>Top action names</h3>
                <BarChartSimple data={actionBar} />
              </div>
            </section>

            <section className="card">
              <h3>{formatNumber(data.total)} matching events</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Verdicts</th>
                    <th>Rules triggered</th>
                    <th>Entity</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={`${row.action_id}-${row.timestamp}`}>
                      <td>{formatTimestamp(row.timestamp)}</td>
                      <td className="action">{row.action_name}</td>
                      <td>
                        {row.verdicts.length === 0
                          ? "—"
                          : row.verdicts.map((v) => (
                              <span key={v} className="pill">
                                {v}
                              </span>
                            ))}
                      </td>
                      <td>{row.rules_triggered.join(", ") || "—"}</td>
                      <td>
                        {row.entity_id ? (
                          <code>
                            {row.entity_type ?? "Entity"}/{row.entity_id}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <Link to={`/events/${row.action_id}`}>Details →</Link>
                      </td>
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
