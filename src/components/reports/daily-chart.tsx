import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { PREVIOUS_OPACITY, useChartColors } from '@/components/charts/use-chart-colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { ComparisonPoint } from '@/api/types';
import {
  BAR_SCALE,
  DAILY_SERIES,
  dailyBars,
  type DailySeries,
} from '@/features/reports/daily-chart';
import { formatRatioBP } from '@/features/reports/format';
import { formatDayLabel, formatWeekdayShort } from '@/lib/calendar';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

/** Height of the bars of a day (points). */
const CHART_HEIGHT = 112;
/** Thickness of the baseline, in thousandths of the chart. */
const BASELINE = 8;

/**
 * Bar chart of a week, day by day: takings and occupancy of the current
 * year (solid) beside the previous year (lighter). The values stay written
 * in the day-by-day list under it; each chart is read by screen readers as
 * one summary with every number.
 */
export function DailyChart({
  points,
  locale,
  currentYear,
  previousYear,
}: {
  points: readonly ComparisonPoint[];
  locale: string;
  currentYear: string;
  previousYear: string;
}) {
  const { t } = useTranslation();
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle role="heading">{t('reports.chart.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-5 px-4">
        <View
          className="flex-row flex-wrap gap-x-4 gap-y-1"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <LegendItem swatch="bg-primary" label={currentYear} />
          <LegendItem swatch="bg-primary/60" label={previousYear} />
        </View>
        {DAILY_SERIES.map((series) => (
          <SeriesChart
            key={series}
            series={series}
            points={points}
            locale={locale}
            currentYear={currentYear}
            previousYear={previousYear}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={cn('h-3 w-3 rounded-sm', swatch)} />
      <Text variant="muted">{label}</Text>
    </View>
  );
}

function SeriesChart({
  series,
  points,
  locale,
  currentYear,
  previousYear,
}: {
  series: DailySeries;
  points: readonly ComparisonPoint[];
  locale: string;
  currentYear: string;
  previousYear: string;
}) {
  const { t } = useTranslation();
  const colors = useChartColors();
  const { bars, max } = dailyBars(points, series);
  const format = (v: number) =>
    series === 'revenue' ? formatCents(v, { locale }) : formatRatioBP(v, locale);
  const name = t(`reports.daily.${series}`);
  const days = bars
    .map((b) =>
      t('reports.chart.dayA11y', {
        day: formatDayLabel(b.date, locale),
        value: format(b.current),
        year: previousYear,
        previous: format(b.previous),
      }),
    )
    .join(' ');

  if (max === 0) {
    // A week without takings in either year: nothing to draw.
    return (
      <View className="gap-1">
        <Text className="font-medium">{name}</Text>
        <Text variant="muted">{t('reports.chart.empty')}</Text>
      </View>
    );
  }
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
        <Text className="font-medium">{name}</Text>
        <Text variant="muted">{t('reports.chart.scale', { value: format(max) })}</Text>
      </View>
      <View
        accessible
        role="img"
        accessibilityLabel={t('reports.chart.a11y', {
          metric: name,
          year: currentYear,
          previousYear,
          days,
        })}
        testID={`daily-chart-${series}`}
        className="flex-row gap-1"
      >
        {bars.map((b) => (
          <View key={b.key} className="flex-1 items-center gap-1">
            <Svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 100 ${BAR_SCALE}`}
              preserveAspectRatio="none"
            >
              <Rect
                x={8}
                y={BAR_SCALE - b.currentHeight}
                width={40}
                height={b.currentHeight}
                fill={colors.primary}
              />
              <Rect
                x={52}
                y={BAR_SCALE - b.previousHeight}
                width={40}
                height={b.previousHeight}
                fill={colors.primary}
                fillOpacity={PREVIOUS_OPACITY}
              />
              <Rect
                x={0}
                y={BAR_SCALE - BASELINE}
                width={100}
                height={BASELINE}
                fill={colors.border}
              />
            </Svg>
            <Text variant="muted" className="text-xs" numberOfLines={1}>
              {formatWeekdayShort(b.date, locale)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
