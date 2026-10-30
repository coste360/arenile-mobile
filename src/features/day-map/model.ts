// The day map's view model: the geometry of a map document joined with the
// operational day (status per spot for the slot shown), the occupant names
// the role may see, and the search over spot, booking code and customer.
// Pure: the screen memoises it on its inputs.
import type {
  BeachMap,
  MapDocument,
  OperationalBooking,
  OperationalSpot,
  OperationalSpotStatus,
  OperationsDay,
  Slots,
} from '@/api/types';

import type { PlacedShape } from './geometry';
import {
  daysOnSpot,
  markersOf,
  slotStatus,
  toSpotStatus,
  type MapMarker,
  type SpotStatus,
} from './status';

/** Localised text of the contract (I18nText): language → text. */
export type I18nText = Record<string, string>;

/** The text in `locale`, else Italian (the source language), else any; undefined when empty. */
export function localized(text: I18nText | undefined, locale: string): string | undefined {
  if (!text) return undefined;
  const v = text[locale] ?? text.it ?? Object.values(text)[0];
  return v?.trim() ? v : undefined;
}

/** Name of a map in the user's language, or `fallback`. */
export function mapName(map: Pick<BeachMap, 'name'>, locale: string, fallback: string): string {
  return localized(map.name, locale) ?? fallback;
}

/** Booking fields the occupant names are made of. */
type OccupantFields = Pick<
  OperationalBooking,
  'occupant_label' | 'customer_display_name' | 'customer_anonymized'
>;

export interface OccupantTexts {
  /** "Anonimo": short label of an anonymised customer on the map. */
  anonymousShort: string;
  /** "Cliente anonimo": full name of an anonymised customer. */
  anonymous: string;
}

/**
 * Short name drawn on the map (spec 11.3): the server's `occupant_label`
 * (surname, or first name; the pass holder, the group's main customer, the
 * name or number of a daily ticket); "Anonimo" for an anonymised customer;
 * undefined without a name. Never contact details.
 */
export function occupantShortLabel(b: OccupantFields, texts: OccupantTexts): string | undefined {
  if (b.customer_anonymized) return texts.anonymousShort;
  return b.occupant_label.trim() || undefined;
}

/** Full occupant name for the sheet and the accessible name; undefined without a name. */
export function occupantFullName(b: OccupantFields, texts: OccupantTexts): string | undefined {
  if (b.customer_anonymized) return texts.anonymous;
  return b.customer_display_name.trim() || b.occupant_label.trim() || undefined;
}

/**
 * Parts of the caption under a taken spot (spec 30.4, as the panel's label
 * parts): the customer (only with bookings.read), the last day on the spot
 * ("16/8") and the setup ("2L 1S"), joined by " · ". The spot code is always
 * drawn.
 */
export type CaptionPart = 'customer' | 'end' | 'setup';

export const CAPTION_PARTS: readonly CaptionPart[] = ['customer', 'end', 'setup'];

export const DEFAULT_CAPTION_PARTS: readonly CaptionPart[] = ['customer'];

/** Day and month of a calendar date, short ("16/8" in Italian, "8/16" in English). */
export function shortDayMonth(date: string, locale: string): string {
  // The locale's order and separator, without the leading zeros some engines add.
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', timeZone: 'UTC' })
    .formatToParts(new Date(`${date}T00:00:00Z`))
    .map((p) => (p.type === 'day' || p.type === 'month' ? String(Number(p.value)) : p.value))
    .join('');
}

/** Server statuses of a spot that is taken for the slot (captioned with the occupant). */
export const TAKEN: ReadonlySet<OperationalSpotStatus> = new Set([
  'booked',
  'checked_in',
  'pass_holder',
  'held',
  'renewal_offer',
]);

export interface DaySpot extends PlacedShape {
  id: string;
  label: string;
  kind: string;
  /** Kit illustration chosen in the panel; absent = the default of the kind. */
  asset?: string;
  /** Server status for the slot; undefined while the day is not known. */
  serverStatus?: OperationalSpotStatus;
  /** Colour status; null while the day is not known (drawn neutral, no glyph). */
  status: SpotStatus | null;
  /** The operational entry of the spot (booking summary, hold, block). */
  op?: OperationalSpot;
  /** Occupant short label for the map caption, when the role may see customers. */
  caption?: string;
  /** Full occupant name for the accessible name and the sheet, same rule. */
  occupant?: string;
  /** Arrival and departure markers drawn on the map (taken spots only). */
  markers: MapMarker[];
  /** Normalised text the search looks into. */
  haystack: string[];
}

