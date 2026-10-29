import { ChevronRightIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import type { DaySpot } from '../model';
import { StatusGlyph } from './status-glyph';

/**
 * The spots as a list: search results, and the way to use the map without
 * gestures (screen readers, switch control). Virtualised for large maps.
 */
export function SpotList({
  spots,
  selectedId,
  onSelect,
  className,
  testID,
}: {
  spots: readonly DaySpot[];
  selectedId?: string;
  onSelect: (spot: DaySpot) => void;
  className?: string;
  testID?: string;
}) {
  return (
    <FlatList
      data={spots}
      keyExtractor={(s) => s.id}
      className={className}
      testID={testID}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={20}
      renderItem={({ item }) => (
        <SpotRow spot={item} selected={item.id === selectedId} onPress={() => onSelect(item)} />
      )}
    />
  );
}

export function useSpotSummary() {
  const { t } = useTranslation();
  return (spot: DaySpot) => {
    const status = spot.status ? t(`dayMap.status.${spot.status}`) : t('dayMap.status.unknown');
    const base = spot.occupant
      ? t('dayMap.list.itemOccupied', { label: spot.label, status, occupant: spot.occupant })
      : t('dayMap.list.item', { label: spot.label, status });
    return [base, ...spot.markers.map((m) => t(`dayMap.indicator.${m}`))].join(', ');
  };
}

function SpotRow({
  spot,
  selected,
  onPress,
}: {
  spot: DaySpot;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const summary = useSpotSummary();
  return (
    <Pressable
      role="button"
      accessibilityLabel={summary(spot)}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'min-h-12 flex-row items-center gap-3 border-b border-border px-4 py-2 active:bg-accent',
        selected && 'bg-accent',
      )}
    >
      {spot.status ? <StatusGlyph status={spot.status} size={24} /> : <View className="h-6 w-6" />}
      <View className="flex-1">
        <Text className="font-semibold">{spot.label}</Text>
        <Text variant="muted" numberOfLines={1}>
          {spot.status ? t(`dayMap.status.${spot.status}`) : t('dayMap.status.unknown')}
          {spot.occupant ? ` · ${spot.occupant}` : ''}
          {spot.markers.map((m) => ` · ${t(`dayMap.indicator.${m}`)}`).join('')}
        </Text>
      </View>
      <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}
