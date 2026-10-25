// Server state of the daily quick sale: catalogue, settings, quote and the
// sale itself. Online only: none of these keys is persisted, and the sale
// is never queued (spec 21.2 of the core: it needs the server's availability
// guarantees and ticket numbering).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { request, type ApiClient } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type {
  DailySaleCreate,
  DailySaleQuote,
  DailySaleQuoteRequest,
  DailySaleResult,
  DailySaleSettings,
  Extra,
  Pack,
} from '@/api/types';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { useDependencies } from '@/providers/dependencies';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

/** Page size of the catalogue lists: a lido has a handful of packs and extras. */
const CATALOGUE_LIMIT = 200;

export async function fetchActivePacks(
  client: ApiClient,
  establishmentId: string,
): Promise<Pack[]> {
  const page = await request(() =>
    client.GET(`${EST}/packs`, {
      params: { path: { establishmentId }, query: { active: true, limit: CATALOGUE_LIMIT } },
    }),
  );
  return page.items;
}

export async function fetchActiveExtras(
  client: ApiClient,
  establishmentId: string,
): Promise<Extra[]> {
  const page = await request(() =>
    client.GET(`${EST}/extras`, {
      params: { path: { establishmentId }, query: { active: true, limit: CATALOGUE_LIMIT } },
    }),
  );
  return page.items;
}

export function usePacks(enabled = true) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery({
    queryKey: estKeys.packs(establishmentId),
    queryFn: () => fetchActivePacks(client, establishmentId),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useExtras(enabled = true) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery({
    queryKey: estKeys.extras(establishmentId),
    queryFn: () => fetchActiveExtras(client, establishmentId),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useDailySaleSettings(enabled = true) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<DailySaleSettings>({
    queryKey: estKeys.dailySaleSettings(establishmentId),
    queryFn: () =>
      request(() =>
        client.GET(`${EST}/daily-sale-settings`, { params: { path: { establishmentId } } }),
      ),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Price and availability of the sale being composed (no write); null body = nothing yet. */
export function useSaleQuote(body: DailySaleQuoteRequest | null) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<DailySaleQuote>({
    queryKey: estKeys.dailySaleQuote(establishmentId, body),
    queryFn: () =>
      request(() =>
        client.POST(`${EST}/daily-sales/quote`, {
          params: { path: { establishmentId } },
          body: body as DailySaleQuoteRequest,
        }),
      ),
    enabled: !!body,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
  });
}

/**
 * Creates the sale. The Idempotency-Key stays the same while the request
 * does not change, so a double tap or a retry after a timeout sells once;
 * after a sale the next one gets a new key.
 */
export function useCreateDailySale() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { randomId } = useDependencies();
  const last = useRef<{ body: string; key: string } | null>(null);
  return useMutation<DailySaleResult, Error, DailySaleCreate>({
    mutationFn: (body) => {
      const serialized = JSON.stringify(body);
      if (last.current?.body !== serialized) last.current = { body: serialized, key: randomId() };
      const key = last.current.key;
      return request(() =>
        client.POST(`${EST}/daily-sales`, {
          params: { path: { establishmentId }, header: { 'Idempotency-Key': key } },
          body,
        }),
      );
    },
    onSuccess: () => {
      last.current = null;
    },
    onSettled: async () => {
      // The spot is taken (or the price changed): the map, the lists and the quote change.
      await Promise.all([
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'bookings') }),
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'tickets') }),
      ]);
    },
  });
}