export interface DaySpotsInput {
  document: MapDocument;
  day: OperationsDay | undefined;
  slot: Slots;
  /** bookings.read (spec 16.1): customer names on the map, in the sheet and in the search. */
  canSeeCustomers: boolean;
  texts: OccupantTexts;
  /** Caption parts chosen by the user; the customer alone when absent. */
  captionParts?: readonly CaptionPart[];
  /** Locale of the end date in the caption. */
  locale?: string;
}

/** Spots of one map with their status for the slot, in document order. */
export function buildDaySpots({
  document,
  day,
  slot,
  canSeeCustomers,
  texts,
  captionParts = DEFAULT_CAPTION_PARTS,
  locale = 'it',
}: DaySpotsInput): DaySpot[] {
  const byId = new Map<string, OperationalSpot>();
  for (const s of day?.spots ?? []) if (s.map_id === document.map.id) byId.set(s.spot_id, s);
  return document.spots.map((spot) => {
    const op = byId.get(spot.id);
    // A spot the day does not list is inactive for it (or the day is still loading).
    const serverStatus: OperationalSpotStatus | undefined = op
      ? slotStatus(op, slot)
      : day
        ? 'inactive'
        : undefined;
    const b = op?.booking;
    const taken = !!b && !!serverStatus && TAKEN.has(serverStatus);
    const haystack = [spot.label, b?.code, b?.ticket?.label];
    if (canSeeCustomers && b && !b.customer_anonymized) haystack.push(b.customer_display_name);
    return {
      id: spot.id,
      label: spot.label,
      kind: spot.kind,
      asset: spot.asset,
      x: spot.x,
      y: spot.y,
      rotation: spot.rotation,
      shape: spot.shape,
      serverStatus,
      status: serverStatus ? toSpotStatus(serverStatus, b) : null,
      op,
      caption:
        taken && b
          ? captionOf(b, { parts: captionParts, canSeeCustomers, texts, locale })
          : undefined,
      occupant: canSeeCustomers && b ? occupantFullName(b, texts) : undefined,
      markers: taken ? markersOf(b) : [],
      haystack: haystack.filter((v): v is string => !!v).map(normalize),
    };
  });
}

/**
 * Caption of a taken spot from the chosen parts, in their canonical order;
 * undefined when no part has a value (the code stays). Never contact data.
 */
export function captionOf(
  b: OccupantFields &
    Pick<
      OperationalBooking,
      'starts_on' | 'ends_on' | 'segment_starts_on' | 'segment_ends_on' | 'setup_label'
    >,
  {
    parts,
    canSeeCustomers,
    texts,
    locale,
  }: {
    parts: readonly CaptionPart[];
    canSeeCustomers: boolean;
    texts: OccupantTexts;
    locale: string;
  },
): string | undefined {
  const text: string[] = [];
  for (const p of CAPTION_PARTS) {
    if (!parts.includes(p)) continue;
    if (p === 'customer') {
      const name = canSeeCustomers ? occupantShortLabel(b, texts) : undefined;
      if (name) text.push(name);
    } else if (p === 'end') {
      text.push(shortDayMonth(daysOnSpot(b).to, locale));
    } else if (b.setup_label?.trim()) {
      text.push(b.setup_label.trim());
    }
  }
  return text.length > 0 ? text.join(' · ') : undefined;
}

/** Case and accent insensitive form for the search ("Niccolò" → "niccolo"). */
export function normalize(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Spots whose label, booking code, ticket or customer name (only when the
 * role may see customers) contain `query`; empty query → none. Ordered by
 * label, numbers in natural order (A2 before A10). Phone numbers are not in
 * the operational payload: no personal contact data on the map.
 */
export function searchSpots(spots: readonly DaySpot[], query: string): DaySpot[] {
  const q = normalize(query.trim());
  if (q.length === 0) return [];
  return spots
    .filter((s) => s.haystack.some((h) => h.includes(q)))
    .sort((a, b) => compareLabels(a.label, b.label));
}

const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

export function compareLabels(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Arrival and departure markers drawn on the map (legend counters). */
export function countMarkers(spots: readonly DaySpot[]): Partial<Record<MapMarker, number>> {
  const out: Partial<Record<MapMarker, number>> = {};
  for (const s of spots) for (const m of s.markers) out[m] = (out[m] ?? 0) + 1;
  return out;
}

/** Counts per colour status (legend counters, accessible summary). */
export function countByStatus(spots: readonly DaySpot[]): Partial<Record<SpotStatus, number>> {
  const out: Partial<Record<SpotStatus, number>> = {};
  for (const s of spots) if (s.status) out[s.status] = (out[s.status] ?? 0) + 1;
  return out;
}
