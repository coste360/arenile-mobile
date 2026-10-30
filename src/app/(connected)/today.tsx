import { router } from 'expo-router';
import {
  CircleAlertIcon,
  LockIcon,
  LogInIcon,
  RefreshCwIcon,
  TicketIcon,
  UmbrellaIcon,
  UserCheckIcon,
  WalletIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { isForbidden } from '@/api/errors';
import { CachedNotice, servedFromCache } from '@/components/cached-notice';
import { Screen } from '@/components/layout/screen';
import { StateView } from '@/components/state-view';
import { FigureCard } from '@/components/today/figure-card';
import { FigureGrid } from '@/components/today/figure-grid';
import { SlotOccupancy } from '@/components/today/slot-occupancy';
import { ClosedDayNotice } from '@/components/closed-day-notice';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { dayBookingFigures, type DayFilter } from '@/features/bookings/day-list';
import { useBookingsOfDay } from '@/features/bookings/queries';
import { daySpotFigures, type SpotFilter } from '@/features/operations/day-spots';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatLongDay } from '@/lib/datetime';
import { formatCents } from '@/lib/money';

const UNKNOWN = '–';

/**
 * "Oggi" (phase 1): the day in the establishment time zone at a glance —
 * arrivals, present, free spots, bookings to settle, days released by pass
 * holders. Every figure opens its filtered list. Works offline from the
 * cached day.
 */
export default function TodayScreen() {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const days = useOperationalDays();
  const { today } = days;
  const abilities = useAbilities();
  const day = useOperationsDay(today);
  const bookings = useBookingsOfDay(today);

  const refresh = () => {
    void day.refetch();
    void bookings.refetch();
  };

  if (abilities.known && !abilities.canViewBookings) {
    return (
      <Screen>
        <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />
      </Screen>
    );
  }

  if (!day.data && !bookings.data) {
    if (day.isError || bookings.isError || (day.isPaused && bookings.isPaused)) {
      const forbidden = isForbidden(day.error) || isForbidden(bookings.error);
      return (
        <Screen>
          {forbidden ? (
            <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />
          ) : (
            <StateView
              icon={CircleAlertIcon}
              tone="destructive"
              title={t('today.errorTitle')}
              description={t('today.errorDescription')}
            >
              <Button variant="outline" onPress={refresh}>
                <Icon as={RefreshCwIcon} size={16} />
                <Text>{t('common.retry')}</Text>
              </Button>
            </StateView>
          )}
        </Screen>
      );
    }
    return (
      <Screen>
        <StateView busy title={t('common.loading')} />
      </Screen>
    );
  }

  const figures = bookings.data ? dayBookingFigures(bookings.data, today) : null;
  const spots = day.data ? daySpotFigures(day.data) : null;
  const totals = day.data?.totals;
  // The list is the reference (its filters open from here); the server
  // totals stand in while only the operational day is available.
  const arrivals = figures?.arrivals ?? totals?.arrivals;
  const present = figures?.present ?? totals?.checked_in;
  const stale = servedFromCache(day) || servedFromCache(bookings);
  const updatedAt = Math.min(...[day.dataUpdatedAt, bookings.dataUpdatedAt].filter((n) => n > 0));

  const openBookings = (filter: DayFilter) =>
    router.push({ pathname: '/bookings', params: { filter } });
  const openSpots = (status: SpotFilter) => router.push({ pathname: '/spots', params: { status } });
  const show = (n: number | undefined) => (n === undefined ? UNKNOWN : String(n));

  return (
    <Screen onRefresh={refresh} refreshing={day.isRefetching || bookings.isRefetching}>
      <Text variant="h3" role="heading">
        {t('today.heading', { date: formatLongDay(today, locale) })}
      </Text>
      <CachedNotice stale={stale} updatedAt={Number.isFinite(updatedAt) ? updatedAt : 0} />
      {day.data?.closed ? <ClosedDayNotice date={today} days={days} locale={locale} /> : null}
      <FigureGrid>
        <FigureCard
          icon={LogInIcon}
          label={t('today.figures.arrivals')}
          value={show(arrivals)}
          onPress={() => openBookings('arrivals')}
          testID="figure-arrivals"
        />
        <FigureCard
          icon={UserCheckIcon}
          label={t('today.figures.present')}
          value={show(present)}
          onPress={() => openBookings('present')}
          testID="figure-present"
        />
        <FigureCard
          icon={UmbrellaIcon}
          label={t('today.figures.free')}
          value={show(spots?.free)}
          detail={spots ? t('today.freeOf', { total: spots.total }) : undefined}
          onPress={() => openSpots('free')}
          testID="figure-free"
        />
        <FigureCard
          icon={WalletIcon}
          label={t('today.figures.toSettle')}
          value={show(figures?.toSettle)}
          detail={figures ? formatCents(figures.toSettleAmount) : undefined}
          onPress={() => openBookings('to_settle')}
          testID="figure-to-settle"
        />
        <FigureCard
          icon={TicketIcon}
          label={t('today.figures.released')}
          value={show(spots?.released)}
          onPress={() => openSpots('released')}
          testID="figure-released"
        />
      </FigureGrid>
      {day.data && day.data.spots.length > 0 ? <SlotOccupancy spots={day.data.spots} /> : null}
    </Screen>
  );
}
