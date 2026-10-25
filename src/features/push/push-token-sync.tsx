// Keeps the instance's copy of the native push token current: when the OS
// renews the token of a device that is registered, it is registered again
// with the same topics and language. Does nothing for a device that has not
// turned push on, or when the instance does not offer push (/meta).
import { useEffect, useRef } from 'react';

import { registerPush } from '@/api/push-adapter';
import { useInstanceMeta } from '@/features/session/queries';
import { useApiClient, useSession } from '@/features/session/session-provider';
import { errorKind } from '@/lib/log';

import { usePushNative, usePushStatus } from './push';

/** Renders nothing; mount once inside the providers. */
export function PushTokenSync() {
  const { state } = useSession();
  return state.status === 'paired' ? <PairedPushTokenSync /> : null;
}

function PairedPushTokenSync() {
  const native = usePushNative();
  const meta = useInstanceMeta();
  const offered = !!native && meta.data?.capabilities.push_notifications === true;
  const status = usePushStatus(offered);
  const client = useApiClient();
  const registration = status.data?.registered ? status.data : undefined;
  const latest = useRef(registration);
  useEffect(() => {
    latest.current = registration;
  }, [registration]);

  useEffect(() => {
    if (!native || !registration) return;
    return native.onTokenChange((token) => {
      const current = latest.current;
      if (!current) return;
      registerPush(client, {
        token,
        environment: native.environment,
        locale: current.locale ?? 'it',
        topics: current.topics,
      }).catch((e: unknown) => console.warn('push: token renewal not sent', errorKind(e)));
    });
    // Subscribe while registered; the ref carries the latest topics and language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, client, !!registration]);

  return null;
}
