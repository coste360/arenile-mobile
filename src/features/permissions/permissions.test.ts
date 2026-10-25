import type { Me, Permission, Role } from '@/api/types';

import {
  grantedPermissions,
  PERMISSIONS,
  resolveAbilities,
  ROLE_PERMISSIONS,
  roleCan,
} from './permissions';

const EST = 'est-1';
const ORG = 'org-1';

const me = (memberships: Me['memberships']): Me => ({
  principal_type: 'user',
  memberships,
  totp_enrolment_required: false,
});

describe('ROLE_PERMISSIONS (spec 16.1, internal/domain/auth/roles.go)', () => {
  // Rows of the table in core spec 16.1, as in the Go matrix test.
  const table: [Permission, Role[]][] = [
    ['establishment.configure', ['owner', 'manager']],
    ['users.manage', ['owner']],
    ['payments.configure', ['owner']],
    ['bookings.write', ['owner', 'manager', 'cashier']],
    ['cash.operate', ['owner', 'manager', 'cashier']],
    ['refunds.issue', ['owner', 'manager']],
    ['operations.run', ['owner', 'manager', 'cashier', 'beach_staff']],
    ['bookings.read', ['owner', 'manager', 'cashier', 'beach_staff', 'viewer']],
    ['reports.read', ['owner', 'manager', 'viewer']],
  ];
  const roles: Role[] = ['owner', 'manager', 'cashier', 'beach_staff', 'viewer'];

  it('covers every permission', () => {
    expect(table.map(([p]) => p)).toEqual(PERMISSIONS);
  });

  it.each(table)('%s is granted to %j only', (permission, allowed) => {
    for (const role of roles) {
      expect(roleCan(role, permission)).toBe(allowed.includes(role));
      expect(ROLE_PERMISSIONS[role].includes(permission)).toBe(allowed.includes(role));
    }
  });

  it('grants nothing to an unknown role', () => {
    expect(roleCan('intern' as Role, 'bookings.read')).toBe(false);
    expect(roleCan(undefined, 'bookings.read')).toBe(false);
  });
});

describe('grantedPermissions', () => {
  it.each([
    [
      'membership on the establishment',
      [
        {
          organization_id: ORG,
          establishment_id: EST,
          role: 'cashier',
          permissions: ['cash.operate'],
        },
      ],
      ORG,
      ['cash.operate'],
    ],
    [
      'membership on another establishment',
      [
        {
          organization_id: ORG,
          establishment_id: 'est-2',
          role: 'owner',
          permissions: ['cash.operate'],
        },
      ],
      ORG,
      [],
    ],
    [
      'organization-wide membership',
      [{ organization_id: ORG, role: 'manager', permissions: ['bookings.write'] }],
      ORG,
      ['bookings.write'],
    ],
    [
      'organization-wide membership, organization unknown offline',
      [{ organization_id: ORG, role: 'manager', permissions: ['bookings.write'] }],
      undefined,
      [],
    ],
    [
      'organization-wide membership of another organization',
      [{ organization_id: 'org-2', role: 'manager', permissions: ['bookings.write'] }],
      ORG,
      [],
    ],
  ] as const)('%s', (_name, memberships, organizationId, expected) => {
    const granted = grantedPermissions(me(memberships as unknown as Me['memberships']), {
      id: EST,
      organizationId,
    });
    expect([...granted].sort()).toEqual([...expected].sort());
  });
});

describe('resolveAbilities', () => {
  it('uses the server permissions when /auth/me is loaded', () => {
    // A custom set (e.g. a future core change) wins over the role matrix.
    const a = resolveAbilities({
      me: me([
        {
          organization_id: ORG,
          establishment_id: EST,
          role: 'beach_staff',
          permissions: ['bookings.read'],
        },
      ]),
      role: 'beach_staff',
      establishmentId: EST,
      organizationId: ORG,
    });
    expect(a.known).toBe(true);
    expect(a.canViewBookings).toBe(true);
    expect(a.canCheckIn).toBe(false);
  });

  it.each([
    // role, check-in, release, block, note, cash, write, takings
    ['owner', true, true, true, true, true, true, true],
    ['manager', true, true, true, true, true, true, true],
    ['cashier', true, true, true, true, true, true, true],
    ['beach_staff', true, true, true, false, false, false, false],
    ['viewer', false, false, false, false, false, false, true],
  ] as const)(
    'falls back to the matrix for %s',
    (role, checkIn, release, block, note, cash, write, takings) => {
      const a = resolveAbilities({ role, establishmentId: EST });
      expect(a).toMatchObject({
        known: true,
        canViewBookings: true,
        canCheckIn: checkIn,
        canReleaseDay: release,
        canBlockSpot: block,
        canAddNote: note,
        canCollectCash: cash,
        canWriteBookings: write,
        canSeeTakings: takings,
      });
    },
  );

  it('hides everything while the role is unknown', () => {
    const a = resolveAbilities({ establishmentId: EST });
    expect(a.known).toBe(false);
    expect(a.canViewBookings).toBe(false);
    expect(a.has('bookings.read')).toBe(false);
  });
});
