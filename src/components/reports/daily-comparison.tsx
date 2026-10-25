import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import type { ComparisonPoint } from '@/api/types';
import { formatRatioBP } from '@/features/reports/format';
import { formatDayLabel } from '@/lib/calendar';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Day by day of a week against the previous year: takings and occupancy.
 * On tablets the values sit in columns; on phones each day stacks its two
 * values. Every row is read as one sentence by screen readers.
 */
export function DailyComparison({
  points,
  locale,
  previousYear,
  wide,
}: {
  points: readonly ComparisonPoint[];
  locale: string;
  previousYear: string;
  wide: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle role="heading">{t('reports.daily.title')}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {points.map((p, i) => {
          const day = formatDayLabel(p.current_from, locale);
          const revenue = formatCents(p.current_revenue, { locale });
          const previousRevenue = formatCents(p.previous_revenue, { locale });
          const occupancy = formatRatioBP(p.current_occupancy_bp, locale);
          const previousOccupancy = formatRatioBP(p.previous_occupancy_bp, locale);
          return (
            <Fragment key={p.key}>
              {i > 0 ? <Separator className="my-3" /> : null}
              <View
                accessible
                accessibilityLabel={t('reports.daily.rowA11y', {
                  day,
                  revenue,
                  previousRevenue,
                  occupancy,
                  previousOccupancy,
                  year: previousYear,
                })}
                className={cn('gap-2', wide && 'flex-row items-center')}
              >
                <Text className={cn('font-medium', wide && 'w-1/4')}>{day}</Text>
                <View className={cn('flex-row gap-4', wide && 'flex-1')}>
                  <Value
                    label={t('reports.daily.revenue')}
                    value={revenue}
                    previous={t('reports.previousValue', {
                      year: previousYear,
                      value: previousRevenue,
                    })}
                  />
                  <Value
                    label={t('reports.daily.occupancy')}
                    value={occupancy}
                    previous={t('reports.previousValue', {
                      year: previousYear,
                      value: previousOccupancy,
                    })}
                  />
                </View>
              </View>
            </Fragment>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Value({ label, value, previous }: { label: string; value: string; previous: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text variant="muted">{label}</Text>
      <Text className="font-semibold">{value}</Text>
      <Text variant="muted">{previous}</Text>
    </View>
  );
}
