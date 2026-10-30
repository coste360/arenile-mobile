import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FindSpotView } from '@/components/find-spot/find-spot-view';
import { Screen } from '@/components/layout/screen';
import { useOperationalDays } from '@/features/operations/queries';
import { isCalendarDate } from '@/lib/calendar';

/**
 * "Trova posto": the spots free for a stay, row by row, from the day map,
 * the home and the navigation pane. `from` is the first day, never before
 * today. Online only.
 */
export default function FindSpotScreen() {
  const { t } = useTranslation();
  const { today } = useOperationalDays();
  const params = useLocalSearchParams<{ from?: string }>();
  const from =
    params.from && isCalendarDate(params.from) && params.from >= today ? params.from : today;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('nav.findSpot') }} />
      <FindSpotView startsOn={from} />
    </Screen>
  );
}
