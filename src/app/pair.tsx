import { useMutation } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  CircleAlertIcon,
  Link2Icon,
  MonitorSmartphoneIcon,
  ShieldAlertIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { canPinCertificates } from '@/api/transport';
import { MIN_INSTANCE_VERSION } from '@/config/app';
import { pairDevice, PairingError, type PairingFailure } from '@/features/pairing/pair';
import { usePairingIntent } from '@/features/pairing/pairing-intent';
import {
  targetFromLinkData,
  type PairingTarget,
  type TargetError,
  type TargetResult,
} from '@/features/pairing/target';
import type { Session } from '@/features/session/session';
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
/** Only a new QR from the desktop app carries the new certificate fingerprint. */
const NEW_QR: readonly FailureReason[] = [...NEW_CODE, 'certificate_mismatch'];

/** Thrown when the keychain refuses the new session: the token is kept for a retry. */
class StorageError extends Error {
  constructor(
    readonly session: Session,
    options?: { cause?: unknown },
  ) {
    super('session not saved', options);
  }
}

const hostOf = (url: string) => url.replace(/^https?:\/\//, '');

/**
 * Pairing in progress and its outcomes. Reached from the in-app scanner and
 * manual form (target handed over in memory, pairing starts at once) and from
 * the link `arenile://pair?d=…` opened by the system camera or any other app
 * (pairing starts only after the user confirms the instance address).
 */
export default function PairScreen() {
  const { t } = useTranslation();
  const deps = useDependencies();
  const intent = usePairingIntent();
  const { state, signIn } = useSession();
  const params = useLocalSearchParams<{ d?: string }>();

  const [request] = useState<{ target: TargetResult; fromApp: boolean }>(() => {
    const inApp = intent.peek();
    if (inApp) return { target: inApp, fromApp: true };
    if (params.d) return { target: targetFromLinkData(params.d), fromApp: false };
    return { target: { ok: false, error: 'invalid_input' }, fromApp: false };
  });
  useEffect(() => intent.clear(), [intent]);
  const target = request.target;
  const [confirmed, setConfirmed] = useState(request.fromApp);

  const mutation = useMutation({
    mutationFn: async ({ t, saved }: { t: PairingTarget; saved: Session | null }) => {
      // A code is single use: after a keychain failure retry only the save.
      const session =
        saved ??
        (
          await pairDevice(t, {
            versions: { app: deps.appVersion, minInstance: MIN_INSTANCE_VERSION },
            device: deps.device,
            clock: deps.clock,
            fetch: deps.fetch,
            pinnedFetch: deps.pinnedFetch,
          })
        ).session;
      try {
        // Still pending while the session is saved: no "already paired" flash.
        await signIn(session);
      } catch (e) {
        throw new StorageError(session, { cause: e });
      }
    },
  });

  const unpaired = state.status === 'unpaired';
  const lanOnly = target.ok && !!target.target.fingerprint && !canPinCertificates(deps.pinnedFetch);
  const started = useRef<string | null>(null);
  const { mutate } = mutation;
  useEffect(() => {
    if (!target.ok || !unpaired || !confirmed || lanOnly) return;
    if (started.current === target.target.code) return;
    started.current = target.target.code;
    mutate({ t: target.target, saved: null });
  }, [target, unpaired, confirmed, lanOnly, mutate]);

  if (state.status === 'paired' && (mutation.isPending || mutation.isSuccess)) {
    return <Redirect href="/home" />;
  }

  let reason: FailureReason | null = null;
  if (state.status === 'paired') reason = 'already_paired';
  else if (!target.ok) reason = target.error;
  else if (lanOnly) reason = 'lan_unsupported';
  else if (mutation.isError) {
    reason = mutation.error instanceof PairingError ? mutation.error.reason : 'storage';
  }

  if (!reason && target.ok && !confirmed) {
    return (
      <Screen className="flex-1">
        <StateView
          icon={Link2Icon}
          title={t('pair.confirm.title')}
          description={t('pair.confirm.description', { host: hostOf(target.target.url) })}
        >
          {target.target.establishmentName ? (
            <Text className="text-center text-muted-foreground">
              {t('pair.confirm.establishment', { name: target.target.establishmentName })}
            </Text>
          ) : null}
          <Button size="lg" onPress={() => setConfirmed(true)}>
            <Text>{t('pair.confirm.accept')}</Text>
          </Button>
          <Button size="lg" variant="ghost" onPress={() => router.replace('/connect')}>
            <Text>{t('common.cancel')}</Text>
          </Button>
        </StateView>
      </Screen>
    );
  }

  if (!reason) {
    const where = target.ok ? (target.target.establishmentName ?? hostOf(target.target.url)) : '';
    return (
      <Screen className="flex-1">
        <StateView busy title={t('pair.progress', { target: where })} />
      </Screen>
    );
  }

  const name =
    state.status === 'paired' ? (state.session.establishmentName ?? state.session.instanceUrl) : '';
  const manualUrl = target.ok ? target.target.url : undefined;
  const retry = () => {
    if (!target.ok) return;
    const saved = mutation.error instanceof StorageError ? mutation.error.session : null;
    mutate({ t: target.target, saved });
  };

  return (
    <Screen className="flex-1">
      <StateView
        icon={
          reason === 'lan_unsupported'
            ? MonitorSmartphoneIcon
            : reason === 'certificate_mismatch'
              ? ShieldAlertIcon
              : CircleAlertIcon
        }
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
          <Button size="lg" onPress={retry}>
            <Text>{t('pair.actions.retry')}</Text>
          </Button>
        ) : null}
        {NEW_QR.includes(reason) ? (
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
