import { fixedClock } from '@/lib/clock';
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
  type Handler,
} from '@/test/fake-fetch';

import { pairDemo, pairDevice, PairingError, type PairDeps } from './pair';
import type { PairingTarget } from './target';

const TARGET: PairingTarget = {
  url: 'https://lido.example.it',
  code: 'ABCDEFGH',
  establishmentName: 'Lido Azzurro',
};

const PAIR_RESULT = {
  token: 'ar_dev_abcd1234_secret',
  device: DEVICE,
  establishment_id: DEVICE.establishment_id,
};

function deps(
  routes: Record<string, Handler>,
  lanServerFingerprint?: string,
): PairDeps & { calls: Request[] } {
  const f = fakeFetch(routes);
  return {
    versions: { app: '1.0.0', minInstance: '1.0.0' },
    device: { name: 'iPhone di Anna', platform: 'ios' },
    clock: fixedClock('2026-10-25T08:00:00Z'),
    fetch: f.fetch,
    pinnedFetch: lanServerFingerprint
      ? fakePinnedFetch(f.fetch, lanServerFingerprint).pinnedFetch
      : null,
    calls: f.calls,
  };
}

const okRoutes: Record<string, Handler> = {
  'GET /api/admin/v1/meta': () => json(200, meta()),
  'POST /api/device/v1/pair': () => json(201, PAIR_RESULT),
};

async function failure(target: PairingTarget, d: PairDeps) {
  const err = await pairDevice(target, d).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(PairingError);
  return (err as PairingError).reason;
}

