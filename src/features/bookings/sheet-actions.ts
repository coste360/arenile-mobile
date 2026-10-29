// Online-only actions of the booking sheet added by core 1.1 (M8): the
// summary for the customer, handed to the native share sheet (spec 30.9),
// and the check of the agreement's requirement (spec 30.2.2-30.2.3). Both
// need bookings.write (owner, manager, cashier) and are never queued.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { request, type ApiClient } from '@/api/client';
import { isForbidden, NetworkError, ProblemError } from '@/api/errors';
import { estKeys } from '@/api/query-keys';
import type { BookingDetail, BookingShareSummary } from '@/api/types';
import type { Abilities } from '@/features/permissions/permissions';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { useDependencies } from '@/providers/dependencies';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

/** Both actions need bookings.write in the core (notify.ShareSummary, booking.VerifyRequirement). */
export const canShareSummary = (a: Pick<Abilities, 'canWriteBookings'>) => a.canWriteBookings;
export const canVerifyRequirement = (a: Pick<Abilities, 'canWriteBookings'>) => a.canWriteBookings;

/** A summary is worth sending while the booking stands and the customer is known. */
export function shareable(b: Pick<BookingDetail, 'status' | 'customer'>): boolean {
  return !['cancelled', 'expired', 'rejected'].includes(b.status) && !b.customer.anonymized_at;
}

/**
 * The summary in the customer's language with a new manage link. A POST
 * because it rotates the link: the customer's previous link stops working,
 * so it is requested only when the operator asks for it.
 */
export function createShareSummary(
  client: ApiClient,
  establishmentId: string,
  bookingId: string,
): Promise<BookingShareSummary> {
  return request(() =>
    client.POST(`${EST}/bookings/{bookingId}/share-summary`, {
      params: { path: { establishmentId, bookingId } },
    }),
  );
}

/** The share sheet itself failed: the summary (and its new link) was created. */
export class ShareSheetError extends Error {
  constructor(cause: unknown) {
    super('share sheet failed', { cause });
    this.name = 'ShareSheetError';
  }
}

/**
 * Asks the summary, then opens the share sheet with its text (WhatsApp,
 * Messages...). When the share sheet fails, the text is kept: the next
 * press opens it again without a new POST, which would revoke the link
 * just created. Dismissing the share sheet is not a failure.
 */
export function useShareSummary(bookingId: string) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { shareText } = useDependencies();
  const pending = useRef<{ bookingId: string; text: string } | null>(null);
  return useMutation({
    mutationFn: async () => {
      const kept = pending.current?.bookingId === bookingId ? pending.current.text : undefined;
      const text = kept ?? (await createShareSummary(client, establishmentId, bookingId)).text;
      pending.current = { bookingId, text };
      try {
        await shareText(text);
      } catch (e) {
        throw new ShareSheetError(e);
      }
      pending.current = null;
    },
  });
}

/**
 * Records that the requirement of the booking's agreement was checked
 * (date and operator, never a copy of the document), with If-Match on the
 * booking version.
 */
export async function verifyRequirement(
  client: ApiClient,
  establishmentId: string,
  bookingId: string,
  version: number,
): Promise<void> {
  await request(() =>
    client.POST(`${EST}/bookings/{bookingId}/requirement-verification`, {
      params: { path: { establishmentId, bookingId }, header: { 'If-Match': `"${version}"` } },
      body: {},
    }),
  );
}

/** Verifies the requirement, then refreshes the booking (sheet, day lists, map). */
export function useVerifyRequirement() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: (v: { bookingId: string; version: number }) =>
      verifyRequirement(client, establishmentId, v.bookingId, v.version),
    // Also after a refusal: a 412 means the sheet shows an old version.
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'bookings') }),
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
      ]);
    },
  });
}

export type ShareErrorKey =
  | 'bookings.share.errors.offline'
  | 'bookings.share.errors.forbidden'
  | 'bookings.share.errors.not_found'
  | 'bookings.share.errors.unavailable'
  | 'bookings.share.errors.sheet'
  | 'bookings.share.errors.default';

export function shareErrorKey(e: unknown): ShareErrorKey {
  if (e instanceof ShareSheetError) return 'bookings.share.errors.sheet';
  if (e instanceof NetworkError) return 'bookings.share.errors.offline';
  if (isForbidden(e)) return 'bookings.share.errors.forbidden';
  if (e instanceof ProblemError) {
    if (e.status === 404) return 'bookings.share.errors.not_found';
    // Instance without the feature (no notifications service).
    if (e.status === 501) return 'bookings.share.errors.unavailable';
  }
  return 'bookings.share.errors.default';
}

export type VerifyErrorKey =
  | 'bookings.agreement.errors.offline'
  | 'bookings.agreement.errors.forbidden'
  | 'bookings.agreement.errors.changed'
  | 'bookings.agreement.errors.not_modifiable'
  | 'bookings.agreement.errors.invalid'
  | 'bookings.agreement.errors.not_found'
  | 'bookings.agreement.errors.unavailable'
  | 'bookings.agreement.errors.default';

export function verifyErrorKey(e: unknown): VerifyErrorKey {
  if (e instanceof NetworkError) return 'bookings.agreement.errors.offline';
  if (isForbidden(e)) return 'bookings.agreement.errors.forbidden';
  if (e instanceof ProblemError) {
    switch (e.type) {
      case 'version_conflict':
        return 'bookings.agreement.errors.changed';
      case 'validation_failed':
      case 'bad_request':
        return 'bookings.agreement.errors.invalid';
      default:
        if (e.status === 412) return 'bookings.agreement.errors.changed';
        // A cancelled or concluded booking (booking.ErrNotModifiable).
        if (e.status === 409) return 'bookings.agreement.errors.not_modifiable';
        if (e.status === 404) return 'bookings.agreement.errors.not_found';
        if (e.status === 501) return 'bookings.agreement.errors.unavailable';
    }
  }
  return 'bookings.agreement.errors.default';
}
