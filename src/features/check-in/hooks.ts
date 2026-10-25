import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { estKeys } from '@/api/query-keys';
import { findCachedBooking, sameCode } from '@/features/booking-actions/booking-ref';
import { useOfflineStatus } from '@/features/offline/offline-provider';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';

import { admitEntry, bookingRefById, searchBookingByCode, ticketByCode } from './api';
import { resolveCode, type Resolution } from './resolve';
import type { ScannedCode } from './scan-code';

/** Resolves scanned or typed codes against the cached day and, when reachable, the instance. */
export function useCodeResolver(): (
  scanned: ScannedCode,
  options: { manual: boolean },
) => Promise<Resolution> {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { connection } = useOfflineStatus();
  const reachable = connection === 'online' || connection === 'syncing';

  return useCallback(
    (scanned, options) =>
      resolveCode(
        scanned,
        {
          online: reachable,
          findCached: (code) =>
            findCachedBooking(qc, establishmentId, (b) => sameCode(b.code, code)),
          searchBooking: (code) => searchBookingByCode(client, establishmentId, code),
          ticketByCode: (code) => ticketByCode(client, establishmentId, code),
          bookingById: async (id) =>
            findCachedBooking(qc, establishmentId, (b) => b.id === id) ??
            bookingRefById(client, establishmentId, id),
        },
        options,
      ),
    [qc, client, establishmentId, reachable],
  );
}

/** Admits an entry ticket at the gate (online only); refreshes the day afterwards. */
export function useAdmitEntry() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: ({ code, manual }: { code: string; manual: boolean }) =>
      admitEntry(client, establishmentId, code, manual),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
  });
}

export type CodeLookup =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'done'; resolution: Resolution }
  /** The instance answered with an error other than the network (403, 5xx). */
  | { status: 'error'; error: unknown };

/**
 * One lookup at a time for a scanner or a search field: `lookup` resolves a
 * code (later answers of an older lookup are ignored), `reset` gets ready
 * for the next one.
 */
export function useCodeLookup() {
  const resolve = useCodeResolver();
  const [state, setState] = useState<CodeLookup>({ status: 'idle' });
  const generation = useRef(0);

  const lookup = useCallback(
    async (scanned: ScannedCode, options: { manual: boolean }) => {
      const mine = ++generation.current;
      setState({ status: 'busy' });
      try {
        const resolution = await resolve(scanned, options);
        if (mine === generation.current) setState({ status: 'done', resolution });
      } catch (error) {
        if (mine === generation.current) setState({ status: 'error', error });
      }
    },
    [resolve],
  );
  const reset = useCallback(() => {
    generation.current++;
    setState({ status: 'idle' });
  }, []);
  return { state, lookup, reset };
}
