// Lifeguard list (core spec 30.10): the occupied spots of a day, row by
// row, with the occupant's last name, the setup, arrival/departure and
// balance due; never emails or phones. Read only: the core builds it from
// the operations day, in map order.
import type { LifeguardRow, OperationalSpot } from '@/api/types';

export const LIFEGUARD_FILTERS = ['all', 'arriving', 'departing', 'balance_due'] as const;
export type LifeguardFilter = (typeof LIFEGUARD_FILTERS)[number];

const MATCH: Record<LifeguardFilter, (r: LifeguardRow) => boolean> = {
  all: () => true,
  arriving: (r) => r.arriving,
  departing: (r) => r.departing,
  balance_due: (r) => r.balance_due,
};

export function filterLifeguardRows(
  rows: readonly LifeguardRow[],
  filter: LifeguardFilter,
): LifeguardRow[] {
  return rows.filter(MATCH[filter]);
}

export function lifeguardCounts(rows: readonly LifeguardRow[]): Record<LifeguardFilter, number> {
  return {
    all: rows.length,
    arriving: rows.filter(MATCH.arriving).length,
    departing: rows.filter(MATCH.departing).length,
    balance_due: rows.filter(MATCH.balance_due).length,
  };
}

export interface LifeguardGroup {
  /** Row of the beach ('' for spots outside any row). */
  row: string;
  spots: LifeguardRow[];
}

/**
 * Spots grouped by beach row, rows and spots in the server's map order (a
 * row appears where its first spot does).
 */
export function groupByRow(rows: readonly LifeguardRow[]): LifeguardGroup[] {
  const groups = new Map<string, LifeguardRow[]>();
  for (const r of rows) {
    const row = r.row_label.trim();
    const list = groups.get(row);
    if (list) list.push(r);
    else groups.set(row, [r]);
  }
  return [...groups].map(([row, spots]) => ({ row, spots }));
}

/**
 * Booking each row opens, from the operations day of the same date. A row
 * has no booking id (core 1.1), so it links only when the spot's booking is
 * surely the one on the row: the whole day is one booking (a split day names
 * one half only) and it carries the same last name.
 */
export function rowBookings(
  rows: readonly LifeguardRow[],
  spots: readonly OperationalSpot[],
): Map<string, string> {
  const bySpot = new Map(spots.map((s) => [s.spot_id, s]));
  const links = new Map<string, string>();
  for (const row of rows) {
    const s = bySpot.get(row.spot_id);
    if (!s?.booking) continue;
    if (s.am_status && s.pm_status && s.am_status !== s.pm_status) continue;
    if (s.booking.occupant_label !== row.occupant_label) continue;
    links.set(row.spot_id, s.booking.booking_id);
  }
  return links;
}
