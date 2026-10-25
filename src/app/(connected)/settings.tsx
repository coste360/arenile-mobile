import { UnplugIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DetailRow } from '@/components/detail-row';
import { Screen } from '@/components/layout/screen';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';
import { useOfflineQueue, useOfflineStatus } from '@/features/offline/offline-provider';
import type { LanguagePreference, ThemePreference } from '@/features/preferences/preferences';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useCurrentDevice, useEstablishment, useUnpair } from '@/features/session/queries';
import { usePairedSession, useSession } from '@/features/session/session-provider';
import { SUPPORTED_LOCALES } from '@/i18n';
import { useDependencies } from '@/providers/dependencies';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];

/** Settings: instance and device facts, language, theme, unpairing. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { preferences, locale, setLanguage, setTheme } = usePreferences();
  const session = usePairedSession();
  const { appVersion } = useDependencies();
  const device = useCurrentDevice();
  const establishment = useEstablishment();
  const name =
    establishment.data?.name ?? session.establishmentName ?? t('home.establishmentFallback');
  const pairedAt = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
    new Date(session.pairedAt),
  );

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.instance.title')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <DetailRow label={t('settings.instance.establishment')} value={name} />
          <DetailRow label={t('settings.instance.address')} value={session.instanceUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.device.title')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <DetailRow
            label={t('settings.device.name')}
            value={device.data?.name ?? session.deviceName}
          />
          {device.data ? (
            <>
              <DetailRow label={t('settings.device.user')} value={device.data.user_name} />
              <DetailRow label={t('settings.device.role')} value={t(`roles.${device.data.role}`)} />
            </>
          ) : null}
          <DetailRow label={t('settings.device.pairedAt')} value={pairedAt} />
        </CardContent>
      </Card>

      <ChoiceCard
        title={t('settings.language.title')}
        value={preferences.language}
        onChange={(v) => setLanguage(v as LanguagePreference)}
        options={[
          { value: 'system', label: t('settings.language.system') },
          ...SUPPORTED_LOCALES.map((l) => ({ value: l, label: t(`languages.${l}`) })),
        ]}
      />

      <ChoiceCard
        title={t('settings.theme.title')}
        value={preferences.theme}
        onChange={(v) => setTheme(v as ThemePreference)}
        options={THEMES.map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.about.title')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <DetailRow label={t('settings.about.version')} value={appVersion} />
          <Text variant="muted">{t('settings.about.privacy')}</Text>
        </CardContent>
      </Card>

      <UnpairDialog establishmentName={name} />
    </Screen>
  );
}

function ChoiceCard({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={value} onValueChange={onChange} accessibilityLabel={title}>
          {options.map((o) => (
            <View key={o.value} className="min-h-11 flex-row items-center gap-3">
              <RadioGroupItem value={o.value} aria-labelledby={`choice-${o.value}`} />
              <Label nativeID={`choice-${o.value}`} onPress={() => onChange(o.value)}>
                {o.label}
              </Label>
            </View>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

/** Longest wait for the pending operations to be sent before unpairing. */
const FLUSH_BEFORE_UNPAIR_MS = 5_000;

/**
 * "Scollega dispositivo": sends what is still queued while the token is
 * valid, revokes the token on the instance, then forgets it. When the
 * instance is unreachable the user may forget it on this device only.
 * Operations not sent yet are deleted with the session: the dialog says how
 * many, so they are never lost silently.
 */
function UnpairDialog({ establishmentName }: { establishmentName: string }) {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const unpair = useUnpair();
  const { flush } = useOfflineQueue();
  const status = useOfflineStatus();
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const offline = unpair.isError;
  const busy = unpair.isPending || preparing;
  const unsent = status.pending + status.conflicts + status.failed;

  const confirm = () => {
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FLUSH_BEFORE_UNPAIR_MS));
    setPreparing(true);
    void Promise.race([flush().catch(() => undefined), timeout]).then(() => {
      setPreparing(false);
      unpair.mutate();
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) unpair.reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="lg">
          <Icon as={UnplugIcon} size={18} />
          <Text>{t('settings.unpair.button')}</Text>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {offline ? t('settings.unpair.offlineTitle') : t('settings.unpair.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {offline
              ? t('settings.unpair.offlineDescription')
              : t('settings.unpair.description', { name: establishmentName })}
          </AlertDialogDescription>
          {unsent > 0 ? (
            <Text className="text-destructive" role="alert">
              {t('settings.unpair.pendingWarning', { count: unsent })}
            </Text>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            <Text>{t('common.cancel')}</Text>
          </AlertDialogCancel>
          {offline ? (
            <Button variant="destructive" onPress={() => void signOut('unpaired')}>
              <Text>{t('settings.unpair.forceConfirm')}</Text>
            </Button>
          ) : (
            <Button variant="destructive" disabled={busy} onPress={confirm}>
              <Text>{busy ? t('settings.unpair.working') : t('settings.unpair.confirm')}</Text>
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
