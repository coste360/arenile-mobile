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

/** Booking rules of the core (internal/domain/policy), as the panel words them. */
export const POLICY_VIOLATIONS = [
  'cutoff_passed',
  'duration_too_long',
  'duration_too_short',
  'formula_not_allowed',
  'lead_time_too_long',
  'lead_time_too_short',
  'same_day_closed',
  'start_weekday_not_allowed',
  'too_many_spots',
] as const;

export type PolicyViolationKey =
  `policy.violations.${(typeof POLICY_VIOLATIONS)[number]}` | 'policy.violations.other';

/**
 * The booking rules broken, each once: from a 422 policy_violation or from
 * the `policy.violations` of a quote. An unknown code reads as "another rule".
 */
export function violationKeys(
  violations: readonly { code: string }[] | undefined,
): PolicyViolationKey[] {
  const keys = (violations ?? []).map((v): PolicyViolationKey => {
    const code = POLICY_VIOLATIONS.find((c) => c === v.code);
    return code ? `policy.violations.${code}` : 'policy.violations.other';
  });
  return [...new Set(keys)];
}

/** Why a 422 policy_violation refused the request (`violations` of the problem). */
export function policyViolationKeys(e: unknown): PolicyViolationKey[] {
  if (!(e instanceof ProblemError) || e.type !== 'policy_violation') return [];
  return violationKeys(e.problem?.violations);
}
