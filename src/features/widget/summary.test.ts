import { createI18n } from '@/i18n';
import { operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';

import { WIDGET_COLORS } from './colors';
import { daySummaryOf, nextMidnight, widgetEntries, type WidgetSource } from './summary';

const t = createI18n('it').t;
// 09:30 in Rome on Sunday 25 October 2026 (winter time since 01:00 UTC).
const NOW = new Date('2026-10-25T08:30:00Z');
const ctx = { now: NOW, locale: 'it', t };

const paired = (overrides: Partial<Extract<WidgetSource, { status: 'paired' }>> = {}) =>
  ({
    status: 'paired',
    establishmentName: 'Lido Azzurro',
    timeZone: 'Europe/Rome',
    today: '2026-10-25',
    ...overrides,
  }) satisfies WidgetSource;

describe('daySummaryOf', () => {
  it('takes the totals and counts each booking with a balance once', () => {
    const due = operationalBooking({ booking_id: 'b-1', balance_due: 2000 });
    const day = operationsDay({
      spots: [
        spot({ spot_id: 's-1', booking: due }),
        // The same booking on a second umbrella counts once.
        spot({ spot_id: 's-2', booking: due }),
        spot({
          spot_id: 's-3',
          booking: operationalBooking({ booking_id: 'b-2', balance_due: 0 }),
        }),
        spot({
          spot_id: 's-4',
          booking: operationalBooking({
            booking_id: 'b-3',
            balance_due: 500,
            status: 'checked_in',
          }),
        }),
        spot({
          spot_id: 's-5',
          booking: operationalBooking({ booking_id: 'b-4', balance_due: 500, status: 'cancelled' }),
        }),
        spot({ spot_id: 's-6', status: 'free' }),
      ],
      totals: {
        spots: 6,
        free: 1,
        occupied: 5,
        arrivals: 12,
        departures: 2,
        checked_in: 7,
        balance_due_amount: 2500,
        pending_assignments: 0,
      },
    });
    expect(daySummaryOf(day)).toEqual({
      date: '2026-10-25',
      closed: false,
      arrivals: 12,
      toSettle: 2,
      checkedIn: 7,
      free: 1,
    });
  });
});

describe('nextMidnight', () => {
  it.each([
    ['Rome, winter time', 'Europe/Rome', '2026-10-25T08:30:00Z', '2026-10-25T23:00:00.000Z'],
    ['Rome, summer time', 'Europe/Rome', '2026-07-01T12:00:00Z', '2026-07-01T22:00:00.000Z'],
    // The night of the change to winter time is 25 hours long.
    [
      'Rome, before the DST change',
      'Europe/Rome',
      '2026-10-24T20:00:00Z',
      '2026-10-24T22:00:00.000Z',
    ],
    ['UTC when the zone is unknown', undefined, '2026-10-25T08:30:00Z', '2026-10-26T00:00:00.000Z'],
    ['just before midnight', 'Europe/Rome', '2026-10-25T22:59:30Z', '2026-10-25T23:00:00.000Z'],
  ])('%s', (_name, zone, now, expected) => {
    expect(nextMidnight(zone, new Date(now)).toISOString()).toBe(expected);
  });
});

describe('widgetEntries', () => {
  it("summarises today's cached day and expires it at the establishment's midnight", () => {
    const day = operationsDay({
      totals: {
        spots: 40,
        free: 9,
        occupied: 31,
        arrivals: 12,
        departures: 0,
        checked_in: 1,
        balance_due_amount: 2000,
        pending_assignments: 0,
      },
    });
    const entries = widgetEntries(
      paired({ day, updatedAt: Date.parse('2026-10-25T07:12:00Z') }),
      ctx,
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]!.date).toBe(NOW);
    expect(entries[0]!.props).toEqual({
      kind: 'summary',
      title: 'Lido Azzurro',
      subtitle: 'dom 25 ott',
      message: '',
      items: [
        { label: 'arrivi', value: '12' },
        { label: 'da saldare', value: '1' },
        { label: 'presente', value: '1' },
        { label: 'libere', value: '9' },
      ],
      footer: 'Aggiornato alle 08:12',
      accessibilityLabel:
        'Lido Azzurro. dom 25 ott. 12 arrivi, 1 da saldare, 1 presente, 9 libere. Aggiornato alle 08:12',
      colors: WIDGET_COLORS,
    });
    expect(entries[1]!.date.toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(entries[1]!.props).toMatchObject({
      kind: 'message',
      items: [],
      message: 'Dati di dom 25 ott: apri Arenile per aggiornare il riepilogo.',
    });
  });

  it('never carries names, codes or amounts', () => {
    const [entry] = widgetEntries(paired({ day: operationsDay(), updatedAt: NOW.getTime() }), ctx);
    const text = JSON.stringify(entry!.props);
    expect(text).not.toMatch(/Rossi|AR-7K3Q9|20,00|2000/);
  });

  it.each([
    ['not paired', { status: 'unpaired' } as const, 'Arenile', /Collega questo dispositivo/],
    ['a role without the day', paired({ restricted: true }), 'Lido Azzurro', /ruolo/],
    ['no cached day', paired(), 'Lido Azzurro', /Nessun dato di oggi/],
    [
      "yesterday's day only",
      paired({ day: operationsDay({ date: '2026-10-24' }) }),
      'Lido Azzurro',
      /Nessun dato di oggi/,
    ],
  ])('explains instead of counting: %s', (_name, source, title, text) => {
    const entries = widgetEntries(source, ctx);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.props).toMatchObject({ kind: 'message', title, items: [], footer: '' });
    expect(entries[0]!.props.message).toMatch(text);
  });

  it('says when the establishment is closed today', () => {
    const entries = widgetEntries(paired({ day: operationsDay({ closed: true }) }), ctx);
    expect(entries[0]!.props).toMatchObject({
      kind: 'message',
      subtitle: 'dom 25 ott',
      message: 'Stabilimento chiuso oggi.',
    });
    expect(entries[1]!.props.kind).toBe('message');
  });

  it('falls back to the app name without an establishment name', () => {
    const [entry] = widgetEntries(paired({ establishmentName: '' }), ctx);
    expect(entry!.props.title).toBe('Arenile');
  });

  it('follows the language', () => {
    const [entry] = widgetEntries(paired({ day: operationsDay(), updatedAt: NOW.getTime() }), {
      now: NOW,
      locale: 'en',
      t: createI18n('en').t,
    });
    expect(entry!.props.items.map((i) => i.label)).toEqual([
      'arrival',
      'to settle',
      'checked in',
      'free',
    ]);
    expect(entry!.props.subtitle).toBe('Sun, Oct 25');
  });
});
