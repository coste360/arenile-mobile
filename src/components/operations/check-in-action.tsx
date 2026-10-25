import { CircleCheckIcon, LogInIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { BookingRef } from '@/features/booking-actions/booking-ref';
import { useBookingOperations } from '@/features/booking-actions/hooks';
import { checkInState } from '@/features/booking-actions/rules';
import { useOperationalDays } from '@/features/operations/queries';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatDayLabel } from '@/lib/calendar';

import { QueuedNotice, useQueuedFeedback } from './queued-feedback';

/**
 * Check-in of a booking (operations.run, checked by the caller): queued,
 * so it works offline; the cached day shows it at once. When it is not
 * possible, the reason is said instead of a disabled button.
 */
export function CheckInAction({ booking }: { booking: BookingRef }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { today } = useOperationalDays();
  const { checkIn } = useBookingOperations(booking);
  const [outcome, report] = useQueuedFeedback();
  const state = checkInState(booking, today);

  const onPress = async () => {
    await checkIn();
    report();
  };

  return (
    <View className="gap-2">
      {state === 'available' ? (
        <Button size="lg" onPress={() => void onPress()}>
          <Icon as={LogInIcon} size={18} />
          <Text>{t('operations.checkIn.action')}</Text>
        </Button>
      ) : state === 'done' ? (
        <View className="flex-row items-center gap-2" accessible>
          <Icon as={CircleCheckIcon} size={20} className="text-success" />
          <Text className="font-semibold">{t('operations.checkIn.done')}</Text>
        </View>
      ) : state === 'outside_stay' ? (
        <Text variant="muted">
          {t('operations.checkIn.outside_stay', {
            from: formatDayLabel(booking.starts_on, locale),
            to: formatDayLabel(booking.ends_on, locale),
          })}
        </Text>
      ) : (
        <Text variant="muted">
          {t('operations.checkIn.unavailable', {
            status: t(`operations.bookingStatus.${booking.status}`),
          })}
        </Text>
      )}
      <QueuedNotice outcome={outcome} />
    </View>
  );
}
