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
  const simple = SIMPLE_FILTERS.map((kind) => ({
    filter: { kind },
    count: filterSpots(spots, { kind }).length,
  }));
  const agreements = new Map<string, FilterOption>();
  const groups = new Map<string, FilterOption>();
  for (const s of spots) {
    const b = s.op?.booking;
    if (!b || !s.serverStatus || !TAKEN.has(s.serverStatus)) continue;
    // The agreement names the booking's partner too; a partner alone counts by itself.
    const ref = b.agreement ?? b.partner;
    if (ref) bump(agreements, ref.id, ref.name, 'agreement');
    if (b.group_name) bump(groups, b.group_name, b.group_name, 'group');
  }
  return [...simple, ...sortByName(agreements), ...sortByName(groups)];
}

function bump(
  into: Map<string, FilterOption>,
  value: string,
  name: string,
  kind: QuickFilterKind,
): void {
  const prev = into.get(value);
  if (prev) prev.count += 1;
  else into.set(value, { filter: { kind, value }, name, count: 1 });
}

const collator = new Intl.Collator('it', { sensitivity: 'base' });

function sortByName(options: Map<string, FilterOption>): FilterOption[] {
  return [...options.values()].sort((a, b) => collator.compare(a.name ?? '', b.name ?? ''));
}

export function sameFilter(a: QuickFilter | null, b: QuickFilter | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.value === b.value;
}
