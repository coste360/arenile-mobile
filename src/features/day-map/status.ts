// Colour status of a spot on the day map (core spec 11.3), mirrored from the
// panel (web/admin/src/features/operations/lib/status.ts and
// web/shared/src/map/kit/status.ts) so that the app and the panel show the
// same colour, label and glyph for the same spot. Keep the cases in step.
import type {
  OperationalBooking,
  OperationalSpot,
  OperationalSpotStatus,
  Slots,
} from '@/api/types';
import type { CalendarDate } from '@/lib/calendar';

/** Colour status of the panel's map palette (spec 11.3 table). */
export type SpotStatus =
  | 'free'
  | 'booked_online'
  | 'booked_desk'
  | 'season'
  | 'season_released'
  | 'hold'
  | 'to_collect'
  | 'present'
  | 'blocked'
  | 'renewal_hold'
  | 'unavailable';

export const SPOT_STATUSES: readonly SpotStatus[] = [
  'free',
  'booked_online',
  'booked_desk',
  'season',
  'season_released',
  'hold',
  'to_collect',
  'present',
  'blocked',
  'renewal_hold',
  'unavailable',
];

/** Legend order of the operational map: always every status, never only those present. */
export const LEGEND_ORDER: readonly SpotStatus[] = [
  'free',
  'booked_desk',
  'booked_online',
  'to_collect',
  'present',
  'season',
  'season_released',
  'hold',
  'renewal_hold',
  'blocked',
  'unavailable',
];

/** Customer tag that marks a VIP (spec 11.3 overlay indicator). */
export const VIP_TAG = 'vip';

/**
 * Colour status of a spot from the server status of the slot plus the
 * booking summary (same rules as the panel's toSpotStatus):
 *
 *   free → free; held → hold; checked_in → present;
 *   pass_holder → to_collect with an open balance, else season;
 *   released → season_released; renewal_offer → renewal_hold;
 *   blocked → blocked; closed / inactive → unavailable;
 *   booked → to_collect with an open balance, else booked_online
 *   (channel online/api) or booked_desk.
 *
 * "Da incassare" is defined on the money (paid < total), so it wins over the
 * season colour, as on the panel.
 */
export function toSpotStatus(
  status: OperationalSpotStatus,
  booking?: Pick<OperationalBooking, 'channel' | 'balance_due'> | null,
): SpotStatus {
  switch (status) {
    case 'free':
      return 'free';
    case 'held':
      return 'hold';
    case 'checked_in':
      return 'present';
    case 'pass_holder':
      return booking && booking.balance_due > 0 ? 'to_collect' : 'season';
    case 'released':
      return 'season_released';
    case 'renewal_offer':
      return 'renewal_hold';
    case 'blocked':
      return 'blocked';
    case 'closed':
    case 'inactive':
      return 'unavailable';
    case 'booked':
      if (booking && booking.balance_due > 0) return 'to_collect';
      if (!booking) return 'booked_desk';
      return booking.channel === 'desk' ? 'booked_desk' : 'booked_online';
    default:
      return 'unavailable';
  }
}

/** Server status of a spot for the slot shown (AM/PM fall back to the day status). */
export function slotStatus(spot: OperationalSpot, slot: Slots): OperationalSpotStatus {
  if (slot === 'AM') return spot.am_status ?? spot.status;
  if (slot === 'PM') return spot.pm_status ?? spot.status;
  return spot.status;
}

/** True when a new booking could start on this spot for the slot (free or a released pass day). */
export function isBookable(status: OperationalSpotStatus): boolean {
  return status === 'free' || status === 'released';
}

/** Overlay indicators shown in the spot sheet (spec 11.3). */
export type SpotIndicator = 'to_assign' | 'extra' | 'note' | 'vip';

export function indicatorsOf(booking: OperationalBooking | undefined): SpotIndicator[] {
  if (!booking) return [];
  const out: SpotIndicator[] = [];
  if (booking.ticket?.needs_assignment) out.push('to_assign');
  if (booking.has_extras) out.push('extra');
  if (booking.has_notes) out.push('note');
  if (booking.customer_tags.some((tag) => tag.toLowerCase() === VIP_TAG)) out.push('vip');
  return out;
}

/**
 * Days the booking keeps this spot: the segment of a stay split across spots
 * (core 1.1, spec 30.6), otherwise the whole stay.
 */
export function daysOnSpot(
  booking: Pick<
    OperationalBooking,
    'starts_on' | 'ends_on' | 'segment_starts_on' | 'segment_ends_on'
  >,
): { from: CalendarDate; to: CalendarDate } {
  return {
    from: booking.segment_starts_on ?? booking.starts_on,
    to: booking.segment_ends_on ?? booking.ends_on,
  };
}

/** NativeWind classes of a status (legend swatch, sheet badge). Literal for Tailwind's scanner. */
export const STATUS_CLASSES: Readonly<Record<SpotStatus, { bg: string; fg: string }>> = {
  free: { bg: 'bg-status-free', fg: 'text-status-free-foreground' },
  booked_online: { bg: 'bg-status-booked-online', fg: 'text-status-booked-online-foreground' },
  booked_desk: { bg: 'bg-status-booked-desk', fg: 'text-status-booked-desk-foreground' },
  season: { bg: 'bg-status-season', fg: 'text-status-season-foreground' },
  season_released: {
    bg: 'bg-status-season-released',
    fg: 'text-status-season-released-foreground',
  },
  hold: { bg: 'bg-status-hold', fg: 'text-status-hold-foreground' },
  to_collect: { bg: 'bg-status-to-collect', fg: 'text-status-to-collect-foreground' },
  present: { bg: 'bg-status-present', fg: 'text-status-present-foreground' },
  blocked: { bg: 'bg-status-blocked', fg: 'text-status-blocked-foreground' },
  renewal_hold: { bg: 'bg-status-renewal-hold', fg: 'text-status-renewal-hold-foreground' },
  unavailable: { bg: 'bg-status-unavailable', fg: 'text-status-unavailable-foreground' },
};
