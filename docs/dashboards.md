# Analytics Dashboards

Osprey ships with a customizable analytics dashboard surface for Trust & Safety
operators. Dashboards are user-configurable layouts of widgets that visualize
data from Druid (`osprey.execution_results`) and Postgres (`entity_labels`).

## Where to find it

In the running UI, click **Dashboards** in the left side menu. From there you
can:

- Open an existing dashboard.
- Create a blank dashboard via **+ New dashboard**.
- Start from a built-in template:
  - **Operations Overview** — throughput, verdict mix, error count, event volume.
  - **Rule Performance** — per-rule hit rates and trend lines.
  - **Entity Investigation** — top entities, label activity, time series.

## Editing a dashboard

Open a dashboard and click **Edit**. In edit mode you can:

- **Add widget** — select from 8 built-in widget types (see below).
- **Drag** a widget by its title bar to move it.
- **Resize** a widget using the handle in the bottom-right corner.
- **Configure** a widget (gear icon) — set the title, time range, granularity,
  group-by dimension, top-N limit, SML filter expression, refresh interval and
  primary color.
- Set **dashboard-wide** time range, query filter and refresh interval from the
  controls bar at the top.
- **Save** to persist your changes, or **Discard** to revert.

Outside edit mode the dashboard auto-refreshes at the configured interval. Each
widget also has a manual refresh button.

## Widget types

| Type | What it shows |
| --- | --- |
| `timeSeriesChart` | Counts over time (Druid timeseries query). |
| `verdictDistributionPie` | Donut of verdict types over the time range. |
| `ruleHitRateBar` | Horizontal bar chart of top rules by hits. |
| `throughputGauge` | Big-number events/sec plus sparkline. |
| `labelActivityTable` | Recent entity labels (Postgres `entity_labels`). |
| `errorRateIndicator` | Big-number error count plus sparkline. |
| `topEntitiesTable` | Top-N entities by event volume. |
| `heatmapCalendar` | Day × hour grid colored by event volume. |

## Backend endpoints

The frontend talks to the same Flask UI API server as the rest of the UI
(`osprey-ui-api`, port `5004`). New endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboards` | List dashboards (optional `?user_email=` filter). |
| POST | `/api/dashboards` | Create a dashboard. |
| GET | `/api/dashboards/<id>` | Fetch a single dashboard. |
| PATCH | `/api/dashboards/<id>` | Update fields (`name`, `description`, `layout_json`, `is_template`). |
| DELETE | `/api/dashboards/<id>` | Delete a dashboard. |
| POST | `/api/analytics/timeseries` | Druid timeseries (`start`, `end`, `query_filter`, `granularity`). |
| POST | `/api/analytics/groupby` | Druid TopN by dimension. |
| POST | `/api/analytics/verdicts/summary` | TopN with default `dimension="Verdict"`. |
| POST | `/api/analytics/rules/performance` | TopN with default `dimension="RuleName"`. |
| POST | `/api/analytics/throughput` | Druid timeseries with `granularity="minute"` default. |
| GET | `/api/analytics/labels/summary` | Aggregations over Postgres `entity_labels` (returns empty payload gracefully when the table is not deployed). |
| GET | `/api/analytics/execution-results` | Convenience timeseries query using URL params. |

## Persistence model

Dashboards are stored in Postgres in the `dashboards` table:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `BIGINT` | Snowflake-generated primary key. |
| `name` | `TEXT` | Human-readable name. |
| `owner` | `TEXT` | Email of the user who created it. |
| `description` | `TEXT` | Optional. |
| `layout_json` | `JSONB` | Serialized dashboard layout (see `DashboardLayoutJson` in `osprey_ui/src/types/DashboardTypes.tsx`). |
| `is_template` | `BOOLEAN` | Reserved for future template promotion. |
| `created_at` / `updated_at` | `TIMESTAMP WITH TIME ZONE` | Auto-managed. |

The table is created automatically on app startup via SQLAlchemy's
`metadata.create_all()` flow used by other models in this repo. There is no
Alembic migration step.

## Abilities

Three new marker abilities gate the new endpoints:

- `CAN_VIEW_DASHBOARDS` — required for `GET` on `/dashboards`.
- `CAN_CREATE_AND_EDIT_DASHBOARDS` — required for `POST/PATCH/PUT/DELETE` on
  `/dashboards`.
- `CAN_VIEW_ANALYTICS` — required for everything under `/analytics`.

The analytics endpoints additionally honor `CAN_VIEW_EVENTS_BY_ACTION` /
`CAN_VIEW_EVENTS_BY_ENTITY` query-filter abilities (the same ones used by the
existing event-search endpoints).

The local-dev `super_user` ACL has been updated to include these abilities so
the docker-compose stack works out of the box.

## Adding a new widget type

1. Add the new type to `DashboardWidgetTypes` in
   `osprey_ui/src/types/DashboardTypes.tsx`.
2. Implement the widget component in
   `osprey_ui/src/components/dashboards/widgets/`. The component receives
   `{ widget, ctx }` where `ctx` is the resolved time range + filter.
3. Register it in
   `osprey_ui/src/components/dashboards/widgets/registry.tsx`.
4. (Optional) Add helpers for `defaultLayoutForType` and
   `defaultDataSourceForType` in
   `osprey_ui/src/utils/DashboardUtils.tsx` so the **Add widget** flow gives
   the new type sensible defaults.

## Out of scope (deferred)

These were intentionally left out of the initial implementation; revisit if
they become priorities:

- **WebSocket streaming** for live label activity. The current dashboard polls
  on a configurable interval, which is sufficient for the analytical use cases
  these widgets target.
- **PDF export** of full dashboards. Highcharts' built-in PNG export is
  available per-chart; the dashboard **Export** button writes the dashboard
  config as JSON.
- **Sharing via URL-encoded config**. Dashboards already have a stable `id` and
  the page URL is the share link; no need to encode the layout into the URL.
