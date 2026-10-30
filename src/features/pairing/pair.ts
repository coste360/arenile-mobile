// Pairing: exchanges a pairing code for a device token (spec 29.2), with the
// same steps as the core desktop client (internal/desktop/remote/pair.go):
//   1. self-signed desktop LAN instances go through the pinned transport and
//      are refused when this build has none (ADR 0006);
//   2. GET /api/admin/v1/meta: is it Arenile, is it compatible both ways;
//   3. POST /api/device/v1/pair with the code: 201 gives the token (ar_dev_…);
//   4. best effort: read the establishment name when the QR did not carry it.
// "Prova la demo" (ADR 0015) runs the same steps against the demo instance of
// Coste360, with a code minted by POST /api/device/v1/demo-pairing after 2.
// Pure orchestration: transport, clock and versions are injected.
import { createApiClient, request } from '@/api/client';
import {
  CertificateMismatchError,
  LanTransportUnavailableError,
  NetworkError,
  ProblemError,
  UnexpectedResponseError,
} from '@/api/errors';
import type { PinnedFetch } from '@/api/transport';
import type { DevicePlatform, Meta } from '@/api/types';
import { checkCompatibility, type Versions } from '@/features/instance/compat';
import type { Session } from '@/features/session/session';
import type { Clock } from '@/lib/clock';

import { normalizePairingCode, type PairingTarget } from './target';

export type PairingFailure =
  | 'lan_unsupported'
  | 'certificate_mismatch'
  | 'unreachable'
  | 'not_arenile'
  | 'instance_too_old'
  | 'app_too_old'
  | 'pairing_unavailable'
  | 'demo_unavailable'
  | 'demo_rate_limited'
  | 'code_invalid'
  | 'rate_limited'
  | 'unexpected';

export class PairingError extends Error {
  override readonly name = 'PairingError';
  constructor(
    readonly reason: PairingFailure,
    options?: { cause?: unknown },
  ) {
    super(`pairing failed: ${reason}`, options);
  }
}

export interface DeviceInfo {
  /** Shown in the panel (Configurazione -> Dispositivi), at most 80 characters. */
  name: string;
  platform: Extract<DevicePlatform, 'ios' | 'android' | 'other'>;
}

export interface PairDeps {
  versions: Versions;
  device: DeviceInfo;
  clock: Clock;
  fetch?: typeof fetch;
  /** Pinned transport for LAN instances (undefined: the native module of this build). */
  pinnedFetch?: PinnedFetch | null;
}

export interface Paired {
  session: Session;
  meta: Meta;
}

const MAX_DEVICE_NAME = 80;
const TOKEN_SCHEME = 'ar_dev_';

function deviceName(raw: string): string {
  const name = raw.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  return [...(name || 'Arenile mobile')].slice(0, MAX_DEVICE_NAME).join('');
}

function failureOf(e: unknown, step: 'meta' | 'demo' | 'pair'): PairingFailure {
  if (e instanceof CertificateMismatchError) return 'certificate_mismatch';
  if (e instanceof NetworkError) return 'unreachable';
  if (e instanceof UnexpectedResponseError) return step === 'meta' ? 'not_arenile' : 'unexpected';
  if (e instanceof ProblemError) {
    if (step === 'meta') return e.status === 404 ? 'not_arenile' : 'unexpected';
    // 404: the instance is not (or no longer) configured as a demo (core ADR 0027).
    if (step === 'demo' && e.status === 404) return 'demo_unavailable';
    // Hourly limits of the demo (per client network and in total), not the pairing one.
    if (step === 'demo' && e.status === 429) return 'demo_rate_limited';
    if (e.status === 400 && e.type === 'pairing_code_invalid') return 'code_invalid';
    if (e.status === 429) return 'rate_limited';
    if (e.status === 501 || e.type === 'lan_mode_required') return 'pairing_unavailable';
  }
  return 'unexpected';
}

type ApiClient = ReturnType<typeof createApiClient>;

export function pairDevice(target: PairingTarget, deps: PairDeps): Promise<Paired> {
  return pair(target, async () => target.code, deps);
}

