// Manual block of a spot from the map (phase 1 "blocco della postazione",
// core ADR 0019 C, permission operations.run). Online only: a block takes a
// spot out of availability, which the server alone guarantees (spec 21.2),
// so it is never queued.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { request } from '@/api/client';
import { isForbidden, NetworkError, ProblemError } from '@/api/errors';
import { useIdempotencyKeys } from '@/api/idempotency';
import { estKeys } from '@/api/query-keys';
import type { Slots } from '@/api/types';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import type { CalendarDate } from '@/lib/calendar';
import { useDependencies } from '@/providers/dependencies';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

export interface BlockInput {
  spotId: string;
  date: CalendarDate;
  slot: Slots;
  reason?: string;
}

/**
 * POST spot-blocks for one spot, one day and slot. The Idempotency-Key stays
 * the same across retries after a lost answer, so a block that was applied is
 * not refused as spot_unavailable by its own retry (src/api/idempotency.ts).
 */
export function useBlockSpot() {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { randomId } = useDependencies();
  const qc = useQueryClient();
  const keys = useIdempotencyKeys(randomId);
  return useMutation({
    mutationFn: ({ spotId, date, slot, reason }: BlockInput) =>
      request(() =>
        client.POST(`${EST}/spot-blocks`, {
          params: {
            path: { establishmentId },
            header: {
              'Idempotency-Key': keys.keyFor(JSON.stringify([spotId, date, slot, reason])),
            },
          },
          body: {
            spot_ids: [spotId],
            starts_on: date,
            ends_on: date,
            slots: slot,
            ...(reason ? { reason } : {}),
          },
        }),
      ),
    onSettled: (_data, error) => {
      keys.settled(error);
      return qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') });
    },
  });
}

/** DELETE spot-blocks/{id}: removes the block for its whole period. */
export function useUnblockSpot() {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) =>
      request(() =>
        client.DELETE(`${EST}/spot-blocks/{blockId}`, {
          params: { path: { establishmentId, blockId } },
        }),
      ),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
  });
}

/** i18n key of a failed block or unblock, from the error type and problem slug. */
export function blockErrorKey(
  e: unknown,
):
  | 'offline.errors.forbidden'
  | 'dayMap.errors.spotUnavailable'
  | 'dayMap.errors.network'
  | 'dayMap.errors.notFound'
  | 'dayMap.errors.default' {
  if (isForbidden(e)) return 'offline.errors.forbidden';
  if (e instanceof NetworkError) return 'dayMap.errors.network';
  if (e instanceof ProblemError && e.status === 409) return 'dayMap.errors.spotUnavailable';
  if (e instanceof ProblemError && e.status === 404) return 'dayMap.errors.notFound';
  return 'dayMap.errors.default';
}
