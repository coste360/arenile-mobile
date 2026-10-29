// Season calendar of a spot (core spec 30.5, GET spots/{spotId}/calendar):
// for every day of the season the morning and afternoon status and the
// bookings involved with their balance. Online only and never persisted
// (spec 21.2: the offline cache keeps today and tomorrow). Colours as the
// panel's spotCalendar.ts (web/admin/src/features/operations/lib).
import { useQuery } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type {
  SpotCalendar,
  SpotCalendarBooking,
  SpotCalendarCell,
  SpotCalendarDay,
} from '@/api/types';
import type { Abilities } from '@/features/permissions/permissions';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { addDays, type CalendarDate } from '@/lib/calendar';

import type { SpotStatus } from './status';

/** The core lets bookings.read or operations.run read the calendar (inventory.SpotCalendar). */
export const canViewSpotCalendar = (a: Pick<Abilities, 'canViewBookings' | 'canCheckIn'>) =>
  a.canViewBookings || a.canCheckIn;

export function fetchSpotCalendar(
  client: ApiClient,
  establishmentId: string,
  spotId: string,
): Promise<SpotCalendar> {
  return request(() =>
    client.GET('/api/admin/v1/establishments/{establishmentId}/spots/{spotId}/calendar', {
      params: { path: { establishmentId, spotId } },
    }),
  );
}

/** GET spots/{spotId}/calendar of the current (or next) season. */
export function useSpotCalendar(spotId: string) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery({
    queryKey: estKeys.spotCalendar(establishmentId, spotId),
    queryFn: () => fetchSpotCalendar(client, establishmentId, spotId),
    staleTime: 60_000,
  });
}

/**
 * Status of a half day on the map palette: a booking or pass with an open
 * balance shows "da incassare", like the map.
 */
export function cellStatus(
  cell: SpotCalendarCell,
  bookings: ReadonlyMap<string, SpotCalendarBooking>,
): SpotStatus {
  const b = cell.booking_id ? bookings.get(cell.booking_id) : undefined;
  switch (cell.status) {
    case 'free':
      return 'free';
    case 'booked':
      return b && b.balance_due > 0 ? 'to_collect' : 'booked_desk';
    case 'season_pass':
      return b && b.balance_due > 0 ? 'to_collect' : 'season';
    case 'released':
      return 'season_released';
    case 'held':
      return 'hold';
    case 'blocked':
      return 'blocked';
    default:
      return 'unavailable';
  }
}

/** Statuses of the calendar legend, in order (those the calendar can show). */
export const CALENDAR_LEGEND: readonly SpotStatus[] = [
  'free',
  'booked_desk',
  'to_collect',
  'season',
  'season_released',
  'hold',
  'blocked',
  'unavailable',
];

export interface CalendarMonth {
  /** "2026-07" */
  key: string;
  /** Weeks Monday to Sunday; a day outside the season (or the month) is null. */
  weeks: (SpotCalendarDay | null)[][];
}

/** ISO weekday of a calendar date, Monday = 0 … Sunday = 6. */
function weekday(date: CalendarDate): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Season days in month grids of weeks starting on Monday, so that a month
 * reads as a wall calendar; months without season days are left out.
 */
export function calendarMonths(days: readonly SpotCalendarDay[]): CalendarMonth[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const keys = [...new Set(days.map((d) => d.date.slice(0, 7)))].sort();
  return keys.map((key) => {
    const first = `${key}-01`;
    const weeks: (SpotCalendarDay | null)[][] = [];
    let week: (SpotCalendarDay | null)[] = Array.from({ length: weekday(first) }, () => null);
    for (let d = first; d.slice(0, 7) === key; d = addDays(d, 1)) {
      week.push(byDate.get(d) ?? null);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return { key, weeks };
  });
}

/** Booking a day opens: the morning's, else the afternoon's. */
export function bookingOfDay(d: SpotCalendarDay): string | undefined {
  return d.am.booking_id ?? d.pm.booking_id;
}
