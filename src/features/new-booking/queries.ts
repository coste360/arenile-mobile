// Server state of a new booking on the fly: quote, hold and creation. Online
// only: none of these keys is persisted and nothing is queued (ADR 0009: a
// booking needs the server's availability guarantees).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { useIdempotencyKeys } from '@/api/idempotency';
import { estKeys } from '@/api/query-keys';
import type { BookingCreate, BookingDetail, BookingQuote, Hold, HoldCreate } from '@/api/types';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { useDependencies } from '@/providers/dependencies';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

/**
 * Price, rules and availability of the stay being composed (no write); null
 * body = nothing yet. With the hold_id of the operator's own hold the core
 * skips the availability check (the hold already guarantees the spot).
 */
export function useBookingQuote(body: BookingCreate | null) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<BookingQuote>({
    queryKey: estKeys.bookingQuote(establishmentId, body),
    // A quote overtaken by a newer selection is cancelled (TanStack aborts the signal).
    queryFn: ({ signal }) =>
      request(() =>
        client.POST(`${EST}/bookings/quote`, {
          params: { path: { establishmentId } },
          body: body as BookingCreate,
          signal,
        }),
      ),
    enabled: !!body,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
  });
}

/**
 * Holds the spot for the stay (POST holds). The Idempotency-Key stays the
 * same while the request does not change, so a double tap holds once.
 */
export function useCreateHold() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { randomId } = useDependencies();
  const keys = useIdempotencyKeys(randomId);
  return useMutation<Hold, Error, HoldCreate>({
    mutationFn: (body) => {
      const key = keys.keyFor(JSON.stringify(body));
      return request(() =>
        client.POST(`${EST}/holds`, {
          params: { path: { establishmentId }, header: { 'Idempotency-Key': key } },
          body,
        }),
      );
    },
    onSettled: async (_data, error) => {
      keys.settled(error);
      // The map shows the held spot.
      await qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') });
    },
  });
}

/** Releases a hold (DELETE holds/{id}, idempotent on the server). */
export async function releaseHold(
  client: ApiClient,
  establishmentId: string,
  holdId: string,
): Promise<void> {
  await request(() =>
    client.DELETE(`${EST}/holds/{holdId}`, { params: { path: { establishmentId, holdId } } }),
  );
}

export function useReleaseHold() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation<void, Error, string>({
    mutationFn: (holdId) => releaseHold(client, establishmentId, holdId),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') });
    },
  });
}

/**
 * Creates the booking. The Idempotency-Key stays the same while the request
 * does not change, so a double tap or a retry after a timeout books once;
 * after a booking or a refusal the next attempt gets a new key.
 */
export function useCreateBooking() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { randomId } = useDependencies();
  const keys = useIdempotencyKeys(randomId);
  return useMutation<BookingDetail, Error, BookingCreate>({
    mutationFn: (body) => {
      const key = keys.keyFor(JSON.stringify(body));
      return request(() =>
        client.POST(`${EST}/bookings`, {
          params: { path: { establishmentId }, header: { 'Idempotency-Key': key } },
          body,
        }),
      );
    },
    onSettled: async (_data, error) => {
      keys.settled(error);
      // The spot is taken: the map, the lists and "Oggi" change.
      await Promise.all([
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'bookings') }),
      ]);
    },
  });
}
