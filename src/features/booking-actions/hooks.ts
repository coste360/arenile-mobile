import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { request, type ApiClient } from '@/api/client';
import { ProblemError } from '@/api/errors';
import { estKeys } from '@/api/query-keys';
import type { CashSessionDetail, Slots } from '@/api/types';
import { useBooking } from '@/features/bookings/queries';
import { useEnqueueOperation } from '@/features/offline/offline-provider';
import { useInstanceMeta } from '@/features/session/queries';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import type { CalendarDate } from '@/lib/calendar';
import type { Cents } from '@/lib/money';

import { findCachedBooking, refFromDetail, type BookingRef } from './booking-ref';
import { operationLabel } from './rules';

/**
 * The booking for the operations: the detail when loaded (online, or cached
 * for today and tomorrow), otherwise its copy in the cached day. `ref` is
 * undefined while nothing is known yet.
 */
export function useBookingRef(bookingId: string) {
  const qc = useQueryClient();
  const { establishmentId } = usePairedSession();
  const detail = useBooking(bookingId);
  // The cached day changes with every queued operation and refresh: read it
  // again whenever an establishment query of the cache is updated.
  const [, setCacheTick] = useState(0);
  useEffect(
    () =>
      qc.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.query.queryKey[0] === 'est') {
          setCacheTick((n) => n + 1);
        }
      }),
    [qc],
  );
  // Cheap (a scan of the cached days): recomputed on every render.
  const ref: BookingRef | undefined = detail.data
    ? refFromDetail(detail.data)
    : findCachedBooking(qc, establishmentId, (b) => b.id === bookingId);
  return { ref, detail };
}

/**
 * The queued operations of one booking (ADR 0007): shown at once on the
 * cached data, sent now or on reconnection with a stable Idempotency-Key.
 */
export function useBookingOperations(booking: BookingRef | undefined) {
  const enqueue = useEnqueueOperation();
  const label = booking ? operationLabel(booking) : '';
  const id = booking?.id ?? '';
  const version = booking?.version;

  const checkIn = useCallback(
    () =>
      enqueue({
        kind: 'check_in',
        bookingId: id,
        ...(version !== undefined ? { ifMatch: `"${version}"` } : {}),
        label,
      }),
    [enqueue, id, version, label],
  );
  const addNote = useCallback(
    (text: string) => enqueue({ kind: 'note', bookingId: id, text: text.trim(), label }),
    [enqueue, id, label],
  );
  const collectCash = useCallback(
    (amount: Cents) => enqueue({ kind: 'cash_payment', bookingId: id, amount, label }),
    [enqueue, id, label],
  );
  const releaseDay = useCallback(
    (date: CalendarDate, slots: Slots) =>
      enqueue({
        kind: 'day_release',
        bookingId: id,
        date,
        ...(slots === 'FULL' ? {} : { slots }),
        label,
      }),
    [enqueue, id, label],
  );
  return { checkIn, addNote, collectCash, releaseDay };
}

/**
 * GET cash-sessions/current: the open session of the main register, or
 * null when none is open (404). Cash needs an open session on the server
 * (409 cash_session_closed). Not cached offline (ADR 0007: no cash data).
 */
export async function fetchCurrentCashSession(
  client: ApiClient,
  establishmentId: string,
): Promise<CashSessionDetail | null> {
  try {
    return await request(() =>
      client.GET('/api/admin/v1/establishments/{establishmentId}/cash-sessions/current', {
        params: { path: { establishmentId } },
      }),
    );
  } catch (e) {
    if (e instanceof ProblemError && e.status === 404) return null;
    throw e;
  }
}

export type CashDeskState = 'open' | 'closed' | 'unknown';

/** Whether the cash desk is open; `unknown` offline or while loading. */
export function useCashDesk(enabled: boolean): CashDeskState {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const session = useQuery({
    queryKey: estKeys.cashSession(establishmentId),
    queryFn: () => fetchCurrentCashSession(client, establishmentId),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
  if (session.data === null) return 'closed';
  if (session.data?.session.status === 'open') return 'open';
  if (session.data) return 'closed';
  return 'unknown';
}

/**
 * Features the instance reports in /meta (`cash`, `season_passes`). While
 * /meta is unknown (offline before the first load) everything is assumed
 * on: the server stays the judge.
 */
export function useInstanceFeature(feature: string): boolean {
  const meta = useInstanceMeta();
  return meta.data ? meta.data.features.includes(feature) : true;
}
