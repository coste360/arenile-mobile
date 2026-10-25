import { operationErrorKey } from './labels';

describe('operationErrorKey', () => {
  it.each([
    [{ status: 409, type: 'cash_session_closed' }, 'offline.errors.cash_session_closed'],
    [{ status: 409, type: 'invalid_transition' }, 'offline.errors.invalid_transition'],
    [{ status: 403, type: 'forbidden' }, 'offline.errors.forbidden'],
    // A 403 without the core's problem body is still "not allowed".
    [{ status: 403, type: 'unknown' }, 'offline.errors.forbidden'],
    [{ type: 'other_establishment' }, 'offline.errors.other_establishment'],
    [{ status: 422, type: 'policy_violation' }, 'offline.errors.default'],
    [{ status: 400, type: 'unknown' }, 'offline.errors.default'],
  ] as const)('%j → %s', (error, key) => {
    expect(operationErrorKey(error)).toBe(key);
  });
});
