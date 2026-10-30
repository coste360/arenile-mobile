import { BanIcon, ChartColumnIcon, RefreshCwIcon, WifiOffIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { NetworkError, ProblemError, isForbidden } from '@/api/errors';
import type { ComparisonAlign } from '@/api/types';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { Screen } from '@/components/layout/screen';
import { DailyChart } from '@/components/reports/daily-chart';
import { DailyComparison } from '@/components/reports/daily-comparison';
import { MetricCard } from '@/components/reports/metric-card';
import { PeriodPicker } from '@/components/reports/period-picker';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useOperationalDays } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatReportDate, metricsByKey, REPORT_METRICS } from '@/features/reports/format';
import {
  canGoForward,
  isCurrent,
  periodOf,
  shiftAnchor,
  type ReportRange,
} from '@/features/reports/period';
import { useYearComparison } from '@/features/reports/queries';
import { cn } from '@/lib/utils';

/**
 * Essential reports (spec 04, phase 3) for owner, manager and viewer: takings
 * and occupancy of a day or a week against the previous year, from the
 * core's year comparison. Online only; exports stay in the panel.
 */
export default function ReportsScreen() {
  const { t } = useTranslation();
  const abilities = useAbilities();

  if (!abilities.known) {
    return (
      <Screen>
        <StateView busy title={t('reports.states.loading')} />
      </Screen>
    );
  }
  if (!abilities.canSeeReports) {
    return (
      <Screen>
        <StateView
          icon={BanIcon}
          title={t('reports.states.forbiddenTitle')}
          description={t('reports.states.forbidden')}
        />
      </Screen>
    );
  }
  return <Reports />;
}

function Reports() {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const layout = useDeviceLayout();
  const wide = layout === 'tablet';
  const { today } = useOperationalDays();
  const [range, setRange] = useState<ReportRange>('day');
  const [anchor, setAnchor] = useState(today);
  const [align, setAlign] = useState<ComparisonAlign>('calendar');

  const period = periodOf(range, anchor);
  const report = useYearComparison({ ...period, align });
  const data = report.data;
  const previousYear =
    data?.previous.from.slice(0, 4) ?? String(Number(period.from.slice(0, 4)) - 1);
  const metrics = metricsByKey(data?.metrics);

  return (
    <Screen>
      <Text className="text-muted-foreground">{t('reports.description')}</Text>
      <PeriodPicker
        range={range}
        onRangeChange={setRange}
        period={period}
        current={isCurrent(period, today)}
        canGoForward={canGoForward(range, anchor, today)}
        onShift={(direction) => setAnchor(shiftAnchor(range, anchor, direction))}
        align={align}
        onAlignChange={setAlign}
        locale={locale}
      />

      {data ? (
        <>
          <Text variant="muted" accessibilityLiveRegion="polite">
            {t('reports.comparedWith', {
              from: formatReportDate(data.previous.from, locale),
              to: formatReportDate(data.previous.to, locale),
            })}
          </Text>
          <View className={cn('gap-4', wide && '-mx-2 flex-row flex-wrap gap-0')}>
            {REPORT_METRICS.map((key) => {
              const metric = metrics[key];
              if (!metric) return null;
              return (
                <View key={key} className={cn(wide && 'w-1/2 px-2 pb-4')}>
                  <MetricCard
                    metricKey={key}
                    metric={metric}
                    locale={locale}
                    previousYear={previousYear}
                  />
                </View>
              );
            })}
          </View>
          {range === 'week' && data.series.length > 1 ? (
            <DailyChart
              points={data.series}
              locale={locale}
              currentYear={data.current.from.slice(0, 4)}
              previousYear={previousYear}
            />
          ) : null}
          {range === 'week' && data.series.length > 0 ? (
            <DailyComparison
              points={data.series}
              locale={locale}
              previousYear={previousYear}
              wide={wide}
            />
          ) : null}
          {report.isError ? <ReportError error={report.error} compact /> : null}
        </>
      ) : report.isError ? (
        <ReportError error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <StateView busy title={t('reports.states.loading')} />
      )}

      {data ? (
        <Button
          variant="outline"
          onPress={() => void report.refetch()}
          disabled={report.isFetching}
        >
          <Icon as={RefreshCwIcon} size={16} />
          <Text>{t('reports.refresh')}</Text>
        </Button>
      ) : null}
      <View className="flex-row items-center gap-2">
        <Icon as={ChartColumnIcon} size={16} className="text-muted-foreground" />
        <Text variant="muted" className="flex-1">
          {t('reports.exportsHint')}
        </Text>
      </View>
    </Screen>
  );
}

/** Why the reports could not be loaded: offline, role, instance, other. */
function ReportError({
  error,
  onRetry,
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const offline = error instanceof NetworkError;
  const forbidden = isForbidden(error);
  const notImplemented = error instanceof ProblemError && error.status === 501;
  const title = offline
    ? t('reports.states.offlineTitle')
    : forbidden
      ? t('reports.states.forbiddenTitle')
      : t('reports.states.unavailableTitle');
  const description = offline
    ? t('reports.states.offline')
    : forbidden
      ? t('offline.errors.forbidden')
      : notImplemented
        ? t('reports.states.notImplemented')
        : t('reports.states.error');

  if (compact) {
    return (
      <Text variant="muted" accessibilityLiveRegion="polite">
        {t('reports.states.stale', { reason: description })}
      </Text>
    );
  }
  return (
    <StateView
      icon={offline ? WifiOffIcon : BanIcon}
      tone={offline ? 'default' : 'destructive'}
      title={title}
      description={description}
    >
      {onRetry && !forbidden && !notImplemented ? (
        <Button onPress={onRetry}>
          <Text>{t('reports.states.retry')}</Text>
        </Button>
      ) : null}
    </StateView>
  );
}
