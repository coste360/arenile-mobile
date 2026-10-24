import { useMutation } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { CircleAlertIcon, MonitorSmartphoneIcon } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { MIN_INSTANCE_VERSION } from '@/config/app';
import { pairDevice, PairingError, type PairingFailure } from '@/features/pairing/pair';
import {
  targetFromLinkData,
  targetFromManual,
  type PairingTarget,
  type TargetError,
} from '@/features/pairing/target';
import { useSession } from '@/features/session/session-provider';
import { useDependencies } from '@/providers/dependencies';

type FailureReason = PairingFailure | TargetError | 'already_paired' | 'storage';

const RETRYABLE: readonly FailureReason[] = [
  'unreachable',
  'rate_limited',
  'unexpected',
  'storage',
];
const NEW_CODE: readonly FailureReason[] = ['code_invalid', 'invalid_input'];

/**
 * Pairing in progress and its outcomes. Reached from the scanner, the manual
 * form and the deep link `arenile://pair?d=…` (the system camera opens it).
 */
export default function PairScreen() {
  const { t } = useTranslation();
  const deps = useDependencies();
  const { state, signIn } = useSession();
  const params = useLocalSearchParams<{ d?: string; url?: string; code?: string }>();

  const target = useMemo(() => {
    if (params.d) return targetFromLinkData(params.d);
    if (params.url || params.code) return targetFromManual(params.url ?? '', params.code ?? '');
    return { ok: false as const, error: 'invalid_input' as const };
  }, [params.d, params.url, params.code]);

  const mutation = useMutation({
    mutationFn: async (t: PairingTarget) => {
      const { session } = await pairDevice(t, {
        versions: { app: deps.appVersion, minInstance: MIN_INSTANCE_VERSION },
        device: deps.device,
        clock: deps.clock,
        fetch: deps.fetch,
      });
      // Still pending while the session is saved: no "already paired" flash.
      await signIn(session);
    },
  });

  const unpaired = state.status === 'unpaired';
  useEffect(() => {
    if (target.ok && unpaired && mutation.isIdle) mutation.mutate(target.target);
  }, [target, unpaired, mutation]);

  if (state.status === 'paired' && (mutation.isPending || mutation.isSuccess)) {
    return <Redirect href="/home" />;
  }

  let reason: FailureReason | null = null;
  if (state.status === 'paired') reason = 'already_paired';
  else if (!target.ok) reason = target.error;
  else if (mutation.isError) {
    reason = mutation.error instanceof PairingError ? mutation.error.reason : 'storage';
  }

  if (!reason) {
    const where = target.ok
      ? (target.target.establishmentName ?? target.target.url.replace(/^https?:\/\//, ''))
      : '';
    return (
      <Screen className="flex-1">
        <StateView busy title={t('pair.progress', { target: where })} />
      </Screen>
    );
  }

  const name =
    state.status === 'paired' ? (state.session.establishmentName ?? state.session.instanceUrl) : '';
  const manualUrl = target.ok ? target.target.url : params.url;

  return (
    <Screen className="flex-1">
      <StateView
        icon={reason === 'lan_unsupported' ? MonitorSmartphoneIcon : CircleAlertIcon}
        tone={reason === 'lan_unsupported' ? 'default' : 'destructive'}
        title={t(`pair.errors.${reason}.title`)}
        description={t(`pair.errors.${reason}.description`, { min: MIN_INSTANCE_VERSION, name })}
      >
        {reason === 'already_paired' ? (
          <Button size="lg" onPress={() => router.replace('/home')}>
            <Text>{t('pair.actions.home')}</Text>
          </Button>
        ) : null}
        {RETRYABLE.includes(reason) && target.ok ? (
          <Button size="lg" onPress={() => mutation.mutate(target.target)}>
            <Text>{t('pair.actions.retry')}</Text>
          </Button>
        ) : null}
        {NEW_CODE.includes(reason) ? (
          <Button size="lg" onPress={() => router.replace('/scan')}>
            <Text>{t('pair.actions.scanAgain')}</Text>
          </Button>
        ) : null}
        {NEW_CODE.includes(reason) || reason === 'insecure_url' ? (
          <Button
            size="lg"
            variant="outline"
            onPress={() =>
              router.replace(
                manualUrl ? { pathname: '/manual', params: { url: manualUrl } } : '/manual',
              )
            }
          >
            <Text>{t('pair.actions.manual')}</Text>
          </Button>
        ) : null}
        {reason !== 'already_paired' ? (
          <Button size="lg" variant="ghost" onPress={() => router.replace('/connect')}>
            <Text>{t('pair.actions.start')}</Text>
          </Button>
        ) : null}
      </StateView>
    </Screen>
  );
}
