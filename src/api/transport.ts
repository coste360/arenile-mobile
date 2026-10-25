// HTTP transport selection: the ONLY place that decides how bytes reach an
// instance. Instances with a publicly trusted certificate use the platform
// fetch (system TLS validation). Desktop LAN mode (self-signed certificate,
// fingerprint in the pairing QR) uses the native pinned transport of
// modules/pinned-fetch (ADR 0006), which accepts the server only when the
// SHA-256 of its leaf certificate equals that fingerprint. A build without the
// native module (Expo Go, web) refuses those instances instead of weakening TLS.
import { CertificateMismatchError, LanTransportUnavailableError } from '@/api/errors';

import {
  nativePinnedFetch,
  normalizeFingerprint,
  PinnedFetchError,
  type PinnedFetch,
} from '../../modules/pinned-fetch';

export { normalizeFingerprint, PinnedFetchError, type PinnedFetch };

export type Transport = (request: Request) => Promise<Response>;

export interface TransportOptions {
  /** SHA-256 fingerprint of a self-signed certificate (desktop LAN mode). */
  fingerprint?: string;
  /** fetch implementation (tests inject a fake); defaults to the global fetch at call time. */
  fetch?: typeof fetch;
  /**
   * Pinned transport; undefined means the native module of this build, null
   * means none (tests inject a fake).
   */
  pinnedFetch?: PinnedFetch | null;
}

const resolvePinned = (pinnedFetch: PinnedFetch | null | undefined) =>
  pinnedFetch === undefined ? nativePinnedFetch : pinnedFetch;

/** Reports whether this build can talk to an instance with a pinned certificate fingerprint. */
export function canPinCertificates(pinnedFetch?: PinnedFetch | null): boolean {
  return resolvePinned(pinnedFetch) !== null;
}

export function selectTransport({
  fingerprint,
  fetch: fetchImpl,
  pinnedFetch,
}: TransportOptions): Transport {
  if (!fingerprint) return (request) => (fetchImpl ?? globalThis.fetch)(request);

  const pinned = resolvePinned(pinnedFetch);
  if (!pinned) throw new LanTransportUnavailableError();
  const expected = normalizeFingerprint(fingerprint);
  // Pairing validates the fingerprint: a malformed one is a programming error.
  if (!expected) throw new TypeError('invalid certificate fingerprint');
  return async (request) => {
    try {
      return await pinned(request, expected);
    } catch (e) {
      if (e instanceof PinnedFetchError && e.code === 'certificate_mismatch') {
        throw new CertificateMismatchError({ cause: e });
      }
      // Any other failure means "unreachable" (request() maps it to
      // NetworkError); an abort is reported by the client's own timeout.
      throw e;
    }
  };
}
