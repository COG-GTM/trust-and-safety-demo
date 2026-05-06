import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import { renderAsync } from "../components/AsyncState";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { formatTimestamp } from "../utils/format";

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const id = Number(eventId);
  const state = useAsyncResource(() => api.eventDetail(id), [id]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Event #{eventId}</h2>
          <p>Full execution result for the selected action.</p>
        </div>
        <Link to="/flagged">← Back to flagged events</Link>
      </div>

      {renderAsync(state, (data) => (
        <>
          <section className="metric-grid">
            <div className="card">
              <h3>Action</h3>
              <div className="value" style={{ fontSize: 18 }}>
                {data.action_name}
              </div>
              <small style={{ color: "var(--text-muted)" }}>
                action_id: <code>{data.action_id}</code>
              </small>
            </div>
            <div className="card">
              <h3>Timestamp</h3>
              <div className="value" style={{ fontSize: 18 }}>
                {formatTimestamp(data.timestamp)}
              </div>
            </div>
            <div className="card">
              <h3>Verdicts</h3>
              <div>
                {data.verdicts.length === 0
                  ? "—"
                  : data.verdicts.map((v) => (
                      <span key={v} className="pill">
                        {v}
                      </span>
                    ))}
              </div>
            </div>
            <div className="card">
              <h3>Sample rate</h3>
              <div className="value" style={{ fontSize: 18 }}>
                {data.sample_rate || 100}
              </div>
              <small style={{ color: "var(--text-muted)" }}>
                0 = always sampled, 100 = never
              </small>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 24 }}>
            <h3>Rules triggered</h3>
            {data.rules_triggered.length === 0 ? (
              <div className="empty-state">No rules evaluated to True.</div>
            ) : (
              <ul>
                {data.rules_triggered.map((r) => (
                  <li key={r}>
                    <code>{r}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" style={{ marginBottom: 24 }}>
            <h3>Label mutations</h3>
            {data.label_mutations.length === 0 ? (
              <div className="empty-state">No labels were mutated.</div>
            ) : (
              <pre>{JSON.stringify(data.label_mutations, null, 2)}</pre>
            )}
          </section>

          <section className="card" style={{ marginBottom: 24 }}>
            <h3>Errors</h3>
            {data.error_infos.length === 0 ? (
              <div className="empty-state">No SML errors recorded.</div>
            ) : (
              <pre>{JSON.stringify(data.error_infos, null, 2)}</pre>
            )}
          </section>

          <section className="card">
            <h3>Extracted features</h3>
            <pre>{JSON.stringify(data.extracted_features, null, 2)}</pre>
          </section>
        </>
      ))}
    </>
  );
}
