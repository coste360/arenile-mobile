// Spot figures of "Oggi" from the operational day (core spec 11.3): free
// spots and the season pass days released by their holders. Pure, so the
// figure and the list it opens agree.
import type { OperationalSpot, OperationsDay } from '@/api/types';

/** Which spots of the day a list shows. */
export type SpotFilter = 'free' | 'released';
export const SPOT_FILTERS: readonly SpotFilter[] = ['free', 'released'];

export function isSpotFilter(v: unknown): v is SpotFilter {
  return typeof v === 'string' && (SPOT_FILTERS as readonly string[]).includes(v);
}

/** A pass holder released at least one half of the day (morning, afternoon or both). */
export function isReleased(s: OperationalSpot): boolean {
  return s.status === 'released' || s.am_status === 'released' || s.pm_status === 'released';
}

/**
 * Sellable for the day: free, or released by its pass holder. Same rule as
 * the core's `totals.free` (a spot is counted once, by its combined status).
 */
export function isFree(s: OperationalSpot): boolean {
  return s.status === 'free' || s.status === 'released';
}

const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

/** The spots of `filter`, by label in natural order ("A2" before "A10"). */
export function spotsOf(day: OperationsDay, filter: SpotFilter): OperationalSpot[] {
  const keep = filter === 'free' ? isFree : isReleased;
  return day.spots.filter(keep).sort((a, b) => collator.compare(a.label, b.label));
}

export interface DaySpotFigures {
  free: number;
  released: number;
  total: number;
}

export function daySpotFigures(day: OperationsDay): DaySpotFigures {
  let free = 0;
  let released = 0;
  for (const s of day.spots) {
    if (isFree(s)) free++;
    if (isReleased(s)) released++;
  }
  return { free, released, total: day.totals.spots };
}

/** Which half of the day a released spot is free for. */
export function releasedHalf(s: OperationalSpot): 'FULL' | 'AM' | 'PM' {
  if (s.status === 'released') return 'FULL';
  if (s.am_status === 'released' && s.pm_status === 'released') return 'FULL';
  return s.am_status === 'released' ? 'AM' : 'PM';
}
