// The daily ticket of a booking, when it has one (online only, not persisted).
import { useQuery } from '@tanstack/react-query';

import { estKeys } from '@/api/query-keys';
import type { Ticket } from '@/api/types';
import { ticketByCode } from '@/features/check-in/api';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';

/**
 * GET tickets/by-code/{code}: the daily-sale ticket of the booking, or null
 * when it has none (an entry ticket or another booking's ticket never
 * counts). Enabled only while online and when the caller needs it.
 */
export function useBookingTicket(
  booking: { id: string; code: string } | undefined,
  enabled: boolean,
) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<Ticket | null>({
    queryKey: estKeys.ticketByCode(establishmentId, booking?.code ?? ''),
    queryFn: async () => {
      const ticket = await ticketByCode(client, establishmentId, booking?.code ?? '');
      return ticket && ticket.kind === 'sale' && ticket.booking_id === booking?.id ? ticket : null;
    },
    enabled: enabled && !!booking,
    staleTime: 30_000,
    retry: false,
  });
}
