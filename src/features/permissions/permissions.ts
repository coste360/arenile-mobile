// Role rules of the panel (core spec 16.1), so that features hide what the
// role cannot do. The server stays the only judge: a hidden action is a
// courtesy, a 403 `forbidden` is shown as "non consentito".
//
// Mirrors internal/domain/auth/roles.go (the matrix) and the panel's
// grantedPermissions (web/admin/src/features/operations/lib/permissions.ts).
// The permissions the server reports in /auth/me win; the matrix is only the
// fallback when /auth/me is not available (offline before the first load)
// and the device's role (/device/v1/self) is known.
import type { Me, Permission, Role } from '@/api/types';

/** Every permission, in the order of the core matrix. */
export const PERMISSIONS: readonly Permission[] = [
  'establishment.configure',
  'users.manage',
  'payments.configure',
  'bookings.write',
  'cash.operate',
  'refunds.issue',
  'operations.run',
  'bookings.read',
  'reports.read',
];

/** The permission matrix of spec 16.1 (internal/domain/auth/roles.go). */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  owner: PERMISSIONS,
  manager: [
    'establishment.configure',
    'bookings.write',
    'cash.operate',
    'refunds.issue',
    'operations.run',
    'bookings.read',
    'reports.read',
  ],
  cashier: ['bookings.write', 'cash.operate', 'operations.run', 'bookings.read'],
  beach_staff: ['operations.run', 'bookings.read'],
  viewer: ['bookings.read', 'reports.read'],
};

/** True when `role` grants `permission`; unknown roles grant nothing. */
export function roleCan(role: Role | undefined, permission: Permission): boolean {
  return !!role && (ROLE_PERMISSIONS[role]?.includes(permission) ?? false);
}

/**
 * Permissions granted on the establishment by the memberships in /auth/me: a
 * membership naming the establishment, or naming none (organization-wide)
 * when the organization matches. The organization may be unknown offline:
 * then only memberships naming the establishment count.
 */
export function grantedPermissions(
  me: Me | undefined,
  establishment: { id: string; organizationId?: string },
): Set<Permission> {
  const granted = new Set<Permission>();
  if (!me) return granted;
  for (const m of me.memberships) {
    const applies = m.establishment_id
      ? m.establishment_id === establishment.id
      : !!establishment.organizationId && m.organization_id === establishment.organizationId;
    if (applies) for (const p of m.permissions) granted.add(p);
  }
  return granted;
}

/**
 * What the staff app may offer (phase 1 operations), each with the
 * permission the core checks in its domain service:
 *
 * | Action                         | Permission       | Core check                       |
 * | ------------------------------ | ---------------- | -------------------------------- |
 * | See map, bookings, customers   | bookings.read    | booking.Service.Get/List         |
 * | Check-in                       | operations.run   | booking.Service.CheckIn          |
 * | Release a pass day / revoke it | operations.run   | pass.Service releases            |
 * | Block / unblock a spot         | operations.run   | spot blocks                      |
 * | Add a note                     | bookings.write   | booking.Service.AddNote          |
 * | Quick cash collection          | cash.operate     | payment.Service.RecordManual     |
 * | Create / move a booking        | bookings.write   | booking.Service.Create/Move      |
 * | See takings and reports        | cash.operate or reports.read |                      |
 * | Essential reports (phase 3)    | reports.read     | report endpoints (spec 15.3)     |
 */
export interface Abilities {
  /** Permissions are known (from /auth/me or the device role). */
  known: boolean;
  canViewBookings: boolean;
  canCheckIn: boolean;
  canReleaseDay: boolean;
  canBlockSpot: boolean;
  canAddNote: boolean;
  canCollectCash: boolean;
  canWriteBookings: boolean;
  canSeeTakings: boolean;
  /** Reports of takings and occupancy: owner, manager, viewer (spec 16.1). */
  canSeeReports: boolean;
  has(permission: Permission): boolean;
}

export function abilitiesFrom(granted: ReadonlySet<Permission>, known: boolean): Abilities {
  const has = (p: Permission) => granted.has(p);
  return {
    known,
    canViewBookings: has('bookings.read'),
    canCheckIn: has('operations.run'),
    canReleaseDay: has('operations.run'),
    canBlockSpot: has('operations.run'),
    canAddNote: has('bookings.write'),
    canCollectCash: has('cash.operate'),
    canWriteBookings: has('bookings.write'),
    canSeeTakings: has('cash.operate') || has('reports.read'),
    canSeeReports: has('reports.read'),
    has,
  };
}

/**
 * Effective abilities: the server's permissions from /auth/me when loaded,
 * otherwise the matrix applied to the device's role, otherwise nothing
 * (every action hidden until the role is known).
 */
export function resolveAbilities(input: {
  me?: Me;
  role?: Role;
  establishmentId: string;
  organizationId?: string;
}): Abilities {
  if (input.me) {
    const granted = grantedPermissions(input.me, {
      id: input.establishmentId,
      organizationId: input.organizationId,
    });
    return abilitiesFrom(granted, true);
  }
  if (input.role) return abilitiesFrom(new Set(ROLE_PERMISSIONS[input.role] ?? []), true);
  return abilitiesFrom(new Set(), false);
}
