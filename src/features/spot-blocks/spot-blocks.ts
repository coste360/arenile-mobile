// Manual blocks of a spot (core spec 11.3, ADR 0019 C in the core): an
// allocation of kind block, so the same availability guarantees as a booking
// apply (409 spot_unavailable). Like create/move booking (spec 21.2) they are
// online-only and never queued (ADR 0009 of this app).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { request, type ApiClient } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type { OperationalSpot, Slots, SpotBlockCreate } from '@/api/types';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { addDays, type CalendarDate } from '@/lib/calendar';
import { useDependencies } from '@/providers/dependencies';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

/** Core limit of a block reason (SpotBlockCreate.reason). */
export const BLOCK_REASON_MAX = 200;

/** Periods offered on the phone: the offline window, like the rest of the app. */
export type BlockPeriod = 'today' | 'tomorrow' | 'today_and_tomorrow';

export const BLOCK_PERIODS: readonly BlockPeriod[] = ['today', 'tomorrow', 'today_and_tomorrow'];

export function blockRange(
  period: BlockPeriod,
  today: CalendarDate,
): { starts_on: CalendarDate; ends_on: CalendarDate } {
  const tomorrow = addDays(today, 1);
  switch (period) {
    case 'today':
      return { starts_on: today, ends_on: today };
    case 'tomorrow':
      return { starts_on: tomorrow, ends_on: tomorrow };
    case 'today_and_tomorrow':
      return { starts_on: today, ends_on: tomorrow };
  }
}

/** Request body of a block of one spot; an empty reason is omitted. */
export function toSpotBlockCreate(input: {
  spotId: string;
  period: BlockPeriod;
  slots: Slots;
  reason: string;
  today: CalendarDate;
}): SpotBlockCreate {
  const reason = input.reason.trim();
  return {
    spot_ids: [input.spotId],
    ...blockRange(input.period, input.today),
    slots: input.slots,
    ...(reason ? { reason } : {}),
  };
}

export type SpotBlockAction = 'block' | 'unblock' | 'none';

/**
 * What the spot sheet offers: block a free (or released) spot, unblock a
 * blocked one. Occupied spots are not blockable (the server would answer
 * spot_unavailable); closed and inactive spots have nothing to do.
 */
export function spotBlockAction(
  spot: Pick<OperationalSpot, 'status' | 'block_id'>,
): SpotBlockAction {
  if (spot.status === 'blocked') return spot.block_id ? 'unblock' : 'none';
  if (spot.status === 'free' || spot.status === 'released') return 'block';
  return 'none';
}

export function createSpotBlock(
  client: ApiClient,
  establishmentId: string,
  body: SpotBlockCreate,
  idempotencyKey: string,
) {
  return request(() =>
    client.POST(`${EST}/spot-blocks`, {
      params: { path: { establishmentId }, header: { 'Idempotency-Key': idempotencyKey } },
      body,
    }),
  );
}

export async function deleteSpotBlock(
  client: ApiClient,
  establishmentId: string,
  blockId: string,
): Promise<void> {
  await request(() =>
    client.DELETE(`${EST}/spot-blocks/{blockId}`, {
      params: { path: { establishmentId, blockId } },
    }),
  );
}

/**
 * Blocks a spot. The Idempotency-Key stays the same while the request does
 * not change, so a double tap or a retry after a timeout blocks once; a
 * new request gets a new key.
 */
export function useCreateSpotBlock() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { randomId } = useDependencies();
  const last = useRef<{ body: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (body: SpotBlockCreate) => {
      const serialized = JSON.stringify(body);
      if (last.current?.body !== serialized) last.current = { body: serialized, key: randomId() };
      return createSpotBlock(client, establishmentId, body, last.current.key);
    },
    onSuccess: () => {
      last.current = null;
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
  });
}

/** Removes a block: the spot is bookable again. */
export function useDeleteSpotBlock() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: (blockId: string) => deleteSpotBlock(client, establishmentId, blockId),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
  });
}
