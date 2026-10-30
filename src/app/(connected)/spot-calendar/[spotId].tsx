import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { SpotCalendarView } from '@/features/day-map/components/spot-calendar-view';

/** Season calendar of a spot (core spec 30.5), from the spot sheet; online only (title in the layout). */
export default function SpotCalendarScreen() {
  const { spotId, label } = useLocalSearchParams<{ spotId: string; label?: string }>();
  return (
    <Screen>
      <SpotCalendarView spotId={spotId} label={label} />
    </Screen>
  );
}
