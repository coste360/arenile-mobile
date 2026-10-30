// Bars of the week chart of the reports (spec 04, "giorno per giorno"):
// takings and occupancy of each day against the previous year, from the
// daily series of the core's year comparison (ComparisonPoint, one per day
// with granularity=day). Integers only: heights in thousandths of the chart.
import type { ComparisonPoint } from '@/api/types';

export type DailySeries = 'revenue' | 'occupancy';
export const DAILY_SERIES: readonly DailySeries[] = ['revenue', 'occupancy'];

/** Height of a full bar. */
export const BAR_SCALE = 1000;
/** Shortest bar of a value above zero, so that it never looks like nothing. */
export const MIN_BAR = 20;
/** Occupancy is always drawn on its full scale: 100% = 10000 basis points. */
export const FULL_OCCUPANCY_BP = 10000;

export interface DailyBar {
  key: string;
  date: string;
  current: number;
  previous: number;
  /** 0…BAR_SCALE */
  currentHeight: number;
  previousHeight: number;
}

export interface DailyBars {
  /** Value of a full bar (cents or basis points). */
  max: number;
  bars: DailyBar[];
}

const VALUES: Record<DailySeries, (p: ComparisonPoint) => [number, number]> = {
  revenue: (p) => [p.current_revenue, p.previous_revenue],
  occupancy: (p) => [p.current_occupancy_bp, p.previous_occupancy_bp],
};

/** Height of `value` on a chart whose full bar is `max`; zero or less draws nothing. */
export function barHeight(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(BAR_SCALE, Math.max(MIN_BAR, Math.round((value * BAR_SCALE) / max)));
}

/**
 * The bars of a series: takings on the scale of the highest day of either
 * year, occupancy always on 0–100% (a quiet week must look quiet).
 */
export function dailyBars(points: readonly ComparisonPoint[], series: DailySeries): DailyBars {
  const values = points.map(VALUES[series]);
  const max =
    series === 'occupancy'
      ? FULL_OCCUPANCY_BP
      : values.reduce((m, [current, previous]) => Math.max(m, current, previous), 0);
  return {
    max,
    bars: points.map((p, i) => {
      const [current, previous] = values[i] ?? [0, 0];
      return {
        key: p.key,
        date: p.current_from,
        current,
        previous,
        currentHeight: barHeight(current, max),
        previousHeight: barHeight(previous, max),
      };
    }),
  };
}
