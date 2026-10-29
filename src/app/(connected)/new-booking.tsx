import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { Slots } from '@/api/types';
import { Screen } from '@/components/layout/screen';
import { NewBookingView } from '@/components/new-booking/new-booking-view';
import { useOperationalDays } from '@/features/operations/queries';
import { isCalendarDate } from '@/lib/calendar';

const SLOTS: readonly string[] = ['FULL', 'AM', 'PM'];

/**
 * New booking on the fly (from a free spot on the map, the free spots list
 * or the bookings list), online only. `from` and `to` are the stay, never
 * before today.
 */
export default function NewBookingScreen() {
  const { t } = useTranslation();
  const { today } = useOperationalDays();
  const params = useLocalSearchParams<{
    spotId?: string;
    from?: string;
    to?: string;
    slot?: string;
  }>();
  const from =
    params.from && isCalendarDate(params.from) && params.from >= today ? params.from : today;
  const to = params.to && isCalendarDate(params.to) && params.to >= from ? params.to : undefined;
  const slot = (params.slot && SLOTS.includes(params.slot) ? params.slot : 'FULL') as Slots;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('newBooking.title') }} />
      <NewBookingView
        spotId={params.spotId || undefined}
        startsOn={from}
        endsOn={to}
        initialSlot={slot}
      />
    </Screen>
  );
}
