// In-memory fake of fetch for unit tests (no network). Routes are keyed by
// "METHOD /path"; a handler returns a Response, throws to simulate a network
// failure, or returns a never-settling promise to simulate a hang.
import { normalizeFingerprint, PinnedFetchError, type PinnedFetch } from '@/api/transport';
import type { Meta } from '@/api/types';

export type Handler = (request: Request) => Response | Promise<Response>;

export interface FakeFetch {
  fetch: typeof fetch;
  /** Requests received, in order. */
  calls: Request[];
}

export function fakeFetch(routes: Record<string, Handler>): FakeFetch {
  const calls: Request[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    calls.push(request);
    const key = `${request.method} ${new URL(request.url).pathname}`;
    const handler = routes[key];
    if (!handler) return problem(404, 'not_found');
    return handler(request);
  };
  return { fetch: impl as typeof fetch, calls };
}

/** Fingerprint of the desktop LAN certificate in the fixtures (core desktop.Fingerprint format). */
export const LAN_FINGERPRINT =
  '83:A9:D2:70:46:86:36:88:87:C6:F1:DE:C5:48:09:77:90:72:ED:6D:FC:BD:49:D5:D0:A8:FD:B8:F4:B2:09:7D';
/** The same server after the 30-day renewal: a different certificate. */
export const RENEWED_FINGERPRINT = LAN_FINGERPRINT.replace('83:A9', '5E:17');

export interface FakePinnedFetch {
  pinnedFetch: PinnedFetch;
  /** Fingerprints the app expected, one per request. */
  pins: string[];
}

/**
 * Fake of the native pinned transport: a desktop LAN server presenting the
 * certificate `serverFingerprint`. Requests pinned to another fingerprint fail
 * like the native module does (no HTTP exchange); matching ones reach `fetch`.
 */
export function fakePinnedFetch(
  fetchImpl: typeof fetch,
  serverFingerprint: string,
): FakePinnedFetch {
  const pins: string[] = [];
  const pinnedFetch: PinnedFetch = async (request, fingerprint) => {
    pins.push(fingerprint);
    if (normalizeFingerprint(fingerprint) !== normalizeFingerprint(serverFingerprint)) {
      throw new PinnedFetchError('certificate_mismatch');
    }
    return fetchImpl(request);
  };
  return { pinnedFetch, pins };
}

export const json = (status: number, body: unknown, contentType = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });

export const problem = (status: number, type: string, title = type) =>
  json(status, { type, title, status }, 'application/problem+json');

export const networkDown: Handler = () => {
  throw new TypeError('Network request failed');
};

export function meta(overrides: Partial<Meta> = {}): Meta {
  return {
    product: 'arenile',
    version: '1.0.1',
    api_version: '0.1.0',
    edition: 'server',
    server_time: '2026-10-25T08:00:00Z',
    min_client_versions: { mobile: '1.0.0', desktop: '0.1.0' },
    capabilities: {
      online_booking: true,
      online_payments: true,
      payment_providers: ['manual'],
      fiscal_drivers: [],
      device_pairing: true,
      fiscal_bridge: false,
      realtime: true,
      push_notifications: false,
    },
    features: ['bookings', 'cash', 'device_pairing'],
    ...overrides,
  };
}

export const DEVICE = {
  id: '0192f0a0-0000-7000-8000-000000000001',
  establishment_id: '0192f0a0-0000-7000-8000-0000000000e1',
  user_id: '0192f0a0-0000-7000-8000-0000000000u1',
  user_name: 'Anna',
  role: 'cashier',
  name: 'iPhone di Anna',
  platform: 'ios',
  kind: 'mobile',
  created_at: '2026-10-25T08:00:00Z',
  current: true,
  fiscal_bridge: false,
} as const;
