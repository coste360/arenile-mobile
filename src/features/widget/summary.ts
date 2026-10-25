// Day summary of the home screen widget, computed in the app from the
// operational day already in the query cache (the persisted offline cache
// included): the widget itself never fetches anything (spec 04, phase 3).
// Pure functions: the instant, the zone, the language and `t` come in.
import type { TFunction } from 'i18next';

import type { BookingStatus, OperationsDay } from '@/api/types';
import { formatDayLabel, todayIn, type CalendarDate } from '@/lib/calendar';

import { WIDGET_COLORS } from './colors';
import type { DaySummaryWidgetProps, WidgetEntry } from './types';

export interface DaySummary {
  date: CalendarDate;
  closed: boolean;
  arrivals: number;
  /** Bookings present on the day with a balance still due (counted once). */
  toSettle: number;
  checkedIn: number;
  free: number;
}

/** Bookings that no longer expect a payment at the desk. */
const SETTLED_STATES: ReadonlySet<BookingStatus> = new Set([
  'cancelled',
  'no_show',
  'expired',
  'rejected',
]);

export function daySummaryOf(day: OperationsDay): DaySummary {
  const due = new Set<string>();
  for (const spot of day.spots) {
    const b = spot.booking;
    if (b && b.balance_due > 0 && !SETTLED_STATES.has(b.status)) due.add(b.booking_id);
  }
  return {
    date: day.date,
    closed: day.closed,
    arrivals: day.totals.arrivals,
    toSettle: due.size,
    checkedIn: day.totals.checked_in,
    free: day.totals.free,
  };
}

const MINUTE_MS = 60_000;

/**
 * First minute at which the calendar day in `timeZone` differs from the day
 * of `now`: the establishment's next midnight, DST included. Binary search
 * on whole minutes (no zone database needed beyond Intl).
 */
export function nextMidnight(timeZone: string | undefined, now: Date): Date {
  const today = todayIn(timeZone, now);
  let lo = Math.floor(now.getTime() / MINUTE_MS);
  let hi = lo + 49 * 60;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (todayIn(timeZone, new Date(mid * MINUTE_MS)) === today) lo = mid;
    else hi = mid;
  }
  return new Date(hi * MINUTE_MS);
}

/** What the app knows when it publishes the widget. */
export type WidgetSource =
  | { status: 'unpaired' }
  | {
      status: 'paired';
      establishmentName: string;
      timeZone: string | undefined;
      today: CalendarDate;
      /** The cached operational day of today, if any. */
      day?: OperationsDay;
      /** When that day was fetched (epoch ms, from the query cache). */
      updatedAt?: number;
      /** The role may not see the day (no bookings.read). */
      restricted?: boolean;
    };

interface Context {
  now: Date;
  locale: string;
  t: TFunction;
}

function message(title: string, text: string, subtitle = ''): DaySummaryWidgetProps {
  return {
    kind: 'message',
    title,
    subtitle,
    message: text,
    items: [],
    footer: '',
    accessibilityLabel: [title, subtitle, text].filter(Boolean).join('. '),
    colors: WIDGET_COLORS,
  };
}

function timeLabel(at: number, timeZone: string | undefined, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timeZone || 'UTC',
  }).format(at);
}

/**
 * The entries to publish: what to show now and, for a day of data, the
 * message that replaces it at the establishment's midnight, so that iOS
 * never shows yesterday's counts as today's (Android shows the date and
 * waits for the app to update it).
 */
export function widgetEntries(source: WidgetSource, { now, locale, t }: Context): WidgetEntry[] {
  const appName = t('common.appName');
  if (source.status === 'unpaired') {
    return [{ date: now, props: message(appName, t('widget.unpaired')) }];
  }
  const title = source.establishmentName || appName;
  if (source.restricted) {
    return [{ date: now, props: message(title, t('widget.restricted')) }];
  }
  const day = source.day;
  if (!day || day.date !== source.today) {
    return [{ date: now, props: message(title, t('widget.noData')) }];
  }

  const subtitle = formatDayLabel(day.date, locale);
  const midnight = nextMidnight(source.timeZone, now);
  const stale = {
    date: midnight,
    props: message(title, t('widget.stale', { day: subtitle })),
  };
  if (day.closed) {
    return [{ date: now, props: message(title, t('widget.closed'), subtitle) }, stale];
  }

  const s = daySummaryOf(day);
  const items = [
    { label: t('widget.items.arrivals', { count: s.arrivals }), value: String(s.arrivals) },
    { label: t('widget.items.toSettle', { count: s.toSettle }), value: String(s.toSettle) },
    { label: t('widget.items.checkedIn', { count: s.checkedIn }), value: String(s.checkedIn) },
    { label: t('widget.items.free', { count: s.free }), value: String(s.free) },
  ];
  const footer = source.updatedAt
    ? t('widget.updatedAt', { time: timeLabel(source.updatedAt, source.timeZone, locale) })
    : '';
  const props: DaySummaryWidgetProps = {
    kind: 'summary',
    title,
    subtitle,
    message: '',
    items,
    footer,
    accessibilityLabel: [
      title,
      subtitle,
      items.map((i) => `${i.value} ${i.label}`).join(', '),
      footer,
    ]
      .filter(Boolean)
      .join('. '),
    colors: WIDGET_COLORS,
  };
  return [{ date: now, props }, stale];
}
