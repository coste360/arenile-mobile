// Fixtures of the year comparison report (phase 3).
import type { ComparisonMetric, ComparisonPoint, YearComparisonReport } from '@/api/types';
import { addDays, daysBetween } from '@/lib/calendar';

export function comparisonMetric(overrides: Partial<ComparisonMetric> = {}): ComparisonMetric {
  return {
    metric: 'revenue_collected',
    unit: 'cents',
    current: 125000,
    previous: 100000,
    delta: 25000,
    delta_bp: 2500,
    ...overrides,
  };
}

export function comparisonPoint(
  date: string,
  overrides: Partial<ComparisonPoint> = {},
): ComparisonPoint {
  return {
    key: date,
    label: date,
    current_from: date,
    previous_from: `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`,
    current_revenue: 50000,
    previous_revenue: 40000,
    current_occupancy_bp: 6234,
    previous_occupancy_bp: 5000,
    current_bookings: 12,
    previous_bookings: 10,
    ...overrides,
  };
}

const lastYear = (date: string) => `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;

/** A comparison of from..to against the same dates of the previous year. */
export function yearComparison(from: string, to: string): YearComparisonReport {
  const days = daysBetween(from, to) + 1;
  return {
    current: { from, to, days },
    previous: { from: lastYear(from), to: lastYear(to), days },
    granularity: 'day',
    align: 'calendar',
    metrics: [
      comparisonMetric(),
      comparisonMetric({
        metric: 'occupancy_bp',
        unit: 'basis_points',
        current: 6234,
        previous: 5784,
        delta: 450,
        delta_bp: 778,
      }),
      comparisonMetric({
        metric: 'bookings',
        unit: 'count',
        current: 40,
        previous: 50,
        delta: -10,
        delta_bp: -2000,
      }),
      comparisonMetric({
        metric: 'revenue_booked',
        unit: 'cents',
        current: 90000,
        previous: 0,
        delta: 90000,
        delta_bp: undefined,
      }),
      comparisonMetric({
        metric: 'cancellations',
        unit: 'count',
        current: 1,
        previous: 1,
        delta: 0,
      }),
    ],
    series: Array.from({ length: days }, (_, i) => comparisonPoint(addDays(from, i))),
  };
}
