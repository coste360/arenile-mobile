// Idempotency-Key of the online mutations (core spec 17.1, middleware
// Idempotency): the core stores every answer below 500 for 24 hours and
// replays it to a request with the same key and body. So a key must be
// reused only when the previous attempt may not have been answered (a lost
// answer must not apply the operation twice), and dropped after any stored
// answer: otherwise a refusal (cash session closed, spot taken, 403...) would
// be replayed to every retry of the same request, even after its cause was fixed.
import { useMemo, useRef } from 'react';

import {
  CertificateMismatchError,
  NetworkError,
  ProblemError,
  UnauthorizedError,
  UnexpectedResponseError,
} from '@/api/errors';

/**
 * True when a retry of the failed request must carry the same key: the
 * outcome is unknown (no network, timeout, a non-JSON answer from something
 * in between, a desktop certificate that changed) or the core did not store
 * an answer (5xx, 429/425/408, a 401 that is not the core's, the same key
 * still being processed). False after an answer the core stored for replay.
 */
export function keepsIdempotencyKey(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (err instanceof UnexpectedResponseError) return true;
  if (err instanceof CertificateMismatchError) return true;
  if (err instanceof UnauthorizedError) return false;
  if (err instanceof ProblemError) {
    if (err.type === 'idempotency_in_progress') return true;
    if (err.status === 401 || err.status === 408 || err.status === 425 || err.status === 429) {
      return true;
    }
    return err.status >= 500;
  }
  return false;
}

export interface IdempotencyKeys {
  /** The key of `request` (a serialised request): the same until settled, a new one for another request. */
  keyFor(request: string): string;
  /** Call when the attempt ended (TanStack `onSettled`): keeps the key only when the outcome is unknown. */
  settled(error: unknown): void;
}

/** One stable key per request across retries, for a mutation hook. */
export function useIdempotencyKeys(randomId: () => string): IdempotencyKeys {
  const last = useRef<{ request: string; key: string } | null>(null);
  return useMemo(
    () => ({
      keyFor(request) {
        if (last.current?.request !== request) last.current = { request, key: randomId() };
        return last.current.key;
      },
      settled(error) {
        if (error === null || error === undefined || !keepsIdempotencyKey(error)) {
          last.current = null;
        }
      },
    }),
    [randomId],
  );
}
