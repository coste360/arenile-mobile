import { request, type ApiClient } from '@/api/client';

import type { OfflineOperation } from './types';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

/**
 * Sends one queued operation with its Idempotency-Key (core spec 17.1): a
 * replay of an operation the server already applied returns the stored
 * answer instead of applying it twice. Throws the typed errors of
 * api/errors (classified by the queue).
 */
export async function sendOfflineOperation(client: ApiClient, op: OfflineOperation): Promise<void> {
  const { establishmentId } = op.scope;
  const header = { 'Idempotency-Key': op.idempotencyKey };
  switch (op.kind) {
    case 'check_in':
      await request(() =>
        client.POST(`${EST}/bookings/{bookingId}/check-in`, {
          params: {
            path: { establishmentId, bookingId: op.bookingId },
            header: {
              ...header,
              // The core requires If-Match on check-in (core ADR 0019 C). A
              // check-in queued behind other operations on its booking has no
              // reliable version: "*" lets the state transition guard it
              // (confirmed → checked_in, 409 invalid_transition otherwise).
              'If-Match': op.ifMatch ?? '*',
            },
          },
          body: {},
        }),
      );
      return;
    case 'day_release':
      await request(() =>
        client.POST(`${EST}/season-passes/{passId}/releases`, {
          params: { path: { establishmentId, passId: op.bookingId }, header },
          body: { dates: [op.date], ...(op.slots ? { slots: op.slots } : {}) },
        }),
      );
      return;
    case 'note':
      await request(() =>
        client.POST(`${EST}/bookings/{bookingId}/notes`, {
          params: { path: { establishmentId, bookingId: op.bookingId }, header },
          body: { text: op.text, visibility: 'internal' },
        }),
      );
      return;
    case 'cash_payment':
      await request(() =>
        client.POST(`${EST}/bookings/{bookingId}/payments`, {
          params: { path: { establishmentId, bookingId: op.bookingId }, header },
          body: { amount: op.amount, method: 'cash', ...(op.note ? { note: op.note } : {}) },
        }),
      );
      return;
  }
}
