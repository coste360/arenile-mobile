// In-memory fake of fetch for unit tests (no network). Routes are keyed by
// "METHOD /path"; a handler returns a Response, throws to simulate a network
// failure, or returns a never-settling promise to simulate a hang.
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
