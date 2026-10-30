// "Trova posto" at the desk: the free spots of a stay row by row, so that
// the operator sees at a glance "Fila 1: nessuno, Fila 2: 5 liberi" when a
// customer arrives. Availability comes from GET availability (core spec 7.8,
// 30.4: a spot is available when every half day of the stay is free), the
// rows from the map document. Pure.
import type { AvailabilityResult, MapDocument } from '@/api/types';

export type FindSpotState = 'free' | 'partly' | 'taken';

export interface FindSpotEntry {
  spotId: string;
  label: string;
  state: FindSpotState;
  /** Fully free days of the stay (closed days excluded), for "libero in parte". */
  freeDays: number;
  totalDays: number;
}

export interface FindSpotRow {
  /** Row label of the map; null for spots without a row ("Senza fila"). */
  row: string | null;
  free: number;
  spots: FindSpotEntry[];
}

const natural = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

/**
 * Rows of the map with the state of each spot for the stay. Spots the
 * availability does not list (inactive, pool zones, other maps) are left
 * out. Rows in natural order (1, 2, 10, A, B), spots by number then label,
 * spots without a row last.
 */
export function rowsOf(doc: MapDocument, availability: AvailabilityResult): FindSpotRow[] {
  const byId = new Map(
    availability.zones.flatMap((z) => z.spots ?? []).map((s) => [s.spot_id, s] as const),
  );
  const rows = new Map<string, { spot: MapDocument['spots'][number]; entry: FindSpotEntry }[]>();
  for (const spot of doc.spots) {
    const a = byId.get(spot.id);
    if (!a || !spot.active) continue;
    const totalDays = a.total_days ?? 0;
    const freeDays = a.status === 'available' ? totalDays : (a.free_days ?? 0);
    const state: FindSpotState =
      a.status === 'available' ? 'free' : freeDays > 0 ? 'partly' : 'taken';
    const key = spot.row_label.trim();
    const list = rows.get(key) ?? [];
    list.push({
      spot,
      entry: { spotId: spot.id, label: a.label || spot.label, state, freeDays, totalDays },
    });
    rows.set(key, list);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : natural.compare(a, b)))
    .map(([key, list]) => {
      const spots = list
        .sort(
          (x, y) => x.spot.number - y.spot.number || natural.compare(x.entry.label, y.entry.label),
        )
        .map((x) => x.entry);
      return {
        row: key === '' ? null : key,
        free: spots.filter((s) => s.state === 'free').length,
        spots,
      };
    });
}

/** Free spots of every row together. */
export const freeCount = (rows: readonly FindSpotRow[]) => rows.reduce((n, r) => n + r.free, 0);

/** Only the rows with at least one free spot, when asked. */
export const visibleRows = (rows: readonly FindSpotRow[], onlyFree: boolean) =>
  onlyFree ? rows.filter((r) => r.free > 0) : [...rows];
