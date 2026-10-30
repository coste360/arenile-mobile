// Quick filters of the day map (spec 30.4), mirrored from the panel
// (web/admin/src/features/operations/lib/quickFilters.ts): they highlight
// the spots of today's arrivals, departures, open balances, guests present,
// one agreement (or partner) or one group; the other spots are dimmed. With
// a search as well, the map highlights the spots matching both.
import type { DaySpot } from './model';
import { TAKEN } from './model';

export type QuickFilterKind =
  'arrivals' | 'departures' | 'to_collect' | 'present' | 'agreement' | 'group';

export const SIMPLE_FILTERS: readonly QuickFilterKind[] = [
  'arrivals',
  'departures',
  'to_collect',
  'present',
];

export interface QuickFilter {
  kind: QuickFilterKind;
  /** Agreement (or partner) id, group name. */
  value?: string;
}

/** True when the spot's booking matches `filter` for the slot shown (taken spots only). */
export function matchesFilter(spot: DaySpot, filter: QuickFilter): boolean {
  const b = spot.op?.booking;
  const st = spot.serverStatus;
  if (!b || !st || !TAKEN.has(st)) return false;
  switch (filter.kind) {
    case 'arrivals':
      return !!b.is_first_day;
    case 'departures':
      return !!b.is_last_day;
    case 'to_collect':
      return b.balance_due > 0;
    case 'present':
      return st === 'checked_in';
    case 'agreement':
      return !!filter.value && (b.agreement?.id === filter.value || b.partner?.id === filter.value);
    case 'group':
      return !!filter.value && b.group_name === filter.value;
  }
}

/** Spots matching `filter`, in the order given. */
export function filterSpots(spots: readonly DaySpot[], filter: QuickFilter): DaySpot[] {
  return spots.filter((s) => matchesFilter(s, filter));
}

export interface FilterOption {
  filter: QuickFilter;
  /** Agreement, partner or group name; undefined for the simple filters (translated). */
  name?: string;
  count: number;
}

/**
 * Every filter worth offering for the spots shown: the simple ones (always,
 * with their count), then each agreement or partner and each group present,
 * by name.
 */
export function filterOptions(spots: readonly DaySpot[]): FilterOption[] {
  const agreements = new Map<string, string>();
  const groups = new Map<string, string>();
  for (const s of spots) {
    const b = s.op?.booking;
    if (!b || !s.serverStatus || !TAKEN.has(s.serverStatus)) continue;
    // The agreement names the booking's partner too; a partner alone is offered by itself.
    const ref = b.agreement ?? b.partner;
    if (ref && !agreements.has(ref.id)) agreements.set(ref.id, ref.name);
    if (b.group_name) groups.set(b.group_name, b.group_name);
  }
  // Every count is what the chip highlights (a partner also matches its agreements' bookings).
  const option = (filter: QuickFilter, name?: string): FilterOption => ({
    filter,
    name,
    count: filterSpots(spots, filter).length,
  });
  return [
    ...SIMPLE_FILTERS.map((kind) => option({ kind })),
    ...sortByName(agreements).map(([value, name]) => option({ kind: 'agreement', value }, name)),
    ...sortByName(groups).map(([value, name]) => option({ kind: 'group', value }, name)),
  ];
}

const collator = new Intl.Collator('it', { sensitivity: 'base' });

function sortByName(names: Map<string, string>): [string, string][] {
  return [...names].sort((a, b) => collator.compare(a[1], b[1]));
}

export function sameFilter(a: QuickFilter | null, b: QuickFilter | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.value === b.value;
}
