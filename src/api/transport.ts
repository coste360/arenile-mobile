// HTTP transport selection: the ONLY place that decides how bytes reach an
// instance. Today every instance with a publicly trusted certificate uses the
// platform fetch. Desktop LAN mode (self-signed certificate, fingerprint in
// the pairing QR) needs a native transport that pins exactly that SHA-256
// fingerprint (ADR 0006); until it exists we refuse instead of weakening TLS.
import { LanTransportUnavailableError } from '@/api/errors';

export type Transport = (request: Request) => Promise<Response>;

export interface TransportOptions {
  /** SHA-256 fingerprint of a self-signed certificate (desktop LAN mode). */
  fingerprint?: string;
  /** fetch implementation (tests inject a fake); defaults to the global fetch at call time. */
  fetch?: typeof fetch;
}

/** Reports whether this build can talk to an instance with the given certificate fingerprint. */
export function canPinCertificates(): boolean {
  return false;
}

export function selectTransport({ fingerprint, fetch: fetchImpl }: TransportOptions): Transport {
  if (fingerprint && !canPinCertificates()) throw new LanTransportUnavailableError();
  return (request) => (fetchImpl ?? globalThis.fetch)(request);
}
