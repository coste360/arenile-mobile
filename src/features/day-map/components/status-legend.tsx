import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';

import { LEGEND_ORDER, type SpotStatus } from '../status';
import { StatusGlyph } from './status-glyph';

/**
 * Legend of the day map, always visible above it (core spec 11.3): every
 * status with its colour, glyph, label and today's count, in one scrolling
 * row on phones and wrapped on tablets.
 */
export function StatusLegend({
  counts,
  wrap = false,
}: {
  counts: Partial<Record<SpotStatus, number>>;
  wrap?: boolean;
}) {
  const { t } = useTranslation();
  const items = LEGEND_ORDER.map((status) => {
    const label = t(`dayMap.status.${status}`);
    const count = counts[status] ?? 0;
    return (
      <View
        key={status}
        className="min-h-8 flex-row items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
        accessible
        accessibilityLabel={t('dayMap.legend.item', { label, count })}
      >
        <StatusGlyph status={status} size={18} />
        <Text className="text-sm">{label}</Text>
        <Text className="text-sm font-semibold tabular-nums text-muted-foreground">{count}</Text>
      </View>
    );
  });
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
