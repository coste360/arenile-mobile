// The single factory of API clients (ADR 0002, ADR 0003): openapi-fetch on
// the types generated from the pinned core contract, base URL of the paired
// instance, device token as `Authorization: Bearer`, request timeout and
// mapping of every failure to the typed errors of ./errors.
// No cookies (spec 29.2): credentials are never sent implicitly.
import createClient, { type Client, type Middleware } from 'openapi-fetch';

import { errorForStatus, NetworkError, UnexpectedResponseError } from '@/api/errors';
import { selectTransport, type Transport } from '@/api/transport';
import type { paths } from '@/api/types';

export type ApiClient = Client<paths>;

export const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiClientOptions {
  /** scheme://host[:port] of the instance (normalised, see features/pairing/target). */
  baseUrl: string;
  /** Device token (ar_dev_…); omitted for the unauthenticated pairing calls. */
  token?: string;
  /** Certificate fingerprint from the pairing QR (desktop LAN mode). */
  fingerprint?: string;
  /** fetch implementation, for tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

class TimeoutAbort extends Error {}

function withTimeout(transport: Transport, timeoutMs: number): Transport {
  return async (request) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new TimeoutAbort()), timeoutMs);
    try {
      return await transport(new Request(request, { signal: controller.signal }));
    } catch (e) {
      if (controller.signal.aborted) throw new NetworkError('timeout', { cause: e });
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
}

function bearer(token: string): Middleware {
  return {
    onRequest({ request }) {
      request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  };
}

/**
 * Creates the client for one instance. Throws LanTransportUnavailableError
 * when the instance needs certificate pinning this build cannot do yet.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const transport = selectTransport({ fingerprint: options.fingerprint, fetch: options.fetch });
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    fetch: withTimeout(transport, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (options.token) client.use(bearer(options.token));
  return client;
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Runs one openapi-fetch call and returns its data, or throws a typed error:
 * NetworkError (unreachable, timeout), UnexpectedResponseError (2xx that is
 * not the expected JSON), UnauthorizedError (401), ProblemError (other non-2xx).
 */
export async function request<T>(call: () => Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await call();
  } catch (e) {
    if (e instanceof NetworkError) throw e;
    if (e instanceof SyntaxError) throw new UnexpectedResponseError(200);
    throw new NetworkError('unreachable', { cause: e });
  }
  if (result.response.ok) return result.data as T;
  throw errorForStatus(result.response.status, result.error);
}