describe('pairDevice', () => {
  it('checks /meta, exchanges the code and returns the session', async () => {
    const d = deps(okRoutes);

    const { session, meta: m } = await pairDevice(TARGET, d);

    expect(session).toEqual({
      v: 1,
      instanceUrl: 'https://lido.example.it',
      token: 'ar_dev_abcd1234_secret',
      deviceId: DEVICE.id,
      deviceName: 'iPhone di Anna',
      establishmentId: DEVICE.establishment_id,
      establishmentName: 'Lido Azzurro',
      pairedAt: '2026-10-25T08:00:00.000Z',
    });
    expect(m.version).toBe('1.0.1');
    expect(d.calls.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      'GET /api/admin/v1/meta',
      'POST /api/device/v1/pair',
    ]);
    const pair = d.calls[1];
    expect(pair?.headers.has('Authorization')).toBe(false);
    expect(await pair?.json()).toEqual({
      code: 'ABCDEFGH',
      name: 'iPhone di Anna',
      platform: 'ios',
      kind: 'mobile',
      app_version: '1.0.0',
    });
  });

  it('reads the establishment name with the new token when the QR has none', async () => {
    const d = deps({
      ...okRoutes,
      [`GET /api/admin/v1/establishments/${DEVICE.establishment_id}`]: (req) =>
        req.headers.get('Authorization') === 'Bearer ar_dev_abcd1234_secret'
          ? json(200, { id: DEVICE.establishment_id, name: 'Bagni Marina' })
          : problem(401, 'unauthorized'),
    });

    const { session } = await pairDevice({ url: TARGET.url, code: TARGET.code }, d);

    expect(session.establishmentName).toBe('Bagni Marina');
  });

  it('keeps a successful pairing when the establishment name cannot be read', async () => {
    const d = deps({
      ...okRoutes,
      [`GET /api/admin/v1/establishments/${DEVICE.establishment_id}`]: () =>
        problem(403, 'forbidden'),
    });

    const { session } = await pairDevice({ url: TARGET.url, code: TARGET.code }, d);

    expect(session.token).toBe('ar_dev_abcd1234_secret');
    expect(session.establishmentName).toBeUndefined();
  });

  it('trims and caps the device name', async () => {
    const d = deps(okRoutes);
    d.device = { name: `  ${'x'.repeat(100)}\n`, platform: 'android' };

    await pairDevice(TARGET, d);

    const body = await d.calls[1]?.json();
    expect(body.name).toHaveLength(80);
    expect(body.platform).toBe('android');
  });

  it.each<[string, Record<string, Handler>, string]>([
    ['instance unreachable', { 'GET /api/admin/v1/meta': networkDown }, 'unreachable'],
    [
      'not Arenile (404 on /meta)',
      { 'GET /api/admin/v1/meta': () => problem(404, 'not_found') },
      'not_arenile',
    ],
    [
      'not Arenile (HTML on /meta)',
      {
        'GET /api/admin/v1/meta': () =>
          new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
      },
      'not_arenile',
    ],
    [
      'instance too old',
      { ...okRoutes, 'GET /api/admin/v1/meta': () => json(200, meta({ version: '0.9.0' })) },
      'instance_too_old',
    ],
    [
      'app too old',
      {
        ...okRoutes,
        'GET /api/admin/v1/meta': () =>
          json(200, meta({ min_client_versions: { mobile: '2.0.0', desktop: '0.1.0' } })),
      },
      'app_too_old',
    ],
    [
      'pairing switched off (desktop without LAN)',
      {
        ...okRoutes,
        'GET /api/admin/v1/meta': () =>
          json(200, meta({ capabilities: { ...meta().capabilities, device_pairing: false } })),
      },
      'pairing_unavailable',
    ],
    [
      'invalid, expired or used code',
      { ...okRoutes, 'POST /api/device/v1/pair': () => problem(400, 'pairing_code_invalid') },
      'code_invalid',
    ],
    [
      'rate limited',
      { ...okRoutes, 'POST /api/device/v1/pair': () => problem(429, 'rate_limited') },
      'rate_limited',
    ],
    [
      'pairing not implemented',
      { ...okRoutes, 'POST /api/device/v1/pair': () => problem(501, 'not_implemented') },
      'pairing_unavailable',
    ],
    [
      'network drop during the exchange',
      { ...okRoutes, 'POST /api/device/v1/pair': networkDown },
      'unreachable',
    ],
    [
      'server error',
      { ...okRoutes, 'POST /api/device/v1/pair': () => problem(500, 'internal_error') },
      'unexpected',
    ],
    [
      'answer without a device token',
      {
        ...okRoutes,
        'POST /api/device/v1/pair': () => json(201, { ...PAIR_RESULT, token: 'nope' }),
      },
      'unexpected',
    ],
  ])('fails with a typed reason: %s', async (_name, routes, reason) => {
    expect(await failure(TARGET, deps(routes))).toBe(reason);
  });

  describe('desktop LAN instance (ADR 0006)', () => {
    const LAN: PairingTarget = {
      url: 'https://192.168.1.20:8443',
      code: 'ABCDEFGH',
      fingerprint: LAN_FINGERPRINT,
    };
    const lanRoutes: Record<string, Handler> = {
      ...okRoutes,
      'GET /api/admin/v1/meta': () => json(200, meta({ edition: 'desktop' })),
      [`GET /api/admin/v1/establishments/${DEVICE.establishment_id}`]: () =>
        json(200, { id: DEVICE.establishment_id, name: 'Lido Sirena' }),
    };

    it('pairs through the pinned transport and keeps the fingerprint in the session', async () => {
      const d = deps(lanRoutes, LAN_FINGERPRINT);

      const { session } = await pairDevice(LAN, d);

      expect(session).toMatchObject({
        instanceUrl: 'https://192.168.1.20:8443',
        fingerprint: LAN_FINGERPRINT,
        establishmentName: 'Lido Sirena',
      });
      expect(d.calls.map((r) => r.method)).toEqual(['GET', 'POST', 'GET']);
    });

    it('never sends the code to a server with another certificate', async () => {
      const d = deps(lanRoutes, RENEWED_FINGERPRINT);

      expect(await failure(LAN, d)).toBe('certificate_mismatch');
      expect(d.calls).toHaveLength(0);
    });

    it('refuses it without any request when the build has no pinned transport', async () => {
      const d = deps(lanRoutes);

      expect(await failure(LAN, d)).toBe('lan_unsupported');
      expect(d.calls).toHaveLength(0);
    });
  });

  it('never sends the code when the instance is incompatible', async () => {
    const d = deps({
      ...okRoutes,
      'GET /api/admin/v1/meta': () => json(200, meta({ version: '0.1.0' })),
    });

    await failure(TARGET, d);

    expect(d.calls.some((r) => r.method === 'POST')).toBe(false);
  });

  describe('"Prova la demo" (ADR 0015, core ADR 0027)', () => {
    const DEMO_URL = 'https://demo.example.it';
    const DEMO_CODE = {
      code: 'WXYZ-2345',
      expires_at: '2026-10-25T08:05:00Z',
      establishment_id: DEVICE.establishment_id,
      user_id: DEVICE.user_id,
      qr_payload: { v: 1, url: DEMO_URL, code: 'WXYZ-2345' },
      qr_text: 'arenile://pair?d=x',
    };
    const demoRoutes: Record<string, Handler> = {
      ...okRoutes,
      'POST /api/device/v1/demo-pairing': () => json(201, DEMO_CODE),
      [`GET /api/admin/v1/establishments/${DEVICE.establishment_id}`]: () =>
        json(200, { id: DEVICE.establishment_id, name: 'Lido Demo' }),
    };

    async function demoFailure(d: PairDeps) {
      const err = await pairDemo(DEMO_URL, d).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PairingError);
      return (err as PairingError).reason;
    }

    it('checks /meta, asks the demo instance for a code and exchanges it', async () => {
      const d = deps(demoRoutes);

      const { session } = await pairDemo(DEMO_URL, d);

      expect(session).toMatchObject({
        instanceUrl: DEMO_URL,
        token: 'ar_dev_abcd1234_secret',
        establishmentName: 'Lido Demo',
      });
      expect(d.calls.map((r) => `${r.method} ${r.url}`)).toEqual([
        `GET ${DEMO_URL}/api/admin/v1/meta`,
        `POST ${DEMO_URL}/api/device/v1/demo-pairing`,
        `POST ${DEMO_URL}/api/device/v1/pair`,
        `GET ${DEMO_URL}/api/admin/v1/establishments/${DEVICE.establishment_id}`,
      ]);
      expect((await d.calls[2]?.json()).code).toBe('WXYZ2345');
    });

    it('asks for no code when the instance is incompatible', async () => {
      const d = deps({
        ...demoRoutes,
        'GET /api/admin/v1/meta': () => json(200, meta({ version: '0.1.0' })),
      });

      expect(await demoFailure(d)).toBe('demo_unavailable');
      expect(d.calls.some((r) => r.method === 'POST')).toBe(false);
    });

    it.each<[string, Handler, string]>([
      ['not a demo instance (404)', () => problem(404, 'not_found'), 'demo_unavailable'],
      ['hourly demo limit reached (429)', () => problem(429, 'rate_limited'), 'demo_rate_limited'],
      ['network drop', networkDown, 'unreachable'],
      ['server error', () => problem(500, 'internal_error'), 'unexpected'],
      ['malformed code', () => json(201, { ...DEMO_CODE, code: 'nope' }), 'unexpected'],
    ])('fails with a typed reason: %s', async (_name, handler, reason) => {
      const d = deps({ ...demoRoutes, 'POST /api/device/v1/demo-pairing': handler });

      expect(await demoFailure(d)).toBe(reason);
      expect(d.calls.some((r) => r.url.endsWith('/api/device/v1/pair'))).toBe(false);
    });

    it.each<[string, Record<string, Handler>, string]>([
      [
        'not Arenile',
        { 'GET /api/admin/v1/meta': () => problem(404, 'not_found') },
        'demo_unavailable',
      ],
      [
        'pairing switched off',
        {
          'GET /api/admin/v1/meta': () =>
            json(200, meta({ capabilities: { ...meta().capabilities, device_pairing: false } })),
        },
        'demo_unavailable',
      ],
      [
        'app too old for the demo',
        {
          'GET /api/admin/v1/meta': () =>
            json(200, meta({ min_client_versions: { mobile: '2.0.0', desktop: '0.1.0' } })),
        },
        'app_too_old',
      ],
      [
        'pairing limit after a minted code (429 on /pair)',
        { 'POST /api/device/v1/pair': () => problem(429, 'rate_limited') },
        'rate_limited',
      ],
    ])('reads problems of the demo instance as the demo: %s', async (_name, routes, reason) => {
      expect(await demoFailure(deps({ ...demoRoutes, ...routes }))).toBe(reason);
    });
  });
});
