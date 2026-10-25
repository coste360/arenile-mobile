// Presentation of the year comparison (core GET reports/comparison). The
// server computes every number (ComparisonMetric: current, previous, delta,
// delta_bp truncated and absent when previous = 0); this module only decides
// how to show them, like the panel (web/admin/src/features/reports/lib/delta.ts).
// Integers only: basis points and cents, never floats in the logic.
import type { ComparisonMetric, ComparisonMetricKey } from '@/api/types';
import { formatCents } from '@/lib/money';

/** The metrics the app shows, in display order (takings and occupancy first). */
export const REPORT_METRICS: readonly ComparisonMetricKey[] = [
  'revenue_collected',
  'occupancy_bp',
  'bookings',
  'revenue_booked',
];

/** Direction of a change for the reader. */
export type DeltaTrend = 'up' | 'down' | 'flat';
/** Whether the change is good news, bad news or neither. */
export type DeltaTone = 'positive' | 'negative' | 'neutral';

/** Metrics where an increase is bad news. */
const LOWER_IS_BETTER: ReadonlySet<ComparisonMetricKey> = new Set(['cancellations', 'no_shows']);

export function deltaTrend(metric: Pick<ComparisonMetric, 'delta'>): DeltaTrend {
  if (metric.delta === 0) return 'flat';
  return metric.delta > 0 ? 'up' : 'down';
}

export function deltaTone(metric: Pick<ComparisonMetric, 'metric' | 'delta'>): DeltaTone {
  if (metric.delta === 0) return 'neutral';
  const up = metric.delta > 0;
  return up !== LOWER_IS_BETTER.has(metric.metric) ? 'positive' : 'negative';
}

export function metricsByKey(
  metrics: readonly ComparisonMetric[] | undefined,
): Partial<Record<ComparisonMetricKey, ComparisonMetric>> {
  const out: Partial<Record<ComparisonMetricKey, ComparisonMetric>> = {};
  for (const m of metrics ?? []) out[m.metric] = m;
  return out;
}

const percentFormatters = new Map<string, Intl.NumberFormat>();

function percentFormat(locale: string): Intl.NumberFormat {
  let f = percentFormatters.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    percentFormatters.set(locale, f);
  }
  return f;
}

/**
 * Integer basis points as a signed percentage with one decimal, truncated as
 * the server does: 1250 → "+12,5%" (it), "+12.5%" (en), "+12,5 %" (de, fr);
 * -33 → "−0,3%"; 0 → "0,0%".
 */
export function formatSignedBP(bp: number, locale: string): string {
  const sign = bp > 0 ? '+' : bp < 0 ? '−' : '';
  const tenths = Math.trunc(Math.abs(Math.trunc(bp)) / 10);
  // tenths / 1000 is exact enough for display: the value is already truncated.
  return `${sign}${percentFormat(locale).format(tenths / 1000)}`;
}

/** A ratio in basis points as a percentage with one decimal: 6234 → "62,3%". */
export function formatRatioBP(bp: number, locale: string): string {
  return formatSignedBP(Math.abs(bp), locale).replace(/^\+/, '');
}

/** Change of a basis-point metric (occupancy) in percentage points: 450 → "+4,5 p.p.". */
export function formatPointsDelta(deltaBP: number, locale: string, unit: string): string {
  return `${formatSignedBP(deltaBP, locale).replace(/\s?%/, '')} ${unit}`;
}

/** Integer count with the grouping of the language: 12345 → "12.345" (it), "12,345" (en). */
export function formatCount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

/** A value of a metric in its unit (cents, count, basis points). */
export function formatMetricValue(
  m: Pick<ComparisonMetric, 'unit'>,
  value: number,
  locale: string,
): string {
  switch (m.unit) {
    case 'cents':
      return formatCents(value, { locale });
    case 'basis_points':
      return formatRatioBP(value, locale);
    default:
      return formatCount(value, locale);
  }
}

/**
 * Change of a metric as shown next to it: percentage points for ratios,
 * relative change otherwise, `newLabel` when the previous value was 0
 * (delta_bp absent) and the current one is not (0 → 0 is no change).
 */
export function formatDelta(
  m: ComparisonMetric,
  locale: string,
  labels: { points: string; new: string },
): string {
  if (m.unit === 'basis_points') return formatPointsDelta(m.delta, locale, labels.points);
  if (m.delta_bp !== undefined) return formatSignedBP(m.delta_bp, locale);
  return m.delta === 0 ? formatSignedBP(0, locale) : labels.new;
}
