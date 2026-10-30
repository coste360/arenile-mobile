// "Disponibilità" at the desk: the free spots of a stay row by row, so that
// the operator sees at a glance "Fila 1: nessuno, Fila 2: 5 liberi" when a
// customer arrives. Availability comes from GET availability (core spec 7.8,
// 30.4: a spot is available when every half day of the stay is free), the
// rows from the map document. Seat zones (spec 5.2) go row by row; zones
// assigned as a whole ("zone") or by quantity are counted per zone. Pure.
import type { AssignmentMode, AvailabilityResult, MapDocument } from '@/api/types';
import { daysBetween, type CalendarDate } from '@/lib/calendar';

export type AvailabilityState = 'free' | 'partly' | 'taken';

export interface AvailabilitySpot {
  spotId: string;
  label: string;
  state: AvailabilityState;
  /** Fully free days of the stay (closed days excluded), for "libero in parte". */
  freeDays: number;
  totalDays: number;
}

export interface AvailabilityRow {
  /** Row label of the map; null for spots without a row ("Senza fila"). */
  row: string | null;
  free: number;
  spots: AvailabilitySpot[];
}

const natural = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

/**
 * Rows of the map with the state of each spot of a seat zone for the stay.
 * Spots the availability does not list in a seat zone (inactive, zone or
 * quantity zones, other maps) are left out. With `attributes`, only the spots
 * that have all of them (case-insensitive); rows left empty disappear. Rows in
 * natural order (1, 2, 10, A, B), spots by number then label, spots without a
 * row last.
 */
export function rowsOf(
  doc: MapDocument,
  availability: AvailabilityResult,
  { attributes = [] }: { attributes?: readonly string[] } = {},
): AvailabilityRow[] {
  const byId = seatSpots(availability);
  const wanted = attributes.map(fold);
  const rows = new Map<string, { spot: MapDocument['spots'][number]; entry: AvailabilitySpot }[]>();
  for (const spot of doc.spots) {
    const a = byId.get(spot.id);
    if (!a || !spot.active) continue;
    if (wanted.length > 0) {
      const has = new Set(spot.attributes.map(fold));
      if (!wanted.every((w) => has.has(w))) continue;
    }
    const totalDays = a.total_days ?? 0;
    const freeDays = a.status === 'available' ? totalDays : (a.free_days ?? 0);
    const state: AvailabilityState =
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

const fold = (s: string) => s.trim().toLocaleLowerCase('it');

/** Spots of the seat zones of the answer, by id. */
const seatSpots = (availability: AvailabilityResult) =>
  new Map(
    availability.zones
      .filter((z) => z.assignment_mode === 'seat')
      .flatMap((z) => z.spots ?? [])
      .map((s) => [s.spot_id, s] as const),
  );

/**
 * The attributes the manager gave the spots `rowsOf` offers (active spots of
 * the map in a seat zone of the answer: "prima fila", "vicino al bar"), as
 * written, once each regardless of case, sorted.
 */
export function attributeOptions(doc: MapDocument, availability: AvailabilityResult): string[] {
  const offered = seatSpots(availability);
  const seen = new Map<string, string>();
  for (const spot of doc.spots) {
    if (!spot.active || !offered.has(spot.id)) continue;
    for (const raw of spot.attributes) {
      const name = raw.trim();
      if (name && !seen.has(fold(name))) seen.set(fold(name), name);
    }
  }
  return [...seen.values()].sort(natural.compare);
}

/** A zone sold as a whole or by quantity (spec 5.2): how many places are free for the stay. */
export interface AvailabilityZone {
  zoneId: string;
  /** Name from the zones list when known, otherwise the zone code. */
  name: string;
  mode: Exclude<AssignmentMode, 'seat'>;
  /** Places of the zone (spots or units). */
  capacity: number;
  /** The fewest free on any day of the stay. */
  available: number;
}

/** What the zones list says of a zone: its name and its map (none for quantity zones). */
export interface ZoneInfo {
  name: string;
  mapId?: string;
}

type ZoneAvailability = AvailabilityResult['zones'][number];

/**
 * Cards of the zones sold as a whole or by quantity among `zones` (the
 * selected map's and the map-less ones), in order. Only zones the zones list
 * knows (`info`): while it is unknown no card is shown. Zones without places
 * are left out.
 */
export function zoneCards(
  zones: readonly ZoneAvailability[],
  info: ReadonlyMap<string, ZoneInfo>,
): AvailabilityZone[] {
  return zones.flatMap((z) => {
    const known = info.get(z.zone_id);
    if (z.assignment_mode === 'seat' || !known || z.capacity <= 0) return [];
    return [
      {
        zoneId: z.zone_id,
        name: known.name || z.code,
        mode: z.assignment_mode,
        capacity: z.capacity,
        available: Math.max(0, Math.min(z.available, z.capacity)),
      },
    ];
  });
}

/** Free places of the zone cards together. */
export const freePlaces = (cards: readonly AvailabilityZone[]) =>
  cards.reduce((n, c) => n + c.available, 0);

/** Free spots of every row together. */
export const freeCount = (rows: readonly AvailabilityRow[]) => rows.reduce((n, r) => n + r.free, 0);

/** Only the rows with at least one free spot, when asked. */
export const visibleRows = (rows: readonly AvailabilityRow[], onlyFree: boolean) =>
  onlyFree ? rows.filter((r) => r.free > 0) : [...rows];

/** True when the establishment is closed on every day of the stay: nothing to book. */
export function wholeStayClosed(availability: AvailabilityResult): boolean {
  const { from, to } = availability;
  const closed = new Set((availability.closed_dates ?? []).filter((d) => d >= from && d <= to));
  return closed.size > 0 && closed.size >= stayDays(from, to);
}

const stayDays = (from: CalendarDate, to: CalendarDate) => daysBetween(from, to) + 1;

/** Longest stay GET availability answers (the core refuses 200 days or more: MaxAvailabilityDays). */
export const MAX_AVAILABILITY_DAYS = 199;

/** True when the core answers the availability of this stay. */
export const askableStay = (from: CalendarDate, to: CalendarDate) =>
  to >= from && stayDays(from, to) <= MAX_AVAILABILITY_DAYS;
