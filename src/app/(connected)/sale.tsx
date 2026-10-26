import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { Slots } from '@/api/types';
import { SaleView } from '@/components/daily-sale/sale-view';
import { Screen } from '@/components/layout/screen';
import { useOperationalDays } from '@/features/operations/queries';
import { isCalendarDate } from '@/lib/calendar';

const SLOTS: readonly string[] = ['FULL', 'AM', 'PM'];

/** Daily quick sale of the spot tapped on the map (spec 03), online only. */
export default function SaleScreen() {
  const { t } = useTranslation();
  const { today } = useOperationalDays();
  const params = useLocalSearchParams<{ spotId: string; date?: string; slot?: string }>();
  const date = params.date && isCalendarDate(params.date) ? params.date : today;
  const slot = (params.slot && SLOTS.includes(params.slot) ? params.slot : 'FULL') as Slots;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('sale.screenTitle') }} />
      <SaleView spotId={params.spotId} date={date} initialSlot={slot} />
    </Screen>
  );
}
