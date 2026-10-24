import { createApiClient, request } from '@/api/client';
import {
  LanTransportUnavailableError,
  NetworkError,
  ProblemError,
  UnauthorizedError,
  UnexpectedResponseError,
} from '@/api/errors';
import { DEVICE, fakeFetch, json, meta, networkDown, problem } from '@/test/fake-fetch';

const BASE = 'https://lido.example.it';

describe('createApiClient', () => {
  it('sends the device token as a bearer header to the instance', async () => {
    const f = fakeFetch({ 'GET /api/device/v1/self': () => json(200, DEVICE) });
    const client = createApiClient({ baseUrl: BASE, token: 'ar_dev_abc_secret', fetch: f.fetch });

    const device = await request(() => client.GET('/api/device/v1/self'));

    expect(device.name).toBe('iPhone di Anna');
    expect(f.calls[0]?.url).toBe(`${BASE}/api/device/v1/self`);
    expect(f.calls[0]?.headers.get('Authorization')).toBe('Bearer ar_dev_abc_secret');
    expect(f.calls[0]?.headers.get('Accept')).toBe('application/json');
  });

  it('sends no Authorization header without a token', async () => {
    const f = fakeFetch({ 'GET /api/admin/v1/meta': () => json(200, meta()) });
    const client = createApiClient({ baseUrl: BASE, fetch: f.fetch });

    await request(() => client.GET('/api/admin/v1/meta'));

    expect(f.calls[0]?.headers.has('Authorization')).toBe(false);
  });

  it('refuses instances that need certificate pinning (desktop LAN mode, ADR 0006)', () => {
    expect(() => createApiClient({ baseUrl: BASE, fingerprint: 'AA:BB' })).toThrow(
      LanTransportUnavailableError,
    );
  });
});

describe('request error mapping', () => {
  const call = (handler: Parameters<typeof fakeFetch>[0][string], timeoutMs?: number) => {
    const f = fakeFetch({ 'GET /api/device/v1/self': handler });
    const client = createApiClient({ baseUrl: BASE, token: 't', fetch: f.fetch, timeoutMs });
    return request(() => client.GET('/api/device/v1/self'));
  };

  it('maps 401 problem+json to UnauthorizedError', async () => {
    const err = await call(() => problem(401, 'unauthorized')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err).toMatchObject({ status: 401, type: 'unauthorized' });
  });

  it.each([
    [400, 'pairing_code_invalid'],
    [429, 'rate_limited'],
    [501, 'not_implemented'],
    [500, 'internal_error'],
  ])('maps %i %s to ProblemError with its slug', async (status, type) => {
    const err = await call(() => problem(status, type)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProblemError);
    expect(err).not.toBeInstanceOf(UnauthorizedError);
    expect(err).toMatchObject({ status, type });
  });

  it('maps a non-problem error body to type "unknown"', async () => {
    const err = await call(() => new Response('<html>Bad gateway</html>', { status: 502 })).catch(
      (e: unknown) => e,
    );
    expect(err).toMatchObject({ status: 502, type: 'unknown', problem: null });
  });

  it('maps a 2xx that is not JSON to UnexpectedResponseError', async () => {
    const err = await call(
      () =>
        new Response('<html>hello</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnexpectedResponseError);
  });

  it('maps a failed fetch to NetworkError unreachable', async () => {
    const err = await call(networkDown).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err).toMatchObject({ reason: 'unreachable' });
  });

  it('maps a hang to NetworkError timeout', async () => {
    const hang = (req: Request) =>
      new Promise<Response>((_resolve, reject) => {
        req.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const err = await call(hang, 20).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err).toMatchObject({ reason: 'timeout' });
  });
});
