import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { CameraIcon, CameraOffIcon, KeyboardIcon, ScanQrCodeIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { Screen } from '@/components/layout/screen';
import { CodeLookupView } from '@/components/operations/code-result';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCodeLookup } from '@/features/check-in/hooks';
import { parseScanned } from '@/features/check-in/scan-code';
import { cn } from '@/lib/utils';
import { useDependencies } from '@/providers/dependencies';

cssInterop(CameraView, { className: 'style' });

/**
 * Check-in by QR: the booking QR or the ticket QR. A scan pauses the camera
 * until the staff moves on ("Scansiona il prossimo"); a QR that is not
 * Arenile's says so and scanning goes on. On tablets the result sits next
 * to the camera.
 */
export default function OperationsScanScreen() {
  const { t } = useTranslation();
  const { openSystemSettings } = useDependencies();
  const layout = useDeviceLayout();
  const [permission, requestPermission] = useCameraPermissions();
  const { state, lookup, reset } = useCodeLookup();
  const last = useRef<string | null>(null);
  const paused = state.status === 'busy' || state.status === 'done' || state.status === 'error';
  const unrecognized = state.status === 'done' && state.resolution.type === 'unrecognized';

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (paused && !unrecognized) return;
    // The camera reports the same code many times per second.
    if (data === last.current) return;
    last.current = data;
    void lookup(parseScanned(data), { manual: false });
  };

  const next = () => {
    last.current = null;
    reset();
  };

  const manual = (
    <Button
      size="lg"
      variant="outline"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/operations'))}
    >
      <Icon as={KeyboardIcon} size={18} />
      <Text>{t('operations.scan.manual')}</Text>
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
          title={t('operations.scan.permission.title')}
          description={
            permission.canAskAgain
              ? t('operations.scan.permission.description')
              : t('operations.scan.permission.denied')
          }
        >
          {permission.canAskAgain ? (
            <Button size="lg" onPress={() => void requestPermission()}>
              <Text>{t('operations.scan.permission.grant')}</Text>
            </Button>
          ) : (
            <Button size="lg" onPress={openSystemSettings}>
              <Text>{t('operations.scan.permission.openSettings')}</Text>
            </Button>
          )}
          {manual}
        </StateView>
      </Screen>
    );
  }

  const tablet = layout === 'tablet';
  return (
    <View className={cn('flex-1 bg-background', tablet && 'flex-row')}>
      <CameraView
        className={tablet ? 'flex-1' : 'h-2/5'}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScanned}
        accessibilityLabel={t('operations.scan.cameraLabel')}
      />
      <ScrollView
        className={cn('flex-1 border-border', tablet ? 'border-l' : 'border-t')}
        contentContainerClassName="pb-safe gap-4 px-4 py-4"
        keyboardShouldPersistTaps="handled"
      >
        {state.status === 'idle' ? (
          <Text className="text-center" accessibilityLiveRegion="polite">
            {t('operations.scan.hint')}
          </Text>
        ) : (
          <CodeLookupView state={state} />
        )}
        {paused && !unrecognized ? (
          <Button size="lg" onPress={next}>
            <Icon as={ScanQrCodeIcon} size={18} />
            <Text>{t('operations.scan.next')}</Text>
          </Button>
        ) : null}
        {manual}
      </ScrollView>
    </View>
  );
}
