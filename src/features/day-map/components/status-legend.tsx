import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';

import { LEGEND_ORDER, type MapMarker, type SpotStatus } from '../status';
import { MarkerGlyph, StatusGlyph } from './status-glyph';

const MARKERS: readonly MapMarker[] = ['arrival', 'departure'];

/**
 * Legend of the day map, always visible above it (core spec 11.3): every
 * status with its colour, glyph, label and today's count, in one scrolling
 * row on phones and wrapped on tablets.
 */
export function StatusLegend({
  counts,
  markers = {},
  wrap = false,
}: {
  counts: Partial<Record<SpotStatus, number>>;
  /** Arrivals and departures drawn on the map (spec 30.4), after the statuses. */
  markers?: Partial<Record<MapMarker, number>>;
  wrap?: boolean;
}) {
  const { t } = useTranslation();
  const item = (key: string, glyph: ReactNode, label: string, count: number) => (
    <View
      key={key}
      className="min-h-8 flex-row items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
      accessible
      accessibilityLabel={t('dayMap.legend.item', { label, count })}
    >
      {glyph}
      <Text className="text-sm">{label}</Text>
      <Text className="text-sm font-semibold tabular-nums text-muted-foreground">{count}</Text>
    </View>
  );
  const items = [
    ...LEGEND_ORDER.map((status) =>
      item(
        status,
        <StatusGlyph status={status} size={18} />,
        t(`dayMap.status.${status}`),
        counts[status] ?? 0,
      ),
    ),
    ...MARKERS.map((m) =>
      item(m, <MarkerGlyph marker={m} size={18} />, t(`dayMap.indicator.${m}`), markers[m] ?? 0),
    ),
  ];
  return (
    <View accessibilityRole="summary" accessibilityLabel={t('dayMap.legend.title')}>
      {wrap ? (
        <View className="flex-row flex-wrap gap-2">{items}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4"
        >
          {items}
        </ScrollView>
      )}
    </View>
  );
}
