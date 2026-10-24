import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { CameraIcon, CameraOffIcon, KeyboardIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePairingIntent } from '@/features/pairing/pairing-intent';
import { decodeQR } from '@/features/pairing/qr';
import { targetFromQR } from '@/features/pairing/target';
import { useDependencies } from '@/providers/dependencies';

cssInterop(CameraView, { className: 'style' });

/** Scans the pairing QR with the camera; any other QR shows a hint and scanning goes on. */
export default function ScanScreen() {
  const { t } = useTranslation();
  const { openSystemSettings } = useDependencies();
  const intent = usePairingIntent();
  const [permission, requestPermission] = useCameraPermissions();
  const [invalid, setInvalid] = useState(false);
  const handled = useRef(false);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    if (!decodeQR(data)) {
      setInvalid(true);
      return;
    }
    handled.current = true;
    intent.set(targetFromQR(data));
    router.replace('/pair');
  };

  const manual = (
    <Button size="lg" variant="outline" onPress={() => router.replace('/manual')}>
      <Icon as={KeyboardIcon} size={18} />
      <Text>{t('scan.manualInstead')}</Text>
    </Button>
  );

  if (!permission) {
    return (
      <Screen className="flex-1">
        <StateView busy title={t('common.loading')} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen className="flex-1">
        <StateView
          icon={permission.canAskAgain ? CameraIcon : CameraOffIcon}
          title={t('scan.permission.title')}
          description={
            permission.canAskAgain ? t('scan.permission.description') : t('scan.permission.denied')
          }
        >
          {permission.canAskAgain ? (
            <Button size="lg" onPress={() => void requestPermission()}>
              <Text>{t('scan.permission.grant')}</Text>
            </Button>
          ) : (
            <Button size="lg" onPress={openSystemSettings}>
              <Text>{t('scan.permission.openSettings')}</Text>
            </Button>
          )}
          {manual}
        </StateView>
      </Screen>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <CameraView
        className="flex-1"
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScanned}
        accessibilityLabel={t('scan.cameraLabel')}
      />
      <View className="pb-safe gap-3 border-t border-border bg-background px-4 pt-4">
        <Text className="text-center" accessibilityLiveRegion="polite">
          {invalid ? t('scan.invalid') : t('scan.hint')}
        </Text>
        {manual}
      </View>
    </View>
  );
}
