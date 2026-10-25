// Periods of the essential reports (spec 04, phase 3): a day or a week of
// the establishment, compared with the previous year. Pure functions on
// calendar dates in the establishment zone; "today" comes from the caller
// (useOperationalDays), never from the device clock.
import { addDays, type CalendarDate } from '@/lib/calendar';

export type ReportRange = 'day' | 'week';

export const REPORT_RANGES: readonly ReportRange[] = ['day', 'week'];

export interface ReportPeriod {
  from: CalendarDate;
  to: CalendarDate;
}

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: CalendarDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * The period of a range around `anchor`: the day itself, or its ISO week
 * (Monday to Sunday, the whole week: occupancy of the coming days is already
 * known from the bookings, takings simply stop at today).
 */
export function periodOf(range: ReportRange, anchor: CalendarDate): ReportPeriod {
  if (range === 'day') return { from: anchor, to: anchor };
  const from = addDays(anchor, 1 - isoWeekday(anchor));
  return { from, to: addDays(from, 6) };
}

/** The anchor of the previous (-1) or next (+1) day or week. */
export function shiftAnchor(
  range: ReportRange,
  anchor: CalendarDate,
  direction: -1 | 1,
): CalendarDate {
  return addDays(anchor, direction * (range === 'day' ? 1 : 7));
}

/**
 * The next period may be opened only while it starts no later than today:
 * reports look back (with the current week included), not into the future.
 */
export function canGoForward(range: ReportRange, anchor: CalendarDate, today: CalendarDate) {
  return periodOf(range, shiftAnchor(range, anchor, 1)).from <= today;
}

/** True when the period contains today (the "current" day or week). */
export function isCurrent(period: ReportPeriod, today: CalendarDate): boolean {
  return period.from <= today && today <= period.to;
}
