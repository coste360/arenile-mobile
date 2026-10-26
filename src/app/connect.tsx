import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  KeyboardIcon,
  PlayIcon,
  QrCodeIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UnplugIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Screen } from '@/components/layout/screen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePairingIntent } from '@/features/pairing/pairing-intent';
import { useSession, type SignOutReason } from '@/features/session/session-provider';

const REASONS: readonly SignOutReason[] = ['revoked', 'unpaired', 'certificate_changed'];
const isReason = (value: string | undefined): value is SignOutReason =>
  REASONS.includes(value as SignOutReason);

/** Welcome / "Collega a un'istanza": the app has no default server, the user pairs it. */
export default function ConnectScreen() {
  const { t } = useTranslation();
  const { state } = useSession();
  const intent = usePairingIntent();
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  if (state.status === 'paired') return <Redirect href="/home" />;

  return (
    <Screen topInset className="max-w-lg flex-1 justify-center gap-6 self-center">
      <View className="items-center gap-4">
        <BrandMark />
        <Text variant="h1" role="heading">
          {t('connect.title')}
        </Text>
        <Text className="text-center text-muted-foreground">{t('connect.description')}</Text>
      </View>

      {isReason(reason) ? (
        <Alert
          icon={reason === 'certificate_changed' ? ShieldAlertIcon : UnplugIcon}
          variant={reason === 'unpaired' ? 'default' : 'destructive'}
        >
          <AlertTitle>{t(`connect.${reason}.title`)}</AlertTitle>
          <AlertDescription>{t(`connect.${reason}.description`)}</AlertDescription>
        </Alert>
      ) : null}

      <View className="gap-3">
        <Button size="lg" onPress={() => router.push('/scan')}>
          <Icon as={QrCodeIcon} size={18} />
          <Text>{t('connect.scan')}</Text>
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.push('/manual')}>
          <Icon as={KeyboardIcon} size={18} />
          <Text>{t('connect.manual')}</Text>
        </Button>
      </View>

      <View className="gap-2">
        <Button
          size="lg"
          variant="secondary"
          onPress={() => {
            intent.set('demo');
            router.push('/pair');
          }}
        >
          <Icon as={PlayIcon} size={18} />
          <Text>{t('connect.demo')}</Text>
        </Button>
        <Text variant="muted" className="text-center">
          {t('connect.demoHint')}
        </Text>
      </View>

      <View className="flex-row items-start gap-2">
        <Icon as={ShieldCheckIcon} size={16} className="mt-0.5 text-muted-foreground" />
        <Text variant="muted" className="flex-1">
          {t('connect.privacy')}
        </Text>
      </View>
    </Screen>
  );
}
