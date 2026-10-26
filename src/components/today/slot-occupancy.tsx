import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useChartColors } from '@/components/charts/use-chart-colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { OperationalSpot } from '@/api/types';
import {
  HALF_DAYS,
  SLOT_USES,
  slotOccupancy,
  slotSegments,
  type SlotCounts,
  type SlotUse,
} from '@/features/operations/slot-occupancy';
import { cn } from '@/lib/utils';

/** Swatch of each use in the legend; the SVG uses the same tokens (useChartColors). */
const SWATCH: Readonly<Record<SlotUse, string>> = {
  occupied: 'bg-primary',
  free: 'bg-success',
  closed: 'bg-input',
};

/** Height of a slot bar. */
const BAR_HEIGHT = 16;

/**
 * Occupancy of the day by slot (morning, afternoon): a stacked bar of
 * occupied, free and unavailable spots, with the counts written next to it
 * and read as one sentence by screen readers (never colour alone).
 */
export function SlotOccupancy({ spots }: { spots: readonly OperationalSpot[] }) {
  const { t } = useTranslation();
  const counts = slotOccupancy(spots);
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle role="heading">{t('today.slots.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4 px-4">
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          {SLOT_USES.map((use) => (
            <View
              key={use}
              className="flex-row items-center gap-2"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <View className={cn('h-3 w-3 rounded-sm', SWATCH[use])} />
              <Text variant="muted">{t(`today.slots.uses.${use}`)}</Text>
            </View>
          ))}
        </View>
        {HALF_DAYS.map((half) => (
          <SlotRow key={half} label={t(`today.slots.${half}`)} counts={counts[half]} />
        ))}
        <Text variant="muted">{t('today.slots.hint')}</Text>
      </CardContent>
    </Card>
  );
}

function SlotRow({ label, counts }: { label: string; counts: SlotCounts }) {
  const { t } = useTranslation();
  const colors = useChartColors();
  const fill: Record<SlotUse, string> = {
    occupied: colors.primary,
    free: colors.success,
    closed: colors.input,
  };
  return (
    <View
      accessible
      accessibilityLabel={t('today.slots.rowA11y', { slot: label, ...counts })}
      className="gap-2"
    >
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
        <Text className="font-medium">{label}</Text>
        <Text variant="muted">
          {SLOT_USES.map((use) =>
            t('today.slots.count', { label: t(`today.slots.uses.${use}`), count: counts[use] }),
          ).join(' · ')}
        </Text>
      </View>
      {counts.total > 0 ? (
        <Svg
          width="100%"
          height={BAR_HEIGHT}
          viewBox={`0 0 ${counts.total} 1`}
          preserveAspectRatio="none"
        >
          {slotSegments(counts).map(({ use, x, width }) => (
            <Rect key={use} x={x} y={0} width={width} height={1} fill={fill[use]} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
