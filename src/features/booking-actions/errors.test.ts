import { NetworkError, ProblemError, UnexpectedResponseError } from '@/api/errors';
import type { Problem } from '@/api/types';

import { onlineErrorKey, POLICY_VIOLATIONS, policyViolationKeys } from './errors';

const problem = (status: number, type: string) =>
  new ProblemError(status, { type, title: type, status } as Problem);

/** A 422 policy_violation as the core sends it, with the given violation codes. */
const violation = (...codes: string[]) =>
  new ProblemError(422, {
    type: 'policy_violation',
    title: 'policy_violation',
    status: 422,
    violations: codes.map((code) => ({ code })),
  } as Problem);

describe('onlineErrorKey', () => {
  it.each([
    [new NetworkError('unreachable'), 'operations.errors.offline'],
    [new NetworkError('timeout'), 'operations.errors.offline'],
    [problem(403, 'forbidden'), 'operations.errors.forbidden'],
    [new ProblemError(403, null), 'operations.errors.forbidden'],
    [problem(409, 'spot_unavailable'), 'operations.errors.spot_unavailable'],
    [problem(404, 'not_found'), 'operations.errors.not_found'],
    [problem(500, 'internal'), 'operations.errors.default'],
    [new UnexpectedResponseError(200), 'operations.errors.default'],
  ])('%s → %s', (error, want) => {
    expect(onlineErrorKey(error)).toBe(want);
  });
});

describe('policyViolationKeys', () => {
  it.each<[string, unknown, string[]]>([
    [
      'same day closed after the cut-off (seen live on a daily sale)',
      new ProblemError(422, {
        type: 'policy_violation',
        title: 'policy_violation',
        status: 422,
        violations: [{ code: 'same_day_closed', params: { reason: 'time' } }],
      } as Problem),
      ['policy.violations.same_day_closed'],
    ],
    [
      'two known rules, in the order of the core',
      violation('lead_time_too_short', 'too_many_spots'),
      ['policy.violations.lead_time_too_short', 'policy.violations.too_many_spots'],
    ],
    [
      'unknown code reads as another rule',
      violation('brand_new_rule'),
      ['policy.violations.other'],
    ],
    [
      'known and unknown codes',
      violation('cutoff_passed', 'brand_new_rule'),
      ['policy.violations.cutoff_passed', 'policy.violations.other'],
    ],
    [
      'the same rule twice is listed once',
      violation('duration_too_long', 'duration_too_long'),
      ['policy.violations.duration_too_long'],
    ],
    [
      'two unknown codes collapse into one "other"',
      violation('rule_a', 'rule_b'),
      ['policy.violations.other'],
    ],
    ['policy_violation with an empty list', violation(), []],
    ['policy_violation without violations', problem(422, 'policy_violation'), []],
    ['another problem type', problem(409, 'spot_unavailable'), []],
    ['a problem without body', new ProblemError(422, null), []],
    ['a network error', new NetworkError('unreachable'), []],
    ['a plain error', new Error('policy_violation'), []],
    ['not an error', { type: 'policy_violation', violations: [{ code: 'same_day_closed' }] }, []],
  ])('%s', (_name, e, want) => {
    expect(policyViolationKeys(e)).toEqual(want);
  });

  it.each(POLICY_VIOLATIONS)('maps the known rule %s to its own key', (code) => {
    expect(policyViolationKeys(violation(code))).toEqual([`policy.violations.${code}`]);
  });
});
