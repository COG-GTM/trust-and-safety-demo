# Osprey Executive Analytics Dashboard

An executive analytics surface on top of the Osprey trust & safety pipeline.
The dashboard reads aggregated event metrics, full ExecutionResult payloads,
and entity labels straight from the same data stores the production pipeline
already writes to:

| Store                       | Used for                                            |
|-----------------------------|-----------------------------------------------------|
| Postgres `dashboard_event_metrics` | Time-series metrics (rules, verdicts, effects, errors, latency) |
| Postgres `entity_labels`    | Top labels and recent label mutations               |
| MinIO `execution-output`    | Full ExecutionResult JSON for individual events     |
| Druid (optional)            | Higher-volume time-series rollups (future work)     |

## Layout

```
dashboard/
├── backend/                # FastAPI service (port 8080)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py         # FastAPI entry point + /health
│   │   ├── config.py       # env-driven settings
│   │   ├── db.py           # psycopg2 connection helpers + migration runner
│   │   ├── routers/        # 10 dashboard endpoints
│   │   ├── services/       # MinIO + Postgres + label queries
│   │   └── models/         # Pydantic schemas
│   └── migrations/         # 001_create_dashboard_metrics.sql
└── frontend/               # Next.js 14 app router (port 3000 in container, 3001 on host)
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/            # Executive Summary, Rules, Events, Labels, Health pages
        ├── components/     # KPICard, TimeSeriesChart, VerdictPieChart, RulesTable, EventsTable, HealthMetrics, Sidebar
        └── lib/api.ts      # typed API client
```

## API Endpoints

All endpoints are mounted under `/api/dashboard/`:

| Endpoint | Description |
|---|---|
| `GET /summary` | Overall KPIs over a window: total / flagged / dropped / error rate / latency |
| `GET /events/timeline` | Time-series of total / flagged events (bucketed by minute, hour, or day) |
| `GET /rules/stats` | Per-rule match counts, hit rates, average execution times |
| `GET /verdicts/breakdown` | Verdict distribution over the window |
| `GET /labels/top` | Top entity labels and recent mutations |
| `GET /effects/summary` | Counts of each effect type (LabelEffect, custom UDF effects, …) |
| `GET /errors` | Most recent execution errors with traces |
| `GET /pipeline/health` | Throughput, p50/p95/p99 latency, error rate, drop rate |
| `GET /events/recent` | Paginated, filterable list of flagged events |
| `GET /events/{action_id}` | Full event detail (metrics row + MinIO ExecutionResult) |

## Running locally

```bash
docker compose up -d dashboard-backend dashboard-frontend
```

Then:

- Frontend: <http://localhost:3001>
- Backend API: <http://localhost:8080>
- Backend OpenAPI docs: <http://localhost:8080/docs>

The backend applies its migration at startup, and the
`DashboardMetricsOutputSink` lazily creates the same table if it isn't
already present — so as long as the `OSPREY_DASHBOARD_METRICS_SINK=true`
env is set on the worker, metrics will start populating as soon as the
pipeline processes events.

## Pipeline Integration

To populate metrics, the worker registers a new sink:

- `osprey_worker/src/osprey/worker/sinks/sink/dashboard_metrics_sink.py` —
  writes one row per ExecutionResult (action_id, action_name, timestamp,
  verdict, matched rules, effects, execution_duration_ms, sample_rate,
  had_errors).
- Registration lives in `_stdlibplugin/sink_register.py`, gated by the
  `OSPREY_DASHBOARD_METRICS_SINK` config flag.
- Granular metrics (`flagged_event`, `verdict.<type>`, `effect.<type>`,
  `rule_matched`) are emitted from `rules_sink.py` after each
  classification, so existing Datadog dashboards continue to work alongside
  the new ones.
