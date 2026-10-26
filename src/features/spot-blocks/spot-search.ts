import type { OperationalSpot } from '@/api/types';

/** Rows listed at once: enough for a row of the beach, short enough to scroll. */
export const SPOT_RESULTS_MAX = 30;

const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

/**
 * Spots whose label starts with the query (case-insensitive), then those
 * containing it, in natural order (A2 before A10); inactive spots left out.
 */
export function matchSpots(
  spots: readonly OperationalSpot[],
  query: string,
  max: number = SPOT_RESULTS_MAX,
): { spots: OperationalSpot[]; more: boolean } {
  const q = query.trim().toUpperCase();
  const active = spots.filter((s) => s.status !== 'inactive');
  const starts: OperationalSpot[] = [];
  const contains: OperationalSpot[] = [];
  for (const s of active) {
    const label = s.label.toUpperCase();
    if (!q || label.startsWith(q)) starts.push(s);
    else if (label.includes(q)) contains.push(s);
  }
  const byLabel = (a: OperationalSpot, b: OperationalSpot) => collator.compare(a.label, b.label);
  const all = [...starts.sort(byLabel), ...contains.sort(byLabel)];
  return { spots: all.slice(0, max), more: all.length > max };
}
