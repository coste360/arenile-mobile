import { router } from 'expo-router';
import { ChevronRightIcon, CircleAlertIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { OnlineOnlyNotice } from '@/components/online-only-notice';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isForbidden, ProblemError } from '@/api/errors';
import type { SpotCalendarBooking, SpotCalendarDay } from '@/api/types';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatDayLabel } from '@/lib/calendar';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

import {
  bookingOfDay,
  CALENDAR_LEGEND,
  calendarMonths,
  cellStatus,
  useSpotCalendar,
} from '../spot-calendar';
import { STATUS_CLASSES, type SpotStatus } from '../status';
import { StatusGlyph } from './status-glyph';

/** Monday 2024-01-01 … Sunday 2024-01-07: the weekday names of the header. */
const WEEK = Array.from({ length: 7 }, (_, i) => `2024-01-0${i + 1}`);

/**
 * Season calendar of a spot (core spec 30.5), online only: one wall
 * calendar per month, each day split in a morning and an afternoon half
 * with the status colour and glyph of the map; a taken day opens its
 * booking. Below, the bookings of the season. Months sit side by side when
 * the window is wide (tablets).
 */
export function SpotCalendarView({ spotId, label }: { spotId: string; label?: string }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const abilities = useAbilities();
  const { available: online } = useOnlineOnly();
  const query = useSpotCalendar(spotId);
  const cal = query.data;
  const bookings = useMemo(
    () => new Map((cal?.bookings ?? []).map((b) => [b.booking_id, b])),
    [cal],
  );
  const months = useMemo(() => calendarMonths(cal?.days ?? []), [cal]);
  const canOpen = abilities.canViewBookings;

  if (!cal) {
    if (!online && !query.isFetching) return <OnlineOnlyNotice />;
    if (query.isError) {
      const e = query.error;
      const key = isForbidden(e)
        ? 'offline.errors.forbidden'
        : e instanceof ProblemError && e.status === 404
          ? 'spotCalendar.notFound'
          : e instanceof ProblemError && e.status === 501
            ? 'spotCalendar.notImplemented'
            : 'spotCalendar.error';
      return (
        <StateView
          align="top"
          icon={CircleAlertIcon}
          tone="destructive"
          title={t('spotCalendar.errorTitle')}
          description={t(key)}
        >
          <Button variant="outline" size="lg" onPress={() => void query.refetch()}>
            <Text>{t('common.retry')}</Text>
          </Button>
        </StateView>
      );
    }
    return <StateView busy align="top" title={t('spotCalendar.loading')} />;
  }

  const name = (b: SpotCalendarBooking) => {
    const who = abilities.canViewBookings ? b.occupant_label?.trim() : '';
    return who ? `${b.code} ${who}` : b.code;
  };
  const half = (d: SpotCalendarDay, slot: 'am' | 'pm') => {
    const cell = d[slot];
    const status = t(`dayMap.status.${cellStatus(cell, bookings)}`);
    const slotLabel = t(`dayMap.slot.${slot === 'am' ? 'AM' : 'PM'}`);
    const b = cell.booking_id ? bookings.get(cell.booking_id) : undefined;
    return b
      ? t('spotCalendar.halfBooking', { slot: slotLabel, status, booking: name(b) })
      : t('spotCalendar.half', { slot: slotLabel, status });
  };
  const describe = (d: SpotCalendarDay) =>
    t('spotCalendar.day', {
      date: formatDayLabel(d.date, locale),
      am: half(d, 'am'),
      pm: half(d, 'pm'),
    });
  const open = (bookingId: string) =>
    router.push({ pathname: '/bookings/[bookingId]', params: { bookingId } });
  const weekdays = WEEK.map((d) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    ),
  );
  const monthName = (key: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${key}-01T00:00:00Z`),
    );

  return (
    <View className="gap-4" testID="spot-calendar">
      <View className="gap-1">
        <Text variant="large" role="heading">
          {t('spotCalendar.heading', { label: label || cal.label })}
        </Text>
        <Text variant="muted">
          {t('spotCalendar.season', {
            from: formatDayLabel(cal.from, locale),
            to: formatDayLabel(cal.to, locale),
          })}
        </Text>
      </View>
      <OnlineOnlyNotice />
      <Legend />

      <View className="flex-row flex-wrap gap-6">
        {months.map((m) => (
          <View key={m.key} className="w-full max-w-md gap-1.5" testID={`month-${m.key}`}>
            <Text className="font-semibold capitalize" role="heading">
              {monthName(m.key)}
            </Text>
            <View
              className="flex-row gap-1"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {weekdays.map((w, i) => (
                <Text key={i} variant="muted" className="flex-1 text-center text-xs">
                  {w}
                </Text>
              ))}
            </View>
            {m.weeks.map((week, wi) => (
              <View key={wi} className="flex-row gap-1">
                {week.map((d, i) =>
                  d ? (
                    <DayCell
                      key={d.date}
                      day={d}
                      am={cellStatus(d.am, bookings)}
                      pm={cellStatus(d.pm, bookings)}
                      label={describe(d)}
                      onOpen={
                        canOpen && bookingOfDay(d)
                          ? () => open(bookingOfDay(d) as string)
                          : undefined
                      }
                    />
                  ) : (
                    <View key={`empty-${i}`} className="flex-1" />
                  ),
                )}
              </View>
            ))}
          </View>
        ))}
      </View>

      <View className="gap-2">
        <Text className="font-semibold" role="heading">
          {t('spotCalendar.bookings')}
        </Text>
        {cal.bookings.length === 0 ? (
          <Text variant="muted">{t('spotCalendar.noBookings')}</Text>
        ) : (
          <View className="overflow-hidden rounded-lg border border-border">
            {[...cal.bookings]
              .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
              .map((b) => (
                <BookingRow
                  key={b.booking_id}
                  title={name(b)}
                  period={t('spotCalendar.period', {
                    from: formatDayLabel(b.starts_on, locale),
                    to: formatDayLabel(b.ends_on, locale),
                  })}
                  balance={
                    b.balance_due > 0
                      ? t('spotCalendar.balance', { amount: formatCents(b.balance_due) })
                      : undefined
                  }
                  onOpen={canOpen ? () => open(b.booking_id) : undefined}
                />
              ))}
          </View>
        )}
      </View>
    </View>
  );
}

function Legend() {
  const { t } = useTranslation();
  return (
    <View className="gap-2" role="group" accessibilityLabel={t('spotCalendar.legend')}>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
        {CALENDAR_LEGEND.map((s) => (
          <View key={s} className="flex-row items-center gap-1.5">
            <StatusGlyph status={s} size={16} />
            <Text className="text-sm">{t(`dayMap.status.${s}`)}</Text>
          </View>
        ))}
      </View>
      <Text variant="muted" className="text-sm">
        {t('spotCalendar.halves')}
      </Text>
    </View>
  );
}

function DayCell({
  day,
  am,
  pm,
  label,
  onOpen,
}: {
  day: SpotCalendarDay;
  am: SpotStatus;
  pm: SpotStatus;
  label: string;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const body = (
    <>
      <Text className="text-center text-xs tabular-nums">{Number(day.date.slice(8, 10))}</Text>
      <View className="flex-1 flex-row">
        <Half status={am} />
        <Half status={pm} />
      </View>
    </>
  );
  const box = 'min-h-11 flex-1 overflow-hidden rounded-md border border-border bg-card';
  if (!onOpen) {
    return (
      <View className={box} accessible accessibilityLabel={label} testID={`day-${day.date}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      accessibilityHint={t('spotCalendar.openBooking')}
      onPress={onOpen}
      className={cn(box, 'active:opacity-70')}
      testID={`day-${day.date}`}
    >
      {body}
    </Pressable>
  );
}

/** Half a day: the status colour with its glyph (none for free, as on the map). */
function Half({ status }: { status: SpotStatus }) {
  return (
    <View
      className={cn(
        'flex-1 items-center justify-center',
        STATUS_CLASSES[status].bg,
        status === 'free' && 'opacity-40',
      )}
    >
      {status !== 'free' ? <StatusGlyph status={status} size={14} /> : null}
    </View>
  );
}

function BookingRow({
  title,
  period,
  balance,
  onOpen,
}: {
  title: string;
  period: string;
  balance?: string;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        <Text variant="muted">{period}</Text>
        {balance ? <Text className="text-destructive">{balance}</Text> : null}
      </View>
      {onOpen ? <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" /> : null}
    </>
  );
  const row = 'min-h-12 flex-row items-center gap-3 border-b border-border px-4 py-2';
  const a11y = [title, period, balance].filter(Boolean).join(', ');
  return onOpen ? (
    <Pressable
      role="button"
      accessibilityLabel={a11y}
      onPress={onOpen}
      className={cn(row, 'active:bg-accent')}
    >
      {content}
    </Pressable>
  ) : (
    <View className={row} accessible accessibilityLabel={a11y}>
      {content}
    </View>
  );
}
