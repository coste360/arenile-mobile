// Ticket printing on the establishment's ESC/POS network printers (core ADR
// 0021, spec 03 of this app): the server composes the ticket and sends it to
// the printer configured in the panel; the app only asks for it. Printing
// needs cash.operate and a printer reachable by the server, which only the
// desktop edition has: on the server edition the route is never ready and
// the panel prints from the browser.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { isForbidden, NetworkError, ProblemError } from '@/api/errors';
import { useIdempotencyKeys } from '@/api/idempotency';
import { estKeys } from '@/api/query-keys';
import type {
  PrintDocumentKind,
  PrintJob,
  PrintJobStatus,
  PrintRouteResolution,
  PrintRouteUnreadyReason,
} from '@/api/types';
import { fetchCurrentCashSession } from '@/features/booking-actions/hooks';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { useDependencies } from '@/providers/dependencies';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

/** How often a queued job is checked until it is printed or fails. */
export const PRINT_JOB_POLL_MS = 1_500;

export function resolvePrintRoute(
  client: ApiClient,
  establishmentId: string,
  kind: PrintDocumentKind,
  registerId?: string,
): Promise<PrintRouteResolution> {
  return request(() =>
    client.GET(`${EST}/print-routes/resolve`, {
      params: {
        path: { establishmentId },
        query: { document_kind: kind, ...(registerId ? { register_id: registerId } : {}) },
      },
    }),
  );
}

export function createPrintJob(
  client: ApiClient,
  establishmentId: string,
  body: { document_kind: PrintDocumentKind; document_id: string; register_id?: string },
  idempotencyKey: string,
): Promise<PrintJob> {
  return request(() =>
    client.POST(`${EST}/print-jobs`, {
      params: { path: { establishmentId }, header: { 'Idempotency-Key': idempotencyKey } },
      body,
    }),
  );
}

export function fetchPrintJob(
  client: ApiClient,
  establishmentId: string,
  printJobId: string,
): Promise<PrintJob> {
  return request(() =>
    client.GET(`${EST}/print-jobs/{printJobId}`, {
      params: { path: { establishmentId, printJobId } },
    }),
  );
}

export function retryPrintJob(
  client: ApiClient,
  establishmentId: string,
  printJobId: string,
): Promise<PrintJob> {
  return request(() =>
    client.POST(`${EST}/print-jobs/{printJobId}/retry`, {
      params: { path: { establishmentId, printJobId } },
    }),
  );
}

/** What the print button shows for a job: in progress, done or failed. */
export type PrintPhase = 'sending' | 'printed' | 'failed';

export function printPhase(status: PrintJobStatus): PrintPhase {
  switch (status) {
    case 'queued':
    case 'printing':
      return 'sending';
    case 'printed':
      return 'printed';
    case 'failed':
    case 'cancelled':
      return 'failed';
  }
}

export type PrintReasonKey = `printing.reason.${PrintRouteUnreadyReason}`;

/** Why the ticket cannot go to a printer: the route's reason (no_route when absent). */
export function unreadyReasonKey(resolution: PrintRouteResolution): PrintReasonKey | null {
  if (resolution.ready && resolution.printer) return null;
  return `printing.reason.${resolution.reason ?? 'no_route'}`;
}

export type PrintErrorKey =
  | 'printing.errors.offline'
  | 'printing.errors.forbidden'
  | 'printing.errors.unavailable'
  | 'printing.errors.noRoute'
  | 'printing.errors.notFound'
  | 'printing.errors.default';

/** Message of a failed print request, from the core's stable problem slugs. */
export function printErrorKey(e: unknown): PrintErrorKey {
  if (e instanceof NetworkError) return 'printing.errors.offline';
  if (isForbidden(e)) return 'printing.errors.forbidden';
  if (e instanceof ProblemError) {
    if (e.type === 'printing_unavailable') return 'printing.errors.unavailable';
    if (e.type === 'print_route_missing') return 'printing.errors.noRoute';
    if (e.status === 404) return 'printing.errors.notFound';
  }
  return 'printing.errors.default';
}

/**
 * Printer route of the daily tickets for the register of the open cash
 * session (the panel's rule: register first, then the default). Only for
 * roles with cash.operate (`enabled`); online only, never persisted.
 */
export function useTicketPrintRoute(enabled: boolean) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const session = useQuery({
    queryKey: estKeys.cashSession(establishmentId),
    queryFn: () => fetchCurrentCashSession(client, establishmentId),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
  const registerId = session.data?.session.register_id ?? undefined;
  const route = useQuery({
    queryKey: estKeys.printRoute(establishmentId, 'daily_ticket', registerId),
    queryFn: () => resolvePrintRoute(client, establishmentId, 'daily_ticket', registerId),
    // Wait for the cash session (it picks the register), but do not block on its failure.
    enabled: enabled && !session.isPending,
    staleTime: 30_000,
    retry: false,
  });
  return { route, registerId };
}

/**
 * Sends a ticket to the printer. A double tap or a retry after a timeout
 * reuses the Idempotency-Key, so it prints once; another tap after the
 * outcome is a deliberate reprint with a new key.
 */
export function usePrintTicket(registerId?: string) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { randomId } = useDependencies();
  const keys = useIdempotencyKeys(randomId);
  return useMutation({
    mutationFn: (ticketId: string) =>
      createPrintJob(
        client,
        establishmentId,
        {
          document_kind: 'daily_ticket',
          document_id: ticketId,
          ...(registerId ? { register_id: registerId } : {}),
        },
        keys.keyFor(ticketId),
      ),
    onSettled: (_data, error) => keys.settled(error),
  });
}

/** Follows a job until it is printed, failed or cancelled. */
export function usePrintJob(jobId: string | undefined) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery({
    queryKey: estKeys.printJob(establishmentId, jobId ?? ''),
    queryFn: () => fetchPrintJob(client, establishmentId, jobId as string),
    enabled: !!jobId,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return !status || printPhase(status) === 'sending' ? PRINT_JOB_POLL_MS : false;
    },
  });
}

/** Queues a failed job again (same content, attempts reset). */
export function useRetryPrintJob() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: (jobId: string) => retryPrintJob(client, establishmentId, jobId),
    onSuccess: (job) => qc.setQueryData(estKeys.printJob(establishmentId, job.id), job),
  });
}
