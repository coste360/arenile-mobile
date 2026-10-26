import { Stack, useLocalSearchParams } from 'expo-router';
import { CloudOffIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { BookingActionsPanel } from '@/components/operations/booking-actions-panel';
import { StateView } from '@/components/state-view';
import { useBookingRef } from '@/features/booking-actions/hooks';

/** Operations of one booking: check-in, pass day release, notes, quick cash. */
export default function BookingOperationsScreen() {
  const { t } = useTranslation();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { ref, detail } = useBookingRef(bookingId);

  return (
    <Screen>
      <Stack.Screen
        options={{ title: ref ? t('operations.booking.title', { code: ref.code }) : '' }}
      />
      {ref ? (
        <BookingActionsPanel booking={ref} />
      ) : detail.isPending && !detail.isError ? (
        <StateView busy title={t('common.loading')} />
      ) : (
        <StateView
          icon={CloudOffIcon}
          title={t('operations.booking.unavailableTitle')}
          description={t('operations.booking.unavailableDescription')}
        />
      )}
    </Screen>
  );
}
