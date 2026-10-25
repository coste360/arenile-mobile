import { Stack, useLocalSearchParams } from 'expo-router';
import { CircleAlertIcon, RefreshCwIcon, TicketIcon, UmbrellaIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { CachedNotice, servedFromCache } from '@/components/cached-notice';
import { Screen } from '@/components/layout/screen';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  isSpotFilter,
  releasedHalf,
  spotsOf,
  type SpotFilter,
} from '@/features/operations/day-spots';
import { useMaps } from '@/features/maps/queries';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { localizedText } from '@/lib/i18n-text';

/**
 * Free spots, or spots released by their pass holders, of today: the lists
 * opened by the spot figures of "Oggi". Each released spot says which half
 * of the day is free.
 */
export default function SpotsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ status?: string }>();
  const status: SpotFilter = isSpotFilter(params.status) ? params.status : 'free';
  const { today } = useOperationalDays();
  const day = useOperationsDay(today);
  const { locale } = usePreferences();
  const maps = useMaps();
  // The map name tells spots apart only when the establishment has more than one map.
  const mapName = (id: string) =>
    maps.data && maps.data.length > 1
      ? localizedText(maps.data.find((m) => m.id === id)?.name, locale) || undefined
      : undefined;

  const title = t(`spots.title.${status}`);
  const header = <Stack.Screen options={{ title }} />;

  if (!day.data) {
    return (
      <Screen>
        {header}
        {day.isError || day.isPaused ? (
          <StateView
            icon={CircleAlertIcon}
            tone="destructive"
            title={t('today.errorTitle')}
            description={t('today.errorDescription')}
          >
            <Button variant="outline" onPress={() => void day.refetch()}>
              <Icon as={RefreshCwIcon} size={16} />
              <Text>{t('common.retry')}</Text>
            </Button>
          </StateView>
        ) : (
          <StateView busy title={t('common.loading')} />
        )}
      </Screen>
    );
  }

  const spots = spotsOf(day.data, status);
  return (
    <Screen onRefresh={() => void day.refetch()} refreshing={day.isRefetching}>
      {header}
      <CachedNotice stale={servedFromCache(day)} updatedAt={day.dataUpdatedAt} />
      {spots.length === 0 ? (
        <StateView
          icon={status === 'free' ? UmbrellaIcon : TicketIcon}
          title={status === 'free' ? t('spots.emptyFree') : t('spots.emptyReleased')}
        />
      ) : (
        <>
          <Text variant="muted" accessibilityLiveRegion="polite">
            {t('spots.count', { count: spots.length })}
          </Text>
          <Card className="py-2">
            <CardContent className="px-0">
              <View role="list" accessibilityLabel={title}>
                {spots.map((s) => {
                  const released = status === 'released' || s.status === 'released';
                  const state = released
                    ? `${t('spots.released')} · ${t(`bookings.slots.${releasedHalf(s)}`)}`
                    : t('spots.free');
                  const map = mapName(s.map_id);
                  return (
                    <View
                      key={s.spot_id}
                      role="listitem"
                      accessible
                      accessibilityLabel={[s.label, map, state].filter(Boolean).join(', ')}
                      className="min-h-12 flex-row items-center gap-3 border-b border-border px-4 py-2"
                    >
                      <Icon
                        as={released ? TicketIcon : UmbrellaIcon}
                        size={18}
                        className="text-muted-foreground"
                      />
                      <Text className="w-16 font-semibold">{s.label}</Text>
                      <View className="flex-1">
                        <Text>{state}</Text>
                        {map ? <Text variant="muted">{map}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </CardContent>
          </Card>
        </>
      )}
    </Screen>
  );
}