/**
 * "Prova la demo": pairs with the demo establishment of `url`, with a fresh
 * single-use code from the instance instead of one typed or scanned.
 */
export async function pairDemo(url: string, deps: PairDeps): Promise<Paired> {
  try {
    return await pair({ url }, (client) => demoCode(client), deps);
  } catch (e) {
    // Problems of the demo instance, not of an instance the user manages.
    if (e instanceof PairingError && DEMO_DOWN.includes(e.reason)) {
      throw new PairingError('demo_unavailable', { cause: e });
    }
    throw e;
  }
}

const DEMO_DOWN: readonly PairingFailure[] = [
  'not_arenile',
  'instance_too_old',
  'pairing_unavailable',
];

async function demoCode(client: ApiClient): Promise<string> {
  let minted;
  try {
    minted = await request(() => client.POST('/api/device/v1/demo-pairing'));
  } catch (e) {
    throw new PairingError(failureOf(e, 'demo'), { cause: e });
  }
  const code = typeof minted?.code === 'string' ? normalizePairingCode(minted.code) : null;
  if (!code) throw new PairingError('unexpected');
  return code;
}

async function pair(
  target: Omit<PairingTarget, 'code'>,
  codeFor: (client: ApiClient) => Promise<string>,
  deps: PairDeps,
): Promise<Paired> {
  let client;
  try {
    client = createApiClient({
      baseUrl: target.url,
      fingerprint: target.fingerprint,
      fetch: deps.fetch,
      pinnedFetch: deps.pinnedFetch,
    });
  } catch (e) {
    if (e instanceof LanTransportUnavailableError)
      throw new PairingError('lan_unsupported', { cause: e });
    throw e;
  }

  let meta: Meta;
  try {
    meta = await request(() => client.GET('/api/admin/v1/meta'));
  } catch (e) {
    throw new PairingError(failureOf(e, 'meta'), { cause: e });
  }
  if (typeof meta !== 'object' || meta === null) throw new PairingError('not_arenile');
  const compat = checkCompatibility(meta, deps.versions);
  if (!compat.ok) throw new PairingError(compat.reason);
  if (meta.capabilities?.device_pairing === false) throw new PairingError('pairing_unavailable');

  const code = await codeFor(client);
  const name = deviceName(deps.device.name);
  let result;
  try {
    result = await request(() =>
      client.POST('/api/device/v1/pair', {
        body: {
          code,
          name,
          platform: deps.device.platform,
          kind: 'mobile',
          app_version: deps.versions.app,
        },
      }),
    );
  } catch (e) {
    throw new PairingError(failureOf(e, 'pair'), { cause: e });
  }
  if (!result?.token?.startsWith(TOKEN_SCHEME) || !result.device?.id) {
    throw new PairingError('unexpected');
  }

  const session: Session = {
    v: 1,
    instanceUrl: target.url,
    token: result.token,
    deviceId: result.device.id,
    deviceName: result.device.name || name,
    establishmentId: result.establishment_id,
    pairedAt: deps.clock.now().toISOString(),
  };
  if (target.fingerprint) session.fingerprint = target.fingerprint;
  if (target.establishmentName) {
    session.establishmentName = target.establishmentName;
  } else {
    session.establishmentName = await establishmentName(session, deps);
  }
  return { session, meta };
}

/** Best effort: the name is cosmetic, a failure must not undo a successful pairing. */
async function establishmentName(
  session: Session,
  deps: Pick<PairDeps, 'fetch' | 'pinnedFetch'>,
): Promise<string | undefined> {
  try {
    const client = createApiClient({
      baseUrl: session.instanceUrl,
      token: session.token,
      fingerprint: session.fingerprint,
      fetch: deps.fetch,
      pinnedFetch: deps.pinnedFetch,
    });
    const est = await request(() =>
      client.GET('/api/admin/v1/establishments/{establishmentId}', {
        params: { path: { establishmentId: session.establishmentId } },
      }),
    );
    return est.name || undefined;
  } catch {
    return undefined;
  }
}
