// Optional push notifications (spec 03, core ADR 0027). Three consents:
// the server operator configures the Coste360 relay (/meta
// capabilities.push_notifications), the manager turns push on for the
// establishment (panel), and the user turns it on here, which asks the
// system permission and registers the native token with the instance.
// The relay only ever receives the native token and a key of a closed
// catalogue of generic texts: never customer data.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isForbidden, NetworkError, ProblemError, UnexpectedResponseError } from '@/api/errors';
import {
  getPushStatus,
  isPushUnavailable,
  PUSH_TOPICS,
  registerPush,
  unregisterPush,
  type PushLocale,
  type PushRegistrationInput,
  type PushRegistrationStatus,
  type PushTopic,
} from '@/api/push-adapter';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { useDependencies } from '@/providers/dependencies';

import type { PushNative } from './native';

export const pushKeys = {
  /** GET /api/device/v1/push of this device (online only, not persisted). */
  status: (deviceId: string) => ['device', 'push', deviceId] as const,
};

/** The relay's language for the UI language (Italian by default). */
export function pushLocale(locale: string): PushLocale {
  const base = locale.toLowerCase().split('-')[0];
  return base === 'en' || base === 'de' || base === 'fr' ? base : 'it';
}

/**
 * Topics to register: the chosen ones the server still allows, in catalogue
 * order. When turning on with no choice yet, every allowed topic.
 */
export function topicsToRegister(
  chosen: readonly PushTopic[] | undefined,
  allowed: readonly PushTopic[],
): PushTopic[] {
  const wanted = chosen ?? allowed;
  return PUSH_TOPICS.filter((t) => wanted.includes(t) && allowed.includes(t));
}

/** Toggles one topic in a selection, keeping the catalogue order. */
export function toggleTopic(selection: readonly PushTopic[], topic: PushTopic): PushTopic[] {
  const next = selection.includes(topic)
    ? selection.filter((t) => t !== topic)
    : [...selection, topic];
  return PUSH_TOPICS.filter((t) => next.includes(t));
}

/** Why push cannot be turned on yet, from the instance's answer. */
export type PushBlocker = 'relay' | 'establishment' | null;

export function pushBlocker(
  status: Pick<PushRegistrationStatus, 'relay_configured' | 'establishment_enabled'>,
): PushBlocker {
  if (!status.relay_configured) return 'relay';
  if (!status.establishment_enabled) return 'establishment';
  return null;
}

export class PushPermissionDeniedError extends Error {
  override readonly name = 'PushPermissionDeniedError';
  constructor() {
    super('push permission denied');
  }
}

export type PushErrorKey =
  | 'push.errors.permission'
  | 'push.errors.unavailable'
  | 'push.errors.offline'
  | 'push.errors.forbidden'
  | 'push.errors.token'
  | 'push.errors.default';

export function pushErrorKey(e: unknown): PushErrorKey {
  if (e instanceof PushPermissionDeniedError) return 'push.errors.permission';
  if (isPushUnavailable(e)) return 'push.errors.unavailable';
  if (e instanceof NetworkError) return 'push.errors.offline';
  if (isForbidden(e)) return 'push.errors.forbidden';
  if (
    e instanceof Error &&
    !(e instanceof ProblemError) &&
    !(e instanceof UnexpectedResponseError)
  ) {
    // A failure of the OS (no APNs entitlement, no Firebase configuration...).
    return 'push.errors.token';
  }
  return 'push.errors.default';
}

/** The registration of this device on the instance. */
export function usePushStatus(enabled: boolean) {
  const client = useApiClient();
  const { deviceId } = usePairedSession();
  return useQuery({
    queryKey: pushKeys.status(deviceId),
    queryFn: () => getPushStatus(client),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Registers (or re-registers with other topics) the native token:
 * permission first (asked only when not decided yet), then the token, then
 * PUT. A denied permission never reaches the instance.
 */
export function useRegisterPush(native: PushNative | undefined) {
  const qc = useQueryClient();
  const client = useApiClient();
  const { deviceId } = usePairedSession();
  return useMutation({
    mutationFn: async (input: {
      topics: PushTopic[];
      locale: PushLocale;
      channelName: string;
    }): Promise<PushRegistrationStatus> => {
      if (!native) throw new Error('push: not available on this device');
      let permission = await native.permission();
      if (permission === 'undetermined') {
        permission = await native.requestPermission(input.channelName);
      }
      if (permission !== 'granted') throw new PushPermissionDeniedError();
      const token = await native.deviceToken();
      const body: PushRegistrationInput = {
        token,
        environment: native.environment,
        locale: input.locale,
        topics: input.topics,
      };
      return registerPush(client, body);
    },
    onSuccess: (status) => qc.setQueryData(pushKeys.status(deviceId), status),
  });
}

/** Removes the registration: the instance stops sending to this device at once. */
export function useUnregisterPush() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { deviceId } = usePairedSession();
  return useMutation({
    mutationFn: () => unregisterPush(client),
    onSettled: () => qc.invalidateQueries({ queryKey: pushKeys.status(deviceId) }),
  });
}

/** The native push of this build, if any (absent on web, Expo Go without the module). */
export function usePushNative(): PushNative | undefined {
  return useDependencies().push;
}
