import { renderHook } from '@testing-library/react-native';

import {
  CertificateMismatchError,
  NetworkError,
  ProblemError,
  UnauthorizedError,
  UnexpectedResponseError,
} from '@/api/errors';
import type { Problem, ProblemType } from '@/api/types';

import { keepsIdempotencyKey, useIdempotencyKeys } from './idempotency';

const problem = (status: number, type: ProblemType) =>
  new ProblemError(status, { type, status, title: type } as Problem);

describe('keepsIdempotencyKey', () => {
  it.each<[string, unknown, boolean]>([
    ['no network', new NetworkError('unreachable'), true],
    ['timeout', new NetworkError('timeout'), true],
    ['captive portal answer', new UnexpectedResponseError(200), true],
    ['desktop certificate changed', new CertificateMismatchError(), true],
    ['server error (not stored)', problem(500, 'internal_error'), true],
    ['rate limited (not stored)', problem(429, 'rate_limited'), true],
    ['same key still running', problem(409, 'idempotency_in_progress'), true],
    ['401 of a proxy', new ProblemError(401, null), true],
    ['token revoked', new UnauthorizedError(401, null), false],
    ['spot taken (stored refusal)', problem(409, 'spot_unavailable'), false],
    ['cash session closed (stored refusal)', problem(409, 'cash_session_closed'), false],
    ['validation (stored refusal)', problem(422, 'validation_failed'), false],
    ['forbidden (stored refusal)', problem(403, 'forbidden'), false],
    ['not implemented (not stored)', problem(501, 'not_implemented'), true],
    ['programming error', new TypeError('boom'), false],
  ])('%s → %s', (_name, err, keep) => {
    expect(keepsIdempotencyKey(err)).toBe(keep);
  });
});

describe('useIdempotencyKeys', () => {
  async function setup() {
    let n = 0;
    const { result } = await renderHook(() => useIdempotencyKeys(() => `key-${++n}`));
    return result;
  }

  it('reuses the key of the same request after an unknown outcome', async () => {
    const keys = await setup();
    const first = keys.current.keyFor('sale A1');
    keys.current.settled(new NetworkError('timeout'));
    expect(keys.current.keyFor('sale A1')).toBe(first);
  });

  it('takes a new key after a stored refusal, so the retry is executed again', async () => {
    const keys = await setup();
    const first = keys.current.keyFor('sale A1');
    keys.current.settled(problem(409, 'cash_session_closed'));
    expect(keys.current.keyFor('sale A1')).not.toBe(first);
  });

  it('takes a new key after a success and for another request', async () => {
    const keys = await setup();
    const first = keys.current.keyFor('sale A1');
    keys.current.settled(null);
    const second = keys.current.keyFor('sale A1');
    expect(second).not.toBe(first);
    expect(keys.current.keyFor('sale A2')).not.toBe(second);
  });
});
