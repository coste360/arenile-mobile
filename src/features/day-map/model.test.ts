import { mapDocument, mapSpot } from '@/test/map-fixtures';
import { operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';

import {
  buildDaySpots,
  compareLabels,
  countByStatus,
  localized,
  mapName,
  normalize,
  occupantFullName,
  occupantShortLabel,
  searchSpots,
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
