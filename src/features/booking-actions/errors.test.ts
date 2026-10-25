import { NetworkError, ProblemError, UnexpectedResponseError } from '@/api/errors';
import type { Problem } from '@/api/types';

import { onlineErrorKey } from './errors';

const problem = (status: number, type: string) =>
  new ProblemError(status, { type, title: type, status } as Problem);

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
