// Pairing: exchanges a pairing code for a device token (spec 29.2), with the
// same steps as the core desktop client (internal/desktop/remote/pair.go):
//   1. self-signed desktop LAN instances go through the pinned transport and
//      are refused when this build has none (ADR 0006);
//   2. GET /api/admin/v1/meta: is it Arenile, is it compatible both ways;
//   3. POST /api/device/v1/pair with the code: 201 gives the token (ar_dev_…);
//   4. best effort: read the establishment name when the QR did not carry it.
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

import type { PairingTarget } from './target';

export type PairingFailure =
  | 'lan_unsupported'
  | 'certificate_mismatch'
  | 'unreachable'
  | 'not_arenile'
  | 'instance_too_old'
  | 'app_too_old'
  | 'pairing_unavailable'
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

function failureOf(e: unknown, step: 'meta' | 'pair'): PairingFailure {
  if (e instanceof CertificateMismatchError) return 'certificate_mismatch';
  if (e instanceof NetworkError) return 'unreachable';
  if (e instanceof UnexpectedResponseError) return step === 'meta' ? 'not_arenile' : 'unexpected';
  if (e instanceof ProblemError) {
    if (step === 'meta') return e.status === 404 ? 'not_arenile' : 'unexpected';
    if (e.status === 400 && e.type === 'pairing_code_invalid') return 'code_invalid';
    if (e.status === 429) return 'rate_limited';
    if (e.status === 501 || e.type === 'lan_mode_required') return 'pairing_unavailable';
  }
  return 'unexpected';
}

export async function pairDevice(target: PairingTarget, deps: PairDeps): Promise<Paired> {
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

  const name = deviceName(deps.device.name);
  let result;
  try {
    result = await request(() =>
      client.POST('/api/device/v1/pair', {
        body: {
          code: target.code,
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
