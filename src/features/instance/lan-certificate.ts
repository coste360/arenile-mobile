// Renewal of the desktop LAN certificate (core spec 29.1, ADR 0006): the
// desktop app regenerates its self-signed certificate 30 days before expiry
// (`desktop.lan_cert_renews_at` in /meta). From that moment the fingerprint
// pinned at pairing no longer matches and the device must be paired again.
import type { Meta } from '@/api/types';

/** How long before the renewal the home screen warns (days). */
export const LAN_RENEWAL_NOTICE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type LanRenewal =
  | { status: 'upcoming'; renewsAt: Date }
  /** The renewal instant has passed: it happens at the next start of the desktop app. */
  | { status: 'due'; renewsAt: Date };

/**
 * The renewal to announce on a pinned session, or null: no pinning, not a
 * LAN desktop instance, unknown or unparsable instant, or still far away.
 */
export function lanRenewal(
  meta: Pick<Meta, 'desktop'> | undefined,
  pinned: boolean,
  now: Date,
): LanRenewal | null {
  const raw = meta?.desktop?.mode === 'lan' ? meta.desktop.lan_cert_renews_at : undefined;
  if (!pinned || !raw) return null;
  const renewsAt = new Date(raw);
  if (Number.isNaN(renewsAt.getTime())) return null;
  const left = renewsAt.getTime() - now.getTime();
  if (left <= 0) return { status: 'due', renewsAt };
  return left <= LAN_RENEWAL_NOTICE_DAYS * DAY_MS ? { status: 'upcoming', renewsAt } : null;
}
