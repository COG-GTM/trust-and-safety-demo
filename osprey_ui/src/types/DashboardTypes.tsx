export interface TimeseriesPoint {
  timestamp: string;
  value: number;
}

export interface MetricSeries {
  total: number;
  points: TimeseriesPoint[];
}

export interface SummaryResponse {
  events: MetricSeries;
  rules_fired: MetricSeries;
  labels_applied: MetricSeries;
  verdicts_issued: MetricSeries;
}

export interface RuleHitRow {
  rule_key: string;
  label_name: string | null;
  entity_type: string | null;
  current_count: number;
  previous_count: number;
  difference: number;
  percentage_change: number | null;
}

export interface RuleHitTimeseriesPoint {
  timestamp: string;
  rule_key: string;
  count: number;
}

export interface RulePerformanceResponse {
  rules: RuleHitRow[];
  series: RuleHitTimeseriesPoint[];
  false_positive_rate: number | null;
}

export interface LabelActivityPoint {
  timestamp: string;
  label_name: string;
  added: number;
  removed: number;
}

export interface LabelActivityResponse {
  points: LabelActivityPoint[];
  label_names: string[];
}

export interface VerdictBucket {
  verdict: string;
  count: number;
}

export interface VerdictDistributionResponse {
  buckets: VerdictBucket[];
  total: number;
}

export interface RecentAlert {
  timestamp: string;
  action_id: number;
  action_name: string | null;
  user_id: string | null;
  rule_effects: string[];
  verdicts: string[];
}

export interface RecentAlertsResponse {
  alerts: RecentAlert[];
}

export interface EntityLabelEntry {
  label_name: string;
  status: string;
  count: number;
}

export interface EntityActivityPoint {
  timestamp: string;
  count: number;
}

export interface EntityProfileResponse {
  entity_type: string;
  entity_id: string;
  rules_triggered: number;
  labels_applied: number;
  verdicts_issued: number;
  label_breakdown: EntityLabelEntry[];
  activity: EntityActivityPoint[];
  related_entities: Record<string, string[]>;
}
