import {
  CertificateMismatchError,
  NetworkError,
  ProblemError,
  UnauthorizedError,
  UnexpectedResponseError,
} from '@/api/errors';

import type { OperationError } from './types';

/**
 * What the queue does with a failed send:
 * - `retry`: transient (no network, timeout, 429, 5xx, 409
 *   idempotency_in_progress or concurrent_update, a non-JSON answer
 *   such as a captive portal, a desktop LAN certificate that changed, ADR
 *   0006): the operation stays pending, in order, and the flush stops; the
 *   idempotency key makes the next attempt safe;
 * - `auth`: 401 `unauthorized` (token revoked or expired): the queue pauses
 *   and the session signs out; operations wait for a new pairing;
 * - `conflict`: 409, 412, 422 (state changed on the server, version or
 *   idempotency conflict, rule violated): shown to the user, flush goes on;
 * - `failed`: any other 4xx (403 not allowed, 404, 400): shown, flush goes on.
 */
export type FailureOutcome = 'retry' | 'auth' | 'conflict' | 'failed';

export interface ClassifiedFailure {
  outcome: FailureOutcome;
  error?: OperationError;
}

export function classifyFailure(err: unknown): ClassifiedFailure {
  if (err instanceof NetworkError) return { outcome: 'retry' };
  if (err instanceof UnexpectedResponseError) return { outcome: 'retry' };
  // The pinned transport refused the server before any byte was sent: keep
  // the operations for the new pairing of the same desktop (same scope).
  if (err instanceof CertificateMismatchError) return { outcome: 'retry' };
  if (err instanceof UnauthorizedError) {
    return { outcome: 'auth', error: { status: 401, type: 'unauthorized' } };
  }
  if (err instanceof ProblemError) {
    const error: OperationError = { status: err.status, type: err.type };
    // The same key is still running on the server (a send interrupted by a
    // killed app, replayed at start): wait for its answer with the same key;
    // a conflict would invite a "riprova" with a new key, applying it twice.
    if (err.type === 'idempotency_in_progress') return { outcome: 'retry', error };
    // Core 1.1.1: the request lost a race with another change of the same
    // data; the core did not store the answer, so the same key tries again.
    // The next flush (interval, foreground, reconnection) comes after
    // `retry_after` (a few seconds).
    if (err.type === 'concurrent_update') return { outcome: 'retry', error };
    if (err.status === 409 || err.status === 412 || err.status === 422) {
      return { outcome: 'conflict', error };
    }
    // 425/429 and server errors: try again later. A 401 without the core's
    // problem body (captive portal, proxy) is not a revocation either.
    if (err.status === 401 || err.status === 408 || err.status === 425 || err.status === 429) {
      return { outcome: 'retry', error };
    }
    // 501 not_implemented: this instance lacks the feature, retrying cannot help.
    if (err.status >= 500 && err.status !== 501) return { outcome: 'retry', error };
    return { outcome: 'failed', error };
  }
  // A programming error in a sender: keep it visible, never drop it.
  return { outcome: 'failed', error: { type: 'unknown' } };
}
