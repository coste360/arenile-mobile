import { NetworkError, ProblemError, UnexpectedResponseError } from '@/api/errors';
import type { BookingStatus, Problem, Role } from '@/api/types';
import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { bookingDetail, customer } from '@/test/operations-fixtures';

import {
  ShareSheetError,
  canShareSummary,
  canVerifyRequirement,
  shareable,
  shareErrorKey,
  verifyErrorKey,
} from './sheet-actions';

const problem = (status: number, type: string) =>
  new ProblemError(status, { type, title: type, status } as Problem);

describe('who shares the summary and verifies the requirement (bookings.write)', () => {
  it.each<[Role, boolean]>([
    ['owner', true],
    ['manager', true],
    ['cashier', true],
    ['beach_staff', false],
    ['viewer', false],
  ])('%s: %s', (role, expected) => {
    const abilities = abilitiesFrom(new Set(ROLE_PERMISSIONS[role]), true);
    expect(canShareSummary(abilities)).toBe(expected);
    expect(canVerifyRequirement(abilities)).toBe(expected);
  });
});

describe('shareable', () => {
  it.each<[BookingStatus, boolean]>([
    ['confirmed', true],
    ['checked_in', true],
    ['awaiting_approval', true],
    ['completed', true],
    ['cancelled', false],
    ['expired', false],
    ['rejected', false],
  ])('%s: %s', (status, expected) => {
    expect(shareable(bookingDetail({ status }))).toBe(expected);
  });

  it('not for an anonymised customer', () => {
    const anonymous = customer({ anonymized_at: '2026-10-01T00:00:00Z' });
    expect(shareable(bookingDetail({ customer: anonymous }))).toBe(false);
  });
});

describe('shareErrorKey', () => {
  it.each<[unknown, string]>([
    [new NetworkError('unreachable'), 'bookings.share.errors.offline'],
    [problem(403, 'forbidden'), 'bookings.share.errors.forbidden'],
    [new ShareSheetError(new Error('no activity')), 'bookings.share.errors.sheet'],
    [problem(404, 'not_found'), 'bookings.share.errors.not_found'],
    [problem(501, 'not_implemented'), 'bookings.share.errors.unavailable'],
    [problem(500, 'internal_error'), 'bookings.share.errors.default'],
    [new UnexpectedResponseError(200), 'bookings.share.errors.default'],
  ])('%s → %s', (error, want) => {
    expect(shareErrorKey(error)).toBe(want);
  });
});

describe('verifyErrorKey', () => {
  it.each<[unknown, string]>([
    [new NetworkError('timeout'), 'bookings.agreement.errors.offline'],
    [problem(403, 'forbidden'), 'bookings.agreement.errors.forbidden'],
    [problem(412, 'version_conflict'), 'bookings.agreement.errors.changed'],
    [problem(412, 'unknown'), 'bookings.agreement.errors.changed'],
    [problem(409, 'conflict'), 'bookings.agreement.errors.not_modifiable'],
    [problem(422, 'validation_failed'), 'bookings.agreement.errors.invalid'],
    [problem(400, 'bad_request'), 'bookings.agreement.errors.invalid'],
    [problem(404, 'not_found'), 'bookings.agreement.errors.not_found'],
    [problem(501, 'not_implemented'), 'bookings.agreement.errors.unavailable'],
    [problem(500, 'internal_error'), 'bookings.agreement.errors.default'],
  ])('%s → %s', (error, want) => {
    expect(verifyErrorKey(error)).toBe(want);
  });
});
