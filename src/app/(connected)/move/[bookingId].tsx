import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { MoveView } from '@/components/move-booking/move-view';

/** Move a booking to another spot (spec 03), online only. */
export default function MoveScreen() {
  const { t } = useTranslation();
  const layout = useDeviceLayout();
  const { bookingId, lineId } = useLocalSearchParams<{ bookingId: string; lineId?: string }>();
  return (
    <Screen className={layout === 'tablet' ? 'max-w-5xl' : undefined}>
      <Stack.Screen options={{ title: t('nav.move') }} />
      <MoveView bookingId={bookingId} lineId={lineId} />
    </Screen>
  );
}
