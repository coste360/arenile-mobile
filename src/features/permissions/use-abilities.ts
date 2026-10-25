import { useMemo } from 'react';

import { useMe } from '@/features/auth/queries';
import { useCurrentDevice, useEstablishment } from '@/features/session/queries';
import { usePairedSession } from '@/features/session/session-provider';

import { resolveAbilities, type Abilities } from './permissions';

/**
 * What the paired user may do on the establishment (spec 16.1), for hiding
 * actions. Works offline from the cached /auth/me, /device/v1/self and
 * establishment. The server checks again: handle `isForbidden(error)` (api/errors) with
 * the "non consentito" message.
 */
export function useAbilities(): Abilities {
  const { establishmentId } = usePairedSession();
  const me = useMe();
  const device = useCurrentDevice();
  const establishment = useEstablishment();
  return useMemo(
    () =>
      resolveAbilities({
        me: me.data,
        role: device.data?.role,
        establishmentId,
        organizationId: establishment.data?.organization_id,
      }),
    [me.data, device.data?.role, establishmentId, establishment.data?.organization_id],
  );
}
