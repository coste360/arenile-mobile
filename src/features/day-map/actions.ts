// Actions the spot sheet offers (core spec 11.3 "tocco su una postazione",
// phase 1 "Operazioni"), from the status of the slot, the day shown and the
// abilities of the paired user. Mirrors the panel's spotActions
// (web/admin/src/features/operations/lib/actions.ts) for the actions the app
// has; the permission of each comes from features/permissions (core matrix).
// Hidden is a courtesy: the server checks again (403 → "non consentito").
import type { Slots } from '@/api/types';
import type { Abilities } from '@/features/permissions/permissions';
import { addDays, inOfflineWindow, type CalendarDate } from '@/lib/calendar';

import type { DaySpot } from './model';

export interface SpotActions {
  /** Manual check-in (queued offline): today only, a confirmed booking. */
  checkIn: boolean;
  /** Release the pass holder's day (queued offline). */
  releaseDay: boolean;
  /** Block a free spot for the day and slot shown (online only). */
  block: boolean;
  /** Remove the manual block shown (online only). */
  unblock: boolean;
}

export const NO_ACTIONS: SpotActions = {
  checkIn: false,
  releaseDay: false,
  block: false,
  unblock: false,
};

/**
 * Check-in only on the day shown when it is today: the server refuses it
 * outside the stay (422 booking_outside_period). A pass day release goes
 * through the offline queue, so only today and tomorrow (the offline window,
 * as `releasableDays`); blocks are online only and may be planned for any
 * day from today on (ADR 0014). Past days chosen in the calendar are read only.
 */
export function spotActions(
  spot: DaySpot,
  abilities: Pick<Abilities, 'canCheckIn' | 'canReleaseDay' | 'canBlockSpot'>,
  day: { date: CalendarDate; today: CalendarDate; slot: Slots },
): SpotActions {
  const status = spot.serverStatus;
  if (!status) return NO_ACTIONS;
  const b = spot.op?.booking;
  const isToday = day.date === day.today;
  const notPast = day.date >= day.today;
  const window = inOfflineWindow(day.date, { today: day.today, tomorrow: addDays(day.today, 1) });
  return {
    checkIn: abilities.canCheckIn && isToday && status === 'booked' && b?.status === 'confirmed',
    releaseDay:
      abilities.canReleaseDay && window && status === 'pass_holder' && !!b?.is_season_pass,
    block: abilities.canBlockSpot && notPast && status === 'free',
    unblock: abilities.canBlockSpot && notPast && status === 'blocked' && !!spot.op?.block_id,
  };
}

export const hasAnyAction = (a: SpotActions) => a.checkIn || a.releaseDay || a.block || a.unblock;
