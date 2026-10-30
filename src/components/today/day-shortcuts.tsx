import { router } from 'expo-router';
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  LifeBuoyIcon,
  ListOrderedIcon,
  SearchCheckIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { canCreateBooking } from '@/features/new-booking/new-booking';
import { useAbilities } from '@/features/permissions/use-abilities';

/**
 * Entry to the day screens from the home: "Oggi", the bookings of the day,
 * "Trova posto" (roles that create bookings), the lifeguard list and the waitlist (on tablets they are also in the navigation pane). Hidden for a role
 * that cannot read bookings.
 */
export function DayShortcuts() {
  const { t } = useTranslation();
  const abilities = useAbilities();
  if (!abilities.canViewBookings) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('today.shortcuts.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-2">
        <Button size="lg" variant="outline" onPress={() => router.push('/today')}>
          <Icon as={CalendarDaysIcon} size={18} />
          <View className="flex-1">
            <Text className="text-left">{t('today.shortcuts.today')}</Text>
          </View>
          <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.push('/bookings')}>
          <Icon as={ClipboardListIcon} size={18} />
          <View className="flex-1">
            <Text className="text-left">{t('today.shortcuts.bookings')}</Text>
          </View>
          <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
        </Button>
        {canCreateBooking(abilities) ? (
          <Button size="lg" variant="outline" onPress={() => router.push('/find-spot')}>
            <Icon as={SearchCheckIcon} size={18} />
            <View className="flex-1">
              <Text className="text-left">{t('nav.findSpot')}</Text>
            </View>
            <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
          </Button>
        ) : null}
        <Button size="lg" variant="outline" onPress={() => router.push('/lifeguard')}>
          <Icon as={LifeBuoyIcon} size={18} />
          <View className="flex-1">
            <Text className="text-left">{t('nav.lifeguard')}</Text>
          </View>
          <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.push('/waitlist')}>
          <Icon as={ListOrderedIcon} size={18} />
          <View className="flex-1">
            <Text className="text-left">{t('nav.waitlist')}</Text>
          </View>
          <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
        </Button>
      </CardContent>
    </Card>
  );
}
