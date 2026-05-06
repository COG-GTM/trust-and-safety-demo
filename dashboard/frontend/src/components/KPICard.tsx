interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'violet';
}

const ACCENT_COLOR: Record<NonNullable<KPICardProps['accent']>, string> = {
  primary: '#22D3EE',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  violet: '#A78BFA',
};

export function KPICard({ label, value, subtitle, trend, accent = 'primary' }: KPICardProps) {
  const color = ACCENT_COLOR[accent];
  return (
    <div className="bg-card rounded-xl p-5 border border-cardAlt">
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wider text-muted font-medium">{label}</span>
        {trend && (
          <span
            className="text-xs font-medium"
            style={{
              color: trend === 'up' ? '#34D399' : trend === 'down' ? '#F87171' : '#94A3B8',
            }}
          >
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '–'}
          </span>
        )}
      </div>
      <div className="mt-3 text-3xl font-semibold text-white" style={{ color }}>
        {value}
      </div>
      {subtitle && <div className="mt-1 text-xs text-soft">{subtitle}</div>}
    </div>
  );
}
