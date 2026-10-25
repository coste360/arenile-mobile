// Messages of the online-only operations (gate admission, spot blocks), from
// the typed errors of the API layer and the core's stable problem slugs.
import { isForbidden, NetworkError, ProblemError } from '@/api/errors';

export type OnlineErrorKey =
  | 'operations.errors.offline'
  | 'operations.errors.forbidden'
  | 'operations.errors.spot_unavailable'
  | 'operations.errors.not_found'
  | 'operations.errors.default';

export function onlineErrorKey(e: unknown): OnlineErrorKey {
  if (e instanceof NetworkError) return 'operations.errors.offline';
  if (isForbidden(e)) return 'operations.errors.forbidden';
  if (e instanceof ProblemError) {
    if (e.type === 'spot_unavailable') return 'operations.errors.spot_unavailable';
    if (e.status === 404) return 'operations.errors.not_found';
  }
  return 'operations.errors.default';
}
