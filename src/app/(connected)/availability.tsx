import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AvailabilityView } from '@/components/availability/availability-view';
import { Screen } from '@/components/layout/screen';
import { useOperationalDays } from '@/features/operations/queries';
import { isCalendarDate } from '@/lib/calendar';

/**
 * "Disponibilità": the spots free for a stay, row by row, from the day map,
 * the home and the navigation pane. `from` is the first day, never before
 * today; `map` preselects a map (the day map's). Online only.
 */
export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const { today } = useOperationalDays();
  const params = useLocalSearchParams<{ from?: string; map?: string }>();
  const from =
    params.from && isCalendarDate(params.from) && params.from >= today ? params.from : today;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('nav.availability') }} />
      <AvailabilityView startsOn={from} mapId={params.map || undefined} />
    </Screen>
  );
}
