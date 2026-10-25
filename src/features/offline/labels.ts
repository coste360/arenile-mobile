import type { OperationError } from './types';

/** Problem slugs (and local reasons) with their own explanation in offline.errors. */
const EXPLAINED = [
  'invalid_transition',
  'version_conflict',
  'conflict',
  'cash_session_closed',
  'booking_outside_period',
  'idempotency_key_reused',
  'validation_failed',
  'forbidden',
  'not_found',
  'not_implemented',
  'other_establishment',
  'unauthorized',
] as const;

type Explained = (typeof EXPLAINED)[number];

/**
 * i18n key explaining why an operation was refused, from the core's stable
 * problem slug (never from the title/detail text); a generic text otherwise.
 * A 403 without a problem body is still "not allowed".
 */
export function operationErrorKey(
  error: OperationError,
): `offline.errors.${Explained}` | 'offline.errors.default' {
  if ((EXPLAINED as readonly string[]).includes(error.type)) {
    return `offline.errors.${error.type as Explained}`;
  }
  if (error.status === 403) return 'offline.errors.forbidden';
  return 'offline.errors.default';
}
