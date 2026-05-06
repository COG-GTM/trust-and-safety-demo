import { api } from "../api/client";
import { renderAsync } from "../components/AsyncState";
import MetricCard from "../components/MetricCard";
import { BarChartSimple } from "../components/charts";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { formatNumber } from "../utils/format";

export default function Labels() {
  const state = useAsyncResource(api.labelStats, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Label analytics</h2>
          <p>Distribution of labels currently applied to entities.</p>
        </div>
      </div>

      {renderAsync(state, (data) => {
        const distributionBar = data.distribution.slice(0, 10).map((row) => ({
          label: row.label_name,
          value: row.count,
        }));
        const recentBar = data.recently_applied.slice(0, 10).map((row) => ({
          label: row.label_name,
          value: row.count,
        }));

        return (
          <>
            <section className="metric-grid">
              <MetricCard
                title="Labeled entities"
                value={formatNumber(data.total_labeled_entities)}
                subtitle="Distinct entities with active labels"
              />
              <MetricCard
                title="Distinct labels"
                value={formatNumber(data.distribution.length)}
                subtitle="In active use"
              />
              <MetricCard
                title="Applied (24h)"
                value={formatNumber(
                  data.recently_applied.reduce((acc, r) => acc + r.count, 0),
                )}
                subtitle="Across all entities"
              />
              <MetricCard
                title="Expiring (24h)"
                value={formatNumber(
                  data.expiring_soon.reduce((acc, r) => acc + r.count, 0),
                )}
                subtitle="Labels approaching TTL"
              />
            </section>

            <section className="section-grid">
              <div className="card">
                <h3>Top labels</h3>
                <BarChartSimple data={distributionBar} />
              </div>
              <div className="card">
                <h3>Recently applied (24h)</h3>
                <BarChartSimple data={recentBar} />
              </div>
            </section>

            <section className="card">
              <h3>Entities with the most labels</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Label count</th>
                    <th>Labels</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_entities.map((row) => (
                    <tr key={row.entity_key}>
                      <td className="action">
                        <code>{row.entity_key}</code>
                      </td>
                      <td>{row.label_count}</td>
                      <td>
                        {row.labels.map((label) => (
                          <span key={label} className="pill">
                            {label}
                          </span>
                        ))}
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
