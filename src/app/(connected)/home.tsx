import {
  CircleAlertIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { isCertificateMismatch } from '@/api/errors';
import { DetailRow } from '@/components/detail-row';
import { Screen } from '@/components/layout/screen';
import { DayShortcuts } from '@/components/today/day-shortcuts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MIN_INSTANCE_VERSION } from '@/config/app';
import { checkCompatibility } from '@/features/instance/compat';
import { lanRenewal } from '@/features/instance/lan-certificate';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useCurrentDevice, useEstablishment, useInstanceMeta } from '@/features/session/queries';
import { usePairedSession, useSession } from '@/features/session/session-provider';
import { useDependencies } from '@/providers/dependencies';

/**
 * Home of a paired device: which establishment, who is connected, whether
 * the instance is reachable and compatible. Validates the token on launch
 * (GET /device/v1/self; a 401 signs out) and reads /meta. On a desktop LAN
 * instance it also warns before the certificate renewal and, once the
 * certificate is no longer the pinned one, asks to pair again (ADR 0006).
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const session = usePairedSession();
  const { signOut } = useSession();
  const { appVersion, clock } = useDependencies();
  const device = useCurrentDevice();
  const meta = useInstanceMeta();
  const establishment = useEstablishment();

  const name =
    establishment.data?.name ?? session.establishmentName ?? t('home.establishmentFallback');
  const compat = meta.data
    ? checkCompatibility(meta.data, { app: appVersion, minInstance: MIN_INSTANCE_VERSION })
    : null;
  const certificateChanged = [device.error, meta.error, establishment.error].some(
    isCertificateMismatch,
  );
  const renewal = lanRenewal(meta.data, !!session.fingerprint, clock.now());
  const checking = device.isFetching && !device.isError;
  const online = device.isSuccess && !device.isError;
  const checkedAt = device.dataUpdatedAt
    ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
        device.dataUpdatedAt,
      )
    : null;

  const refresh = () => {
    void device.refetch();
    void meta.refetch();
    void establishment.refetch();
  };

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="h2" className="border-b-0 pb-0" role="heading">
          {name}
        </Text>
        {device.data ? (
          <Text className="text-muted-foreground">
            {t('home.connectedAs', {
              name: device.data.user_name,
              role: t(`roles.${device.data.role}`),
            })}
          </Text>
        ) : null}
      </View>

      {certificateChanged ? (
        <View className="gap-3">
          <Alert icon={ShieldAlertIcon} variant="destructive">
            <AlertTitle>{t('home.lanCertificate.mismatchTitle')}</AlertTitle>
            <AlertDescription>{t('home.lanCertificate.mismatchDescription')}</AlertDescription>
          </Alert>
          <Button onPress={() => void signOut('certificate_changed')}>
            <Text>{t('home.lanCertificate.pairAgain')}</Text>
          </Button>
        </View>
      ) : renewal ? (
        <Alert icon={ShieldCheckIcon}>
          <AlertTitle>{t('home.lanCertificate.renewalTitle')}</AlertTitle>
          <AlertDescription>
            {renewal.status === 'due'
              ? t('home.lanCertificate.renewalDueDescription')
              : t('home.lanCertificate.renewalDescription', {
                  date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
                    renewal.renewsAt,
                  ),
                })}
          </AlertDescription>
        </Alert>
      ) : null}

      {compat && !compat.ok ? (
        <Alert icon={CircleAlertIcon} variant="destructive">
          <AlertTitle>{t(`pair.errors.${compat.reason}.title`)}</AlertTitle>
          <AlertDescription>
            {t(`pair.errors.${compat.reason}.description`, { min: MIN_INSTANCE_VERSION, name })}
          </AlertDescription>
        </Alert>
      ) : null}

      <DayShortcuts />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('home.connection.title')}</CardTitle>
          {checking ? (
            <ActivityIndicator
              className="text-muted-foreground"
              accessibilityLabel={t('home.connection.checking')}
            />
          ) : online ? (
            <Badge variant="secondary">
              <Icon as={WifiIcon} size={12} className="text-success" />
              <Text>{t('home.connection.online')}</Text>
            </Badge>
          ) : (
            <Badge variant="destructive">
              <Icon as={WifiOffIcon} size={12} />
              <Text>{t('home.connection.offline')}</Text>
            </Badge>
          )}
        </CardHeader>
        <CardContent className="gap-3">
          {device.isError && !certificateChanged ? (
            <Text className="text-muted-foreground">{t('home.connection.offlineHint')}</Text>
          ) : null}
          {checkedAt ? (
            <Text variant="muted">{t('home.connection.checkedAt', { time: checkedAt })}</Text>
          ) : null}
          <Button variant="outline" onPress={refresh} disabled={checking}>
            <Icon as={RefreshCwIcon} size={16} />
            <Text>{t('home.connection.refresh')}</Text>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.instance.title')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <DetailRow label={t('home.instance.address')} value={session.instanceUrl} />
          {meta.data ? (
            <>
              <DetailRow label={t('home.instance.version')} value={meta.data.version} />
              <DetailRow
                label={t('home.instance.edition')}
                value={t(`home.editions.${meta.data.edition}`)}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </Screen>
  );
}
