import { mapDocument, mapSpot } from '@/test/map-fixtures';
import { operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';

import {
  buildDaySpots,
  captionOf,
  compareLabels,
  countByStatus,
  countMarkers,
  localized,
  mapName,
  normalize,
  occupantFullName,
  occupantShortLabel,
  searchSpots,
  type CaptionPart,
  type DaySpotsInput,
} from './model';

const texts = { anonymousShort: 'Anonimo', anonymous: 'Cliente anonimo' };

const day = operationsDay({
  spots: [
    spot({ spot_id: 's-1', label: 'A1', status: 'free' }),
    spot({
      spot_id: 's-2',
      label: 'A2',
      status: 'booked',
      am_status: 'booked',
      pm_status: 'free',
      booking: operationalBooking({
        code: 'AR-7K3Q9',
        customer_display_name: 'Niccolò Bianchi',
        occupant_label: 'Bianchi',
        slots: 'AM',
      }),
    }),
    spot({
      spot_id: 's-3',
      label: 'B1',
      status: 'released',
      booking: operationalBooking({
        booking_id: 'b-3',
        code: 'AR-PASS1',
        is_season_pass: true,
        customer_display_name: 'Verdi Anna',
        occupant_label: 'Verdi',
      }),
    }),
    // Another map of the establishment: ignored.
    spot({ spot_id: 's-9', map_id: 'm-2', label: 'Z9', status: 'blocked' }),
  ],
});

const input = (overrides: Partial<DaySpotsInput> = {}): DaySpotsInput => ({
  document: mapDocument(),
  day,
  slot: 'FULL',
  canSeeCustomers: true,
  texts,
  ...overrides,
});

describe('buildDaySpots', () => {
  it('joins the geometry with the status of the slot, in document order', () => {
    const spots = buildDaySpots(input());
    expect(spots.map((s) => [s.label, s.serverStatus, s.status])).toEqual([
      ['A1', 'free', 'free'],
      ['A2', 'booked', 'to_collect'],
      ['B1', 'released', 'season_released'],
    ]);
    expect(spots[0]).toMatchObject({ x: 100, y: 100, rotation: 0, shape: { type: 'circle' } });
  });

  it('follows the half-day statuses', () => {
    const spots = buildDaySpots(input({ slot: 'PM' }));
    expect(spots[1]).toMatchObject({ serverStatus: 'free', status: 'free', caption: undefined });
  });

  it('captions only the spots taken for the slot', () => {
    const spots = buildDaySpots(input());
    expect(spots.map((s) => s.caption)).toEqual([undefined, 'Bianchi', undefined]);
    // The released pass day keeps the full name for the sheet, without a caption.
    expect(spots[2]?.occupant).toBe('Verdi Anna');
  });

  it('shows no customer to a role without bookings.read, and does not search names', () => {
    const spots = buildDaySpots(input({ canSeeCustomers: false }));
    expect(spots.map((s) => s.caption ?? s.occupant)).toEqual([undefined, undefined, undefined]);
    expect(searchSpots(spots, 'bianchi')).toEqual([]);
    expect(searchSpots(spots, '7k3').map((s) => s.label)).toEqual(['A2']);
  });

  it('draws the spots neutral while the day is not known, inactive when the day omits them', () => {
    expect(buildDaySpots(input({ day: undefined })).map((s) => s.status)).toEqual([
      null,
      null,
      null,
    ]);
    const extra = mapDocument({
      spots: [...mapDocument().spots, mapSpot({ id: 's-new', label: 'C1' })],
    });
    const spots = buildDaySpots(input({ document: extra }));
    expect(spots[3]).toMatchObject({ serverStatus: 'inactive', status: 'unavailable' });
  });

  it('anonymised customers read "Anonimo" and are not searchable by the stored name', () => {
    const anon = operationsDay({
      spots: [
        spot({
          spot_id: 's-1',
          status: 'checked_in',
          booking: operationalBooking({
            customer_anonymized: true,
            customer_display_name: 'Anonimizzato',
            occupant_label: '',
          }),
        }),
      ],
    });
    const [first] = buildDaySpots(input({ day: anon }));
    expect(first).toMatchObject({ caption: 'Anonimo', occupant: 'Cliente anonimo' });
    expect(searchSpots(buildDaySpots(input({ day: anon })), 'anonimizzato')).toEqual([]);
  });

  it('counts the spots per status', () => {
    expect(countByStatus(buildDaySpots(input()))).toEqual({
      free: 1,
      to_collect: 1,
      season_released: 1,
    });
  });
});

describe('searchSpots', () => {
  const spots = buildDaySpots(input());

  it.each([
    ['', []],
    ['   ', []],
    ['a2', ['A2']],
    ['7k3', ['A2']],
    ['niccolo', ['A2']],
    ['BIANCHI', ['A2']],
    // B1 by its pass code AR-PASS1.
    ['a', ['A1', 'A2', 'B1']],
    ['zzz', []],
  ])('%j → %j', (q, expected) => {
    expect(searchSpots(spots, q).map((s) => s.label)).toEqual(expected);
  });

  it('orders labels naturally', () => {
    expect(['A10', 'A2', 'b1', 'A1'].sort(compareLabels)).toEqual(['A1', 'A2', 'A10', 'b1']);
  });
});

describe('texts', () => {
  it('picks the language, then Italian, then any', () => {
    expect(localized({ it: 'Spiaggia', en: 'Beach' }, 'en')).toBe('Beach');
    expect(localized({ it: 'Spiaggia' }, 'de')).toBe('Spiaggia');
    expect(localized({ fr: 'Plage' }, 'de')).toBe('Plage');
    expect(localized({ it: '  ' }, 'it')).toBeUndefined();
    expect(localized(undefined, 'it')).toBeUndefined();
    expect(mapName({ name: {} }, 'it', 'Mappa')).toBe('Mappa');
  });

  it('normalises accents and case', () => {
    expect(normalize('Niccolò ÈÀ')).toBe('niccolo ea');
  });

  it('occupant names: server label, display name, anonymised, missing', () => {
    const b = operationalBooking({ occupant_label: 'Rossi', customer_display_name: 'Rossi M.' });
    expect(occupantShortLabel(b, texts)).toBe('Rossi');
    expect(occupantFullName(b, texts)).toBe('Rossi M.');
    const none = operationalBooking({ occupant_label: ' ', customer_display_name: '' });
    expect(occupantShortLabel(none, texts)).toBeUndefined();
    expect(occupantFullName(none, texts)).toBeUndefined();
  });
});

describe('captionOf (spec 30.4 label parts)', () => {
  const b = operationalBooking({
    occupant_label: 'Rossi',
    starts_on: '2026-08-01',
    ends_on: '2026-08-16',
    setup_label: '2L 1S',
  });
  const opts = (
    parts: CaptionPart[],
    extra: { canSeeCustomers?: boolean; locale?: string } = {},
  ) => ({
    parts,
    canSeeCustomers: extra.canSeeCustomers ?? true,
    texts,
    locale: extra.locale ?? 'it',
  });

  it.each<[string, CaptionPart[], string | undefined]>([
    ['customer (default)', ['customer'], 'Rossi'],
    ['end of stay', ['end'], '16/8'],
    ['setup', ['setup'], '2L 1S'],
    ['every part, in canonical order', ['setup', 'end', 'customer'], 'Rossi · 16/8 · 2L 1S'],
    ['none: only the code stays', [], undefined],
  ])('%s', (_name, parts, want) => {
    expect(captionOf(b, opts(parts))).toBe(want);
  });

  it('ends on the last day on this spot for a split stay', () => {
    expect(captionOf({ ...b, segment_ends_on: '2026-08-08' }, opts(['end']))).toBe('8/8');
  });

  it('writes the date in the user language', () => {
    expect(captionOf(b, opts(['end'], { locale: 'en' }))).toBe('8/16');
  });

  it('never names the customer to a role without bookings.read, but keeps the other parts', () => {
    expect(captionOf(b, opts(['customer', 'setup'], { canSeeCustomers: false }))).toBe('2L 1S');
    expect(captionOf(b, opts(['customer'], { canSeeCustomers: false }))).toBeUndefined();
  });

  it('skips a missing or blank setup', () => {
    expect(captionOf({ ...b, setup_label: ' ' }, opts(['setup']))).toBeUndefined();
    expect(captionOf({ ...b, setup_label: undefined }, opts(['customer', 'setup']))).toBe('Rossi');
  });

  it('applies the parts to the spots taken for the slot only', () => {
    const spots = buildDaySpots(input({ captionParts: ['customer', 'end'] }));
    expect(spots.map((s) => s.caption)).toEqual([undefined, 'Bianchi · 25/10', undefined]);
  });
});

describe('markers on the map', () => {
  const marked = operationsDay({
    spots: [
      spot({
        spot_id: 's-1',
        label: 'A1',
        status: 'booked',
        booking: operationalBooking({ is_first_day: true }),
      }),
      spot({
        spot_id: 's-2',
        label: 'A2',
        status: 'booked',
        booking: operationalBooking({ is_first_day: true, is_last_day: true }),
      }),
      // A released pass day keeps its booking but the spot is not taken: no marker.
      spot({
        spot_id: 's-3',
        label: 'B1',
        status: 'released',
        booking: operationalBooking({ is_last_day: true }),
      }),
    ],
  });

  it('marks arrivals and departures of the taken spots and counts them', () => {
    const spots = buildDaySpots(input({ day: marked }));
    expect(spots.map((s) => s.markers)).toEqual([['arrival'], ['arrival', 'departure'], []]);
    expect(countMarkers(spots)).toEqual({ arrival: 2, departure: 1 });
  });
});
