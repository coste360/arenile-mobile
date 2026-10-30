import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SearchCheckIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ConnectionIndicator } from '@/components/connection-indicator';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DayMapView } from '@/features/day-map/components/day-map-view';
import { canCreateBooking } from '@/features/new-booking/new-booking';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';

/**
 * Day map (phase 1 "Mappa del giorno"): operational map, search and spot sheet.
 * `spot` (and its `map`) opens that spot's sheet, as from the free spots list.
 * The header has "Trova posto" for the roles that create bookings.
 */
export default function MapScreen() {
  const params = useLocalSearchParams<{ spot?: string; map?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerRight: () => <MapHeaderActions /> }} />
      <DayMapView spotId={params.spot} mapId={params.map} />
    </>
  );
}

/** "Trova posto" (online only), next to the connection indicator of the phone header. */
function MapHeaderActions() {
  const { t } = useTranslation();
  const layout = useDeviceLayout();
  const abilities = useAbilities();
  const { available: online } = useOnlineOnly();
  return (
    <View className="flex-row items-center gap-1">
      {layout === 'phone' ? <ConnectionIndicator /> : null}
      {canCreateBooking(abilities) ? (
        <Button
          variant="ghost"
          className="min-h-11 px-2"
          disabled={!online}
          accessibilityLabel={t('nav.findSpot')}
          onPress={() => router.push('/find-spot')}
          testID="map-find-spot"
        >
          <Icon as={SearchCheckIcon} size={20} />
          <Text>{t('nav.findSpot')}</Text>
        </Button>
      ) : null}
    </View>
  );
}
