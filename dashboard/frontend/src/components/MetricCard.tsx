interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

export default function MetricCard({
  title,
  value,
  subtitle,
}: MetricCardProps) {
  return (
    <div className="card metric-card">
      <h3>{title}</h3>
      <div className="delta">
        <div className="value">{value}</div>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
    </div>
  );
}
