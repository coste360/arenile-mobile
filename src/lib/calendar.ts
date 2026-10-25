// Calendar dates, like the core's internal/calendar: "YYYY-MM-DD" in the
// establishment time zone (spec 17.1). "Today" is computed in that zone from
// an injected instant (Clock), never from the device zone: a phone set to
// another zone, or a staff member abroad, must see the establishment's day.

/** A calendar date "YYYY-MM-DD" (the API's `Date` schema). */
export type CalendarDate = string;

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a well-formed, existing "YYYY-MM-DD" date. */
export function isCalendarDate(v: unknown): v is CalendarDate {
  if (typeof v !== 'string') return false;
  const m = ISO_DATE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function toUtc(date: CalendarDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/**
 * Calendar day of `now` in `timeZone` (IANA, e.g. "Europe/Rome"). An unknown
 * or missing zone falls back to UTC, the zone of the API instants.
 */
export function todayIn(timeZone: string | undefined, now: Date): CalendarDate {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const y = get('year');
  const m = get('month');
  const d = get('day');
  const date = `${y}-${m}-${d}`;
  return isCalendarDate(date) ? date : now.toISOString().slice(0, 10);
}

/** `date` plus `n` calendar days (n may be negative). */
export function addDays(date: CalendarDate, n: number): CalendarDate {
  return new Date(toUtc(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** Today and tomorrow in the establishment zone: the offline window (spec 21.2). */
export function operationalDays(
  timeZone: string | undefined,
  now: Date,
): { today: CalendarDate; tomorrow: CalendarDate } {
  const today = todayIn(timeZone, now);
  return { today, tomorrow: addDays(today, 1) };
}

/** True when the stay [startsOn, endsOn] includes `date`. */
export function stayIncludes(
  stay: { starts_on: CalendarDate; ends_on: CalendarDate },
  date: CalendarDate,
): boolean {
  return stay.starts_on <= date && stay.ends_on >= date;
}

/** Localised day label for display, e.g. "dom 25 ott" (it) or "Sun, Oct 25" (en). */
export function formatDayLabel(date: CalendarDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(toUtc(date)));
}
