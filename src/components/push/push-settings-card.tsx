import { BellOffIcon, BellRingIcon, CircleAlertIcon, ShieldCheckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { PushTopic } from '@/api/push-adapter';
import { ChipRow, FilterChip } from '@/components/filter-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import type { PushNative } from '@/features/push/native';
import {
  pushBlocker,
  pushErrorKey,
  pushLocale,
  toggleTopic,
  topicsToRegister,
  usePushNative,
  usePushStatus,
  useRegisterPush,
  useUnregisterPush,
  type PushErrorKey,
} from '@/features/push/push';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useInstanceMeta } from '@/features/session/queries';
import { useDependencies } from '@/providers/dependencies';

/**
 * "Notifiche push" in the settings (spec 03): shown only when the instance
 * offers push (/meta capabilities.push_notifications) and this build has
 * the native module. Off until the user turns it on; the user picks the
 * topics among those the role allows.
 */
export function PushSettingsCard() {
  const native = usePushNative();
  const meta = useInstanceMeta();
  if (!native || meta.data?.capabilities.push_notifications !== true) return null;
  return <PushSettings native={native} />;
}

function PushSettings({ native }: { native: PushNative }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { openSystemSettings } = useDependencies();
  const { available: online } = useOnlineOnly();
  const status = usePushStatus(online);
  const register = useRegisterPush(native);
  const unregister = useUnregisterPush();
  const [selection, setSelection] = useState<PushTopic[] | undefined>();
  const [error, setError] = useState<PushErrorKey | null>(null);
  const busy = register.isPending || unregister.isPending;

  const s = status.data;
  const allowed = s?.allowed_topics ?? [];
  const chosen = topicsToRegister(selection ?? (s?.registered ? s.topics : undefined), allowed);
  const changed =
    !!s?.registered &&
    (chosen.length !== s.topics.length || chosen.some((topic) => !s.topics.includes(topic)));

  const save = async () => {
    setError(null);
    try {
      await register.mutateAsync({
        topics: chosen,
        locale: pushLocale(locale),
        channelName: t('push.channel'),
      });
      setSelection(undefined);
    } catch (e) {
      setError(pushErrorKey(e));
    }
  };
  const turnOff = async () => {
    setError(null);
    try {
      await unregister.mutateAsync();
      setSelection(undefined);
    } catch (e) {
      setError(pushErrorKey(e));
    }
  };

  const blocker = s ? pushBlocker(s) : null;

  return (
    <Card testID="push-settings">
      <CardHeader>
        <CardTitle role="heading">{t('push.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <View className="flex-row gap-2">
          <Icon as={ShieldCheckIcon} size={18} className="text-muted-foreground" />
          <Text variant="muted" className="flex-1">
            {t('push.privacy')}
          </Text>
        </View>

        {!s ? (
          status.isError ? (
            <View className="gap-2">
              <Text variant="muted">{t(pushErrorKey(status.error))}</Text>
              <Button variant="outline" onPress={() => void status.refetch()}>
                <Text>{t('common.retry')}</Text>
              </Button>
            </View>
          ) : !online ? (
            <Text variant="muted">{t('push.onlineOnly')}</Text>
          ) : (
            <Text variant="muted">{t('common.loading')}</Text>
          )
        ) : blocker ? (
          <Text variant="muted" accessibilityLiveRegion="polite">
            {t(blocker === 'relay' ? 'push.blocked.relay' : 'push.blocked.establishment')}
          </Text>
        ) : (
          <>
            <View
              className="flex-row items-center gap-2"
              accessible
              accessibilityLiveRegion="polite"
            >
              <Icon
                as={s.registered ? BellRingIcon : BellOffIcon}
                size={18}
                className={s.registered ? 'text-primary' : 'text-muted-foreground'}
              />
              <Text className="font-medium">{t(s.registered ? 'push.on' : 'push.off')}</Text>
            </View>
            {allowed.length > 0 ? (
              <ChipRow label={t('push.topicsLabel')} scroll={false}>
                {allowed.map((topic) => (
                  <FilterChip
                    key={topic}
                    label={t(`push.topics.${topic}`)}
                    selected={chosen.includes(topic)}
                    onPress={() => setSelection(toggleTopic(chosen, topic))}
                  />
                ))}
              </ChipRow>
            ) : (
              <Text variant="muted">{t('push.noTopics')}</Text>
            )}
            {chosen.length === 0 && allowed.length > 0 ? (
              <Text variant="muted">{t('push.pickTopic')}</Text>
            ) : null}
            {s.registered ? (
              <View className="gap-2">
                {changed ? (
                  <Button
                    disabled={busy || !online || chosen.length === 0}
                    onPress={() => void save()}
                  >
                    <Text>{t('push.saveTopics')}</Text>
                  </Button>
                ) : null}
                <Button variant="outline" disabled={busy || !online} onPress={() => void turnOff()}>
                  <Icon as={BellOffIcon} size={16} />
                  <Text>{t('push.turnOff')}</Text>
                </Button>
              </View>
            ) : (
              <Button disabled={busy || !online || chosen.length === 0} onPress={() => void save()}>
                <Icon as={BellRingIcon} size={16} className="text-primary-foreground" />
                <Text>{t('push.turnOn')}</Text>
              </Button>
            )}
          </>
        )}

        {error ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="assertive">
            <AlertDescription>{t(error)}</AlertDescription>
            {error === 'push.errors.permission' ? (
              <Button variant="link" className="self-start px-0" onPress={openSystemSettings}>
                <Text>{t('push.openSettings')}</Text>
              </Button>
            ) : null}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
