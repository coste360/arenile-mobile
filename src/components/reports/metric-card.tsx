import { MinusIcon, TrendingDownIcon, TrendingUpIcon, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ComparisonMetric } from '@/api/types';
import {
  deltaTone,
  deltaTrend,
  formatDelta,
  formatMetricValue,
  type DeltaTone,
  type DeltaTrend,
  type ReportMetricKey,
} from '@/features/reports/format';
import { cn } from '@/lib/utils';

const TREND_ICON: Record<DeltaTrend, LucideIcon> = {
  up: TrendingUpIcon,
  down: TrendingDownIcon,
  flat: MinusIcon,
};

const TONE_CLASS: Record<DeltaTone, string> = {
  positive: 'text-success',
  negative: 'text-destructive',
  neutral: 'text-muted-foreground',
};

/**
 * One metric of the period against the previous year. The direction is
 * given by an icon and a word, the colour only reinforces it; screen readers
 * read the card as one sentence.
 */
export function MetricCard({
  metricKey,
  metric,
  locale,
  previousYear,
}: {
  metricKey: ReportMetricKey;
  metric: ComparisonMetric;
  locale: string;
  previousYear: string;
}) {
  const { t } = useTranslation();
  const trend = deltaTrend(metric);
  const tone = deltaTone(metric);
  const name = t(`reports.metrics.${metricKey}`);
  const value = formatMetricValue(metric, metric.current, locale);
  const previous = formatMetricValue(metric, metric.previous, locale);
  const delta = formatDelta(metric, locale, {
    points: t('reports.delta.points'),
    new: t('reports.delta.new'),
  });
  const trendLabel = t(`reports.delta.${trend}`);

  return (
    <Card
      className="flex-1 gap-3 py-4"
      accessible
      accessibilityLabel={t('reports.metricA11y', {
        metric: name,
        value,
        year: previousYear,
        previous,
        trend: trendLabel,
        delta,
      })}
    >
      <CardHeader className="px-4">
        <CardTitle className="text-base text-muted-foreground">{name}</CardTitle>
      </CardHeader>
      <CardContent className="gap-2 px-4">
        <Text className="text-3xl font-semibold" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <View className="flex-row items-center gap-1">
            <Icon as={TREND_ICON[trend]} size={16} className={TONE_CLASS[tone]} />
            <Text className={cn('text-sm font-medium', TONE_CLASS[tone])}>
              {trendLabel} {delta}
            </Text>
          </View>
          <Text variant="muted">
            {t('reports.previousValue', { year: previousYear, value: previous })}
          </Text>
        </View>
        <Text variant="muted">{t(`reports.metricHints.${metricKey}`)}</Text>
      </CardContent>
    </Card>
  );
}
