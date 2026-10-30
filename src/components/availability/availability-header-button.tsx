import { router } from 'expo-router';
import { SearchCheckIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ConnectionIndicator } from '@/components/connection-indicator';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { canCreateBooking } from '@/features/new-booking/new-booking';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import type { CalendarDate } from '@/lib/calendar';

/**
 * Header of the day map: "Disponibilità" for the roles that create bookings,
 * online only, from the map's day and map. On phones an icon next to the
 * connection indicator (the header has little room); on tablets with its label.
 */
export function AvailabilityHeaderButton({ from, mapId }: { from: CalendarDate; mapId: string }) {
  const { t } = useTranslation();
  const phone = useDeviceLayout() === 'phone';
  const abilities = useAbilities();
  const { available: online } = useOnlineOnly();
  const open = () => router.push({ pathname: '/availability', params: { from, map: mapId } });
  return (
    <View className="flex-row items-center">
      {phone ? <ConnectionIndicator /> : null}
      {!canCreateBooking(abilities) ? null : phone ? (
        <Button
          variant="ghost"
          size="icon"
          disabled={!online}
          accessibilityLabel={t('nav.availability')}
          onPress={open}
          testID="map-availability"
        >
          <Icon as={SearchCheckIcon} size={22} />
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="min-h-11 px-2"
          disabled={!online}
          accessibilityLabel={t('nav.availability')}
          onPress={open}
          testID="map-availability"
        >
          <Icon as={SearchCheckIcon} size={20} />
          <Text>{t('nav.availability')}</Text>
        </Button>
      )}
    </View>
  );
}
