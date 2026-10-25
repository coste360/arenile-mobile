import { NetworkError, ProblemError } from '@/api/errors';
import type { Ticket } from '@/api/types';
import { refFromSummary, type BookingRef } from '@/features/booking-actions/booking-ref';
import { bookingSummary } from '@/test/operations-fixtures';

import { resolveCode, type ResolveDeps } from './resolve';
import type { ScannedCode } from './scan-code';

const TOKEN = 'MFRGGZDFMZTWQ2LKNNWG23TPOA';
const BOOKING: BookingRef = refFromSummary(bookingSummary());

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't-1',
    kind: 'entry',
    booking_id: 'b-9',
    booking_code: 'AR-ENTRY1',
    number_label: '#037',
    ticket_number: 37,
    ...overrides,
  } as Ticket;
}

function deps(overrides: Partial<ResolveDeps> = {}): ResolveDeps {
  return {
    online: true,
    findCached: jest.fn(() => undefined),
    searchBooking: jest.fn(async () => undefined),
    ticketByCode: jest.fn(async () => undefined),
    bookingById: jest.fn(async () => undefined),
    ...overrides,
  };
}

const offlineError = () => Promise.reject(new NetworkError('unreachable'));
const booking = (code: string): ScannedCode => ({ kind: 'booking', code });
const scanned = { manual: false };
const typed = { manual: true };

describe('resolveCode: booking QR', () => {
  it('answers from the cached day without calling the instance', async () => {
    const d = deps({ findCached: jest.fn(() => BOOKING) });
    await expect(resolveCode(booking('AR-7K3Q9'), d, scanned)).resolves.toEqual({
      type: 'booking',
      booking: BOOKING,
    });
    expect(d.searchBooking).not.toHaveBeenCalled();
    expect(d.ticketByCode).not.toHaveBeenCalled();
  });

  it('works offline from the cache', async () => {
    const d = deps({ online: false, findCached: jest.fn(() => BOOKING) });
    await expect(resolveCode(booking('AR-7K3Q9'), d, scanned)).resolves.toMatchObject({
      type: 'booking',
    });
  });

  it('asks the instance when the cache does not have it', async () => {
    const d = deps({ searchBooking: jest.fn(async () => BOOKING) });
    await expect(resolveCode(booking('AR-7K3Q9'), d, scanned)).resolves.toMatchObject({
      type: 'booking',
    });
    expect(d.searchBooking).toHaveBeenCalledWith('AR-7K3Q9');
  });

  it.each([
    ['offline', deps({ online: false })],
    ['unreachable', deps({ searchBooking: jest.fn(offlineError) })],
  ])('needs the connection when %s and not cached', async (_, d) => {
    await expect(resolveCode(booking('AR-7K3Q9'), d, scanned)).resolves.toEqual({
      type: 'needs_connection',
    });
  });

  it('reports an unknown code', async () => {
    await expect(resolveCode(booking('AR-NOPE'), deps(), scanned)).resolves.toEqual({
      type: 'not_found',
    });
  });

  it('throws other errors (forbidden) to the caller', async () => {
    const d = deps({
      searchBooking: jest.fn(() => Promise.reject(new ProblemError(403, null))),
    });
    await expect(resolveCode(booking('AR-7K3Q9'), d, scanned)).rejects.toBeInstanceOf(ProblemError);
  });
});

describe('resolveCode: ticket QR', () => {
  const qr: ScannedCode = { kind: 'ticket', token: TOKEN };

  it('sends an entry ticket to the gate with its token', async () => {
    const t = ticket();
    const d = deps({ ticketByCode: jest.fn(async () => t) });
    await expect(resolveCode(qr, d, scanned)).resolves.toEqual({
      type: 'entry_ticket',
      ticket: t,
      code: TOKEN,
      manual: false,
    });
  });

  it('checks in the booking of a daily sale ticket', async () => {
    const d = deps({
      ticketByCode: jest.fn(async () => ticket({ kind: 'sale', booking_id: 'b-1' })),
      bookingById: jest.fn(async () => BOOKING),
    });
    await expect(resolveCode(qr, d, scanned)).resolves.toEqual({
      type: 'booking',
      booking: BOOKING,
    });
    expect(d.bookingById).toHaveBeenCalledWith('b-1');
  });

  it.each([
    ['offline', deps({ online: false })],
    ['unreachable', deps({ ticketByCode: jest.fn(offlineError) })],
  ])('needs the connection when %s (tokens are never cached)', async (_, d) => {
    await expect(resolveCode(qr, d, scanned)).resolves.toEqual({ type: 'needs_connection' });
  });

  it('reports a token of no ticket', async () => {
    await expect(resolveCode(qr, deps(), scanned)).resolves.toEqual({ type: 'not_found' });
  });
});

describe('resolveCode: typed codes', () => {
  it('prefers an entry ticket printed with the typed booking code (manual entry)', async () => {
    const t = ticket();
    const d = deps({ ticketByCode: jest.fn(async () => t), findCached: jest.fn(() => BOOKING) });
    await expect(resolveCode(booking('AR-ENTRY1'), d, typed)).resolves.toEqual({
      type: 'entry_ticket',
      ticket: t,
      code: 'AR-ENTRY1',
      manual: true,
    });
  });

  it('falls back to the booking when the code is not an entry ticket', async () => {
    const d = deps({
      ticketByCode: jest.fn(async () => ticket({ kind: 'sale' })),
      findCached: jest.fn(() => BOOKING),
    });
    await expect(resolveCode(booking('AR-7K3Q9'), d, typed)).resolves.toMatchObject({
      type: 'booking',
    });
  });

  it('uses the cache alone offline', async () => {
    const d = deps({ online: false, findCached: jest.fn(() => BOOKING) });
    await expect(resolveCode(booking('AR-7K3Q9'), d, typed)).resolves.toMatchObject({
      type: 'booking',
    });
    expect(d.ticketByCode).not.toHaveBeenCalled();
  });

  it('sends a ticket number to the gate, online only', async () => {
    const number: ScannedCode = { kind: 'ticket_number', number: 37 };
    await expect(resolveCode(number, deps(), typed)).resolves.toEqual({
      type: 'entry_number',
      code: '37',
    });
    await expect(resolveCode(number, deps({ online: false }), typed)).resolves.toEqual({
      type: 'needs_connection',
    });
  });

  it('does not look up what is not an Arenile code', async () => {
    const d = deps();
    await expect(resolveCode({ kind: 'unknown' }, d, typed)).resolves.toEqual({
      type: 'unrecognized',
    });
    expect(d.findCached).not.toHaveBeenCalled();
  });
});
