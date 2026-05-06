# Osprey Executive Analytics Dashboard

A self-contained web app that visualizes flagged events, rule execution metrics, label analytics,
and pipeline health for executive stakeholders. It consumes data from the existing Osprey output
sinks:

- **Apache Druid** (ingests `osprey.execution_results` Kafka topic from
  `KafkaOutputSink`) — used for time-series and group-by analytics on extracted features.
- **PostgreSQL labels database** (written by `LabelOutputSink` via
  `example_plugins/src/services/labels_service.py`) — used for label distribution and lifecycle
  analytics.
- **Execution result store** (MinIO / Postgres / BigTable / GCS — selected by
  `OSPREY_EXECUTION_RESULT_STORAGE_BACKEND` and written by `StoredExecutionResultOutputSink`) —
  used to render full per-event drill-downs.
- **Pipeline metrics table** (optional) populated by `DashboardMetricsOutputSink` — a new sink
  that summarises every execution result into PostgreSQL so the dashboard can compute throughput,
  latency, drop rates, and error rates without a Datadog/StatsD round trip.

```
dashboard/
├── backend/                 # FastAPI service (its own pyproject.toml + venv)
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Settings via env vars (Druid URL, Postgres URL, etc.)
│   ├── routers/             # /api/overview, /api/events, /api/rules, /api/labels, /api/pipeline
│   ├── services/            # druid_client, labels_db, results_store, metrics_agg
│   └── models/              # Pydantic response schemas
├── frontend/                # React + TypeScript single-page app (Vite)
│   ├── src/pages/           # Overview, FlaggedEvents, RuleMetrics, PipelineHealth
│   └── src/components/      # MetricCard, TimeSeriesChart, PieChart, DataTable, FilterBar
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.dashboard.yml
└── README.md
```

> The dashboard is intentionally isolated from the main Python project. It vendors its own
> dependencies in `dashboard/backend/pyproject.toml` so it does not need to be added to the
> root `uv.lock` (no impact on the production worker / UI API images). It is excluded from
> the root `ruff`, `mypy`, and `fawltydeps` configurations — see `pyproject.toml` and
> `.pre-commit-config.yaml`.

## Running locally with the rest of the Osprey stack

The dashboard is designed to attach to the existing services in `docker-compose.yaml`. Start the
core stack first (Kafka, Postgres, Druid, MinIO, worker, …), then start the dashboard:

```bash
docker compose up -d
docker compose -f docker-compose.yaml -f dashboard/docker-compose.dashboard.yml up -d \
  dashboard-backend dashboard-frontend
```

- Dashboard backend → `http://localhost:5005`
- Dashboard frontend → `http://localhost:5006`
- Health check → `http://localhost:5005/api/health`

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DASHBOARD_DRUID_URL` | `http://druid-broker:8082` | Druid broker for event analytics |
| `DASHBOARD_DRUID_DATASOURCE` | `osprey.execution_results` | Druid datasource fed by Kafka |
| `DASHBOARD_POSTGRES_URL` | `postgresql://osprey:FoolishPassword@postgres:5432/osprey` | Same DB used by the labels service |
| `DASHBOARD_RESULTS_STORE_TYPE` | `minio` | One of `minio`, `postgres`, `bigtable`, `gcs`, `none` |
| `DASHBOARD_MINIO_ENDPOINT` | `minio:9000` | MinIO endpoint when `RESULTS_STORE_TYPE=minio` |
| `DASHBOARD_MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `DASHBOARD_MINIO_SECRET_KEY` | `minioadmin123` | MinIO secret key |
| `DASHBOARD_MINIO_BUCKET` | `execution-output` | Same bucket used by the worker |
| `DASHBOARD_REFRESH_INTERVAL_SECONDS` | `30` | Frontend polling interval |
| `DASHBOARD_DEFAULT_LOOKBACK_HOURS` | `24` | Default analytics window |

Enable the metrics sink in the worker via:

```yaml
OSPREY_DASHBOARD_METRICS_SINK: "True"
```

That instructs `osprey_worker/src/osprey/worker/_stdlibplugin/sink_register.py` to register the
new `DashboardMetricsOutputSink`, which writes to the `pipeline_metrics` table.

## Development

```bash
# Backend (FastAPI + uvicorn)
cd dashboard/backend
uv sync
uv run uvicorn main:app --reload --port 5005

# Frontend (Vite dev server)
cd dashboard/frontend
npm install
npm run dev -- --port 5006
```

The frontend reads the backend URL from `VITE_DASHBOARD_API_BASE_URL` (defaults to
`http://localhost:5005`).
