// Compatibility between this app and an instance, from GET /api/admin/v1/meta
// (spec 29.2): the app declares the minimum Arenile version it supports, the
// instance declares the minimum mobile app version it supports.
import type { Meta } from '@/api/types';
import { versionAtLeast } from '@/lib/version';

export type Incompatibility = 'not_arenile' | 'instance_too_old' | 'app_too_old';

export type Compatibility = { ok: true } | { ok: false; reason: Incompatibility };

export interface Versions {
  /** Version of this app. */
  app: string;
  /** Oldest instance version this app supports. */
  minInstance: string;
}

export function checkCompatibility(
  meta: Pick<Meta, 'product' | 'version' | 'min_client_versions'>,
  versions: Versions,
): Compatibility {
  if (meta.product !== 'arenile') return { ok: false, reason: 'not_arenile' };
  if (!versionAtLeast(meta.version, versions.minInstance))
    return { ok: false, reason: 'instance_too_old' };
  if (!versionAtLeast(versions.app, meta.min_client_versions?.mobile))
    return { ok: false, reason: 'app_too_old' };
  return { ok: true };
}
