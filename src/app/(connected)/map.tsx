import { useLocalSearchParams } from 'expo-router';

import { DayMapView } from '@/features/day-map/components/day-map-view';

/**
 * Day map (phase 1 "Mappa del giorno"): operational map, search and spot sheet.
 * `spot` (and its `map`) opens that spot's sheet, as from the free spots list.
 */
export default function MapScreen() {
  const params = useLocalSearchParams<{ spot?: string; map?: string }>();
  return <DayMapView spotId={params.spot} mapId={params.map} />;
}
