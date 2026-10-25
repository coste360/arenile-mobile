import { createApiClient, request } from '@/api/client';
import {
  CertificateMismatchError,
  LanTransportUnavailableError,
  NetworkError,
  ProblemError,
  UnauthorizedError,
  UnexpectedResponseError,
} from '@/api/errors';
import {
  DEVICE,
  fakeFetch,
  fakePinnedFetch,
  json,
  LAN_FINGERPRINT,
  meta,
  networkDown,
  problem,
  RENEWED_FINGERPRINT,
} from '@/test/fake-fetch';

import {
  createPinnedFetch,
  NATIVE_ERROR_CODES,
  type PinnedFetchNativeModule,
} from '../../modules/pinned-fetch';

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

  it('refuses pinned instances when the build has no pinned transport (ADR 0006)', () => {
    const f = fakeFetch({});
    expect(() =>
      createApiClient({
        baseUrl: BASE,
        fingerprint: LAN_FINGERPRINT,
        fetch: f.fetch,
        pinnedFetch: null,
      }),
    ).toThrow(LanTransportUnavailableError);
    expect(f.calls).toHaveLength(0);
  });
});

describe('desktop LAN instance (pinned transport, ADR 0006)', () => {
  const LAN = 'https://192.168.1.20:8443';

  it('sends every request through the pinned transport, never the platform fetch', async () => {
    const server = fakeFetch({ 'GET /api/device/v1/self': () => json(200, DEVICE) });
    const platform = fakeFetch({});
    const pinned = fakePinnedFetch(server.fetch, LAN_FINGERPRINT);
    const client = createApiClient({
      baseUrl: LAN,
      token: 'ar_dev_x',
      fingerprint: LAN_FINGERPRINT.toLowerCase(),
      fetch: platform.fetch,
      pinnedFetch: pinned.pinnedFetch,
    });

    const device = await request(() => client.GET('/api/device/v1/self'));

    expect(device.id).toBe(DEVICE.id);
    expect(pinned.pins).toEqual([LAN_FINGERPRINT]);
    expect(server.calls[0]?.headers.get('Authorization')).toBe('Bearer ar_dev_x');
    expect(platform.calls).toHaveLength(0);
  });

  it('reports a renewed certificate as CertificateMismatchError, not as unreachable', async () => {
    const server = fakeFetch({ 'GET /api/device/v1/self': () => json(200, DEVICE) });
    const pinned = fakePinnedFetch(server.fetch, RENEWED_FINGERPRINT);
    const client = createApiClient({
      baseUrl: LAN,
      token: 'ar_dev_x',
      fingerprint: LAN_FINGERPRINT,
      pinnedFetch: pinned.pinnedFetch,
    });

    const err = await request(() => client.GET('/api/device/v1/self')).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CertificateMismatchError);
    expect(server.calls).toHaveLength(0);
  });

  describe('with the module adapter and a mocked native module', () => {
    const native = (fetchImpl: PinnedFetchNativeModule['fetch']): PinnedFetchNativeModule => ({
      fetch: jest.fn(fetchImpl),
      cancel: jest.fn(async () => {}),
    });
    const client = (module: PinnedFetchNativeModule, timeoutMs?: number) =>
      createApiClient({
        baseUrl: LAN,
        token: 'ar_dev_x',
        fingerprint: LAN_FINGERPRINT,
        pinnedFetch: createPinnedFetch(module),
        timeoutMs,
      });

    it('parses the JSON answer of the native module', async () => {
      const module = native(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(meta({ edition: 'desktop' })),
        url: `${LAN}/api/admin/v1/meta`,
      }));
      const m = await request(() => client(module).GET('/api/admin/v1/meta'));
      expect(m.edition).toBe('desktop');
      expect(module.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ fingerprint: LAN_FINGERPRINT, method: 'GET' }),
      );
    });

    it.each([
      [NATIVE_ERROR_CODES.certificateMismatch, CertificateMismatchError],
      [NATIVE_ERROR_CODES.network, NetworkError],
    ])('maps the native rejection %s', async (code, type) => {
      const module = native(() => Promise.reject(Object.assign(new Error(code), { code })));
      const err = await request(() => client(module).GET('/api/admin/v1/meta')).catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(type);
    });

    it('cancels the native request on timeout', async () => {
      const module = native(() => new Promise(() => {}));
      const err = await request(() => client(module, 20).GET('/api/admin/v1/meta')).catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(NetworkError);
      expect(err).toMatchObject({ reason: 'timeout' });
      expect(module.cancel).toHaveBeenCalledTimes(1);
    });
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
    ['an HTML page (captive portal)', () => new Response('<html>Login</html>', { status: 401 })],
    ['an empty body (proxy auth)', () => new Response(null, { status: 401 })],
    ['another problem type', () => problem(401, 'invalid_credentials')],
  ])('does not treat a 401 with %s as a revoked token', async (_name, handler) => {
    const err = await call(handler).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProblemError);
    expect(err).not.toBeInstanceOf(UnauthorizedError);
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
