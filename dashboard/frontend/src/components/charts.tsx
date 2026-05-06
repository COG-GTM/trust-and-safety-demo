/**
 * Lightweight chart components built on top of Recharts. These intentionally
 * pull a consistent palette from CSS custom properties so the dashboard stays
 * on-theme.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const ACCENT_PALETTE = [
  "#22D3EE",
  "#6366F1",
  "#A855F7",
  "#F59E0B",
  "#34D399",
  "#F472B6",
  "#FB7185",
  "#60A5FA",
];

const TOOLTIP_STYLE = {
  background: "#1E293B",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  borderRadius: 8,
  color: "#FFFFFF",
  fontSize: 12,
};

const AXIS_TICK = { fill: "#94A3B8", fontSize: 11 };
const GRID_STROKE = "rgba(148, 163, 184, 0.18)";

interface SeriesPoint {
  label: string;
  [series: string]: number | string;
}

export function TimeSeriesChart({
  data,
  series,
  height = 220,
}: {
  data: SeriesPoint[];
  series: { key: string; label: string; color?: string }[];
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="empty-state">No data in selected range</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={AXIS_TICK} stroke={GRID_STROKE} />
        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ stroke: GRID_STROKE }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#CBD5E1" }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? ACCENT_PALETTE[i % ACCENT_PALETTE.length]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarChartSimple({
  data,
  dataKey,
  height = 220,
}: {
  data: Array<{ label: string; value: number }>;
  dataKey?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="empty-state">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        layout="vertical"
      >
        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
        <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          stroke={GRID_STROKE}
          width={140}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(99,102,241,0.08)" }}
        />
        <Bar dataKey={dataKey ?? "value"} radius={[2, 2, 2, 2]}>
          {data.map((_, idx) => (
            <Cell
              key={idx}
              fill={ACCENT_PALETTE[idx % ACCENT_PALETTE.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieChartSimple({
  data,
  height = 220,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="empty-state">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, idx) => (
            <Cell
              key={idx}
              fill={ACCENT_PALETTE[idx % ACCENT_PALETTE.length]}
              stroke="#0F172A"
              strokeWidth={1}
            />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12, color: "#CBD5E1" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StackedBarTime({
  data,
  series,
  height = 220,
}: {
  data: Array<Record<string, string | number>>;
  series: { key: string; label: string; color?: string }[];
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="empty-state">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={AXIS_TICK} stroke={GRID_STROKE} />
        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(99,102,241,0.08)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#CBD5E1" }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="a"
            fill={s.color ?? ACCENT_PALETTE[i % ACCENT_PALETTE.length]}
            name={s.label}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
