// Occupancy of the day by half-day slot for "Oggi": how many spots are
// occupied, free or not available in the morning and in the afternoon,
// from the cached operational day. The colour status comes from the day
// map's rules (features/day-map/status.ts: slotStatus + toSpotStatus), so
// "Oggi" and the map agree on every spot.
import type { OperationalSpot } from '@/api/types';
import { slotStatus, toSpotStatus, type SpotStatus } from '@/features/day-map/status';

export type HalfDay = 'AM' | 'PM';
export const HALF_DAYS: readonly HalfDay[] = ['AM', 'PM'];

/** What a spot is for a slot: occupied (booked, present, pass, hold), free (sellable) or closed. */
export type SlotUse = 'occupied' | 'free' | 'closed';
export const SLOT_USES: readonly SlotUse[] = ['occupied', 'free', 'closed'];

const USE_OF: Readonly<Record<SpotStatus, SlotUse>> = {
  free: 'free',
  // A pass day released by its holder can be sold: free, as in totals.free.
  season_released: 'free',
  booked_online: 'occupied',
  booked_desk: 'occupied',
  season: 'occupied',
  hold: 'occupied',
  to_collect: 'occupied',
  present: 'occupied',
  renewal_hold: 'occupied',
  blocked: 'closed',
  unavailable: 'closed',
};

export function slotUse(spot: OperationalSpot, half: HalfDay): SlotUse {
  return USE_OF[toSpotStatus(slotStatus(spot, half), spot.booking)];
}

export type SlotCounts = Record<SlotUse, number> & { total: number };

/** Counts per slot; every spot is counted once per slot, so the three uses add up to `total`. */
export function slotOccupancy(spots: readonly OperationalSpot[]): Record<HalfDay, SlotCounts> {
  const empty = (): SlotCounts => ({ occupied: 0, free: 0, closed: 0, total: spots.length });
  const out: Record<HalfDay, SlotCounts> = { AM: empty(), PM: empty() };
  for (const spot of spots) {
    for (const half of HALF_DAYS) out[half][slotUse(spot, half)]++;
  }
  return out;
}

export interface SlotSegment {
  use: SlotUse;
  /** Start and width in spots (the bar is `total` spots wide). */
  x: number;
  width: number;
}

/** Segments of the stacked bar of a slot, in SLOT_USES order; empty uses are left out. */
export function slotSegments(counts: SlotCounts): SlotSegment[] {
  const out: SlotSegment[] = [];
  let x = 0;
  for (const use of SLOT_USES) {
    if (counts[use] > 0) out.push({ use, x, width: counts[use] });
    x += counts[use];
  }
  return out;
}
