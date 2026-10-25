// Bookings of the paired establishment (core spec 15, phase 1 "Prenotazioni
// del giorno"): the list of a day and the booking detail.
import { useQuery } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type { BookingDetail, BookingSummary } from '@/api/types';
import { DAY_STALE_MS } from '@/features/operations/queries';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import type { CalendarDate } from '@/lib/calendar';

const PAGE_SIZE = 200;
/** Safety cap: 10 pages of 200 is far beyond the busiest day of a lido. */
const MAX_PAGES = 10;

/**
 * Every booking whose stay includes `date` (from = to = date), all pages,
 * ordered by start date as the server returns them.
 */
export async function fetchBookingsOfDay(
  client: ApiClient,
  establishmentId: string,
  date: CalendarDate,
): Promise<BookingSummary[]> {
  const items: BookingSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await request(() =>
      client.GET('/api/admin/v1/establishments/{establishmentId}/bookings', {
        params: {
          path: { establishmentId },
          query: { from: date, to: date, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        },
      }),
    );
    items.push(...res.items);
    cursor = res.next_cursor;
    if (!cursor) break;
  }
  return items;
}

export const bookingsOfDayQuery = (
  client: ApiClient,
  establishmentId: string,
  date: CalendarDate,
) => ({
  queryKey: estKeys.bookingsOfDay(establishmentId, date),
  queryFn: () => fetchBookingsOfDay(client, establishmentId, date),
  staleTime: DAY_STALE_MS,
});

/** The bookings of a day (list with filters, phase 1). */
export function useBookingsOfDay(date: CalendarDate) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery(bookingsOfDayQuery(client, establishmentId, date));
}

export function fetchBooking(
  client: ApiClient,
  establishmentId: string,
  bookingId: string,
): Promise<BookingDetail> {
  return request(() =>
    client.GET('/api/admin/v1/establishments/{establishmentId}/bookings/{bookingId}', {
      params: { path: { establishmentId, bookingId } },
    }),
  );
}

/** Booking detail (scheda prenotazione); cached offline when the stay touches today or tomorrow. */
export function useBooking(bookingId: string) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery({
    queryKey: estKeys.booking(establishmentId, bookingId),
    queryFn: () => fetchBooking(client, establishmentId, bookingId),
    staleTime: DAY_STALE_MS,
  });
}
