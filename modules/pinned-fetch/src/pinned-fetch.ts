// JavaScript side of the pinned transport: turns a fetch Request into a call
// to the native module and its answer back into a Response, propagating
// AbortSignal as a native cancellation. Pure: the native module is injected.
import { normalizeFingerprint } from './fingerprint';
import {
  NATIVE_ERROR_CODES,
  type NativePinnedResponse,
  type PinnedFetchNativeModule,
} from './PinnedFetch.types';

/** fetch-like function that reaches only a server presenting the pinned certificate. */
export type PinnedFetch = (request: Request, fingerprint: string) => Promise<Response>;

export type PinnedFetchErrorCode =
  'certificate_mismatch' | 'invalid_request' | 'aborted' | 'network';

/** Every failure of the pinned transport. */
export class PinnedFetchError extends Error {
  override readonly name = 'PinnedFetchError';
  constructor(
    readonly code: PinnedFetchErrorCode,
    options?: { cause?: unknown },
  ) {
    super(`pinned fetch failed: ${code}`, options);
  }
}

export interface PinnedFetchOptions {
  /** Native safety timeout in milliseconds (the API client aborts earlier). */
  timeoutMs?: number;
}

export const DEFAULT_NATIVE_TIMEOUT_MS = 60_000;

// Statuses whose Response must not carry a body (Fetch standard).
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

function codeOf(e: unknown): PinnedFetchErrorCode {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  switch (code) {
    case NATIVE_ERROR_CODES.certificateMismatch:
      return 'certificate_mismatch';
    case NATIVE_ERROR_CODES.invalidRequest:
      return 'invalid_request';
    case NATIVE_ERROR_CODES.cancelled:
      return 'aborted';
    default:
      return 'network';
  }
}

function toResponse(result: NativePinnedResponse): Response {
  const body = NULL_BODY_STATUSES.has(result.status) ? null : result.body;
  return new Response(body, {
    status: result.status,
    statusText: result.statusText,
    headers: result.headers,
  });
}

/** Builds the pinned fetch on top of a native module implementation. */
export function createPinnedFetch(
  native: PinnedFetchNativeModule,
  { timeoutMs = DEFAULT_NATIVE_TIMEOUT_MS }: PinnedFetchOptions = {},
): PinnedFetch {
  let sequence = 0;
  return async (request, fingerprint) => {
    const pinned = normalizeFingerprint(fingerprint);
    if (!pinned || !request.url.startsWith('https://'))
      throw new PinnedFetchError('invalid_request');
    const signal = request.signal;
    if (signal?.aborted) throw new PinnedFetchError('aborted');

    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      headers[name] = value;
    });
    const text = BODYLESS_METHODS.has(request.method) ? '' : await request.text();
    const id = String(++sequence);

    const call = native.fetch(id, {
      url: request.url,
      method: request.method,
      headers,
      body: text === '' ? null : text,
      fingerprint: pinned,
      timeoutMs,
    });

    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => {
        native.cancel(id).catch(() => {});
        reject(new PinnedFetchError('aborted'));
      };
      signal?.addEventListener('abort', onAbort);
    });
    try {
      const result = await Promise.race([call, aborted]);
      return toResponse(result);
    } catch (e) {
      if (e instanceof PinnedFetchError) throw e;
      throw new PinnedFetchError(codeOf(e), { cause: e });
    } finally {
      if (onAbort) signal?.removeEventListener('abort', onAbort);
      // A late native rejection after an abort must not surface as unhandled.
      call.catch(() => {});
    }
  };
}
