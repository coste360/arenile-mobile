import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { SpotCalendarView } from '@/features/day-map/components/spot-calendar-view';

/** Season calendar of a spot (core spec 30.5), from the spot sheet; online only. */
export default function SpotCalendarScreen() {
  const { t } = useTranslation();
  const { spotId, label } = useLocalSearchParams<{ spotId: string; label?: string }>();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('spotCalendar.title') }} />
      <SpotCalendarView spotId={spotId} label={label} />
    </Screen>
  );
}
