import {
  CircleAlertIcon,
  CloudOffIcon,
  LifeBuoyIcon,
  LockIcon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
  SearchXIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { isForbidden } from '@/api/errors';
import type { LifeguardRow } from '@/api/types';
import { CachedNotice, servedFromCache } from '@/components/cached-notice';
import { DayPicker } from '@/components/day-picker';
import { ChipRow, FilterChip } from '@/components/filter-chip';
import { StateView } from '@/components/state-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  filterLifeguardRows,
  groupByRow,
  LIFEGUARD_FILTERS,
  lifeguardCounts,
  type LifeguardFilter,
  type LifeguardGroup,
} from '@/features/lifeguard/lifeguard';
import { useLifeguardList } from '@/features/lifeguard/queries';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { inOfflineWindow, resolveDay, type DaySelection } from '@/lib/calendar';

/**
 * Lifeguard list (core spec 30.10): the occupied spots of a day, row by row,
 * in large type for the beach (today and tomorrow also offline, other days
 * online only; ADR 0014). Read only: last name, setup, arrival, departure
 * and balance due, never contacts. A spot opens its booking when the day of
 * the map (same date, cached like this list) knows it: the booking sheet
 * applies the role's rules on contacts.
 */
export function LifeguardListView() {
  const { t } = useTranslation();
  const days = useOperationalDays();
  const { locale } = usePreferences();
  const { available: online } = useOnlineOnly();
  const [day, setDay] = useState<DaySelection>('today');
  const [filter, setFilter] = useState<LifeguardFilter>('all');
  const date = resolveDay(day, days);
  const query = useLifeguardList(date);
  const rows = query.data?.rows;
  const operations = useOperationsDay(date);
  const bookingOf = useMemo(
    () =>
      new Map(
        (operations.data?.spots ?? []).flatMap((s) =>
          s.booking ? [[s.spot_id, s.booking.booking_id] as const] : [],
        ),
      ),
    [operations.data],
  );

  const counts = useMemo(() => (rows ? lifeguardCounts(rows) : null), [rows]);
  const groups = useMemo(
    () => (rows ? groupByRow(filterLifeguardRows(rows, filter)) : []),
    [rows, filter],
  );
  const renderItem = useCallback(
    ({ item }: { item: LifeguardGroup }) => <RowGroup group={item} bookingOf={bookingOf} />,
    [bookingOf],
  );

  return (
    <View className="flex-1 bg-background">
      <View className="gap-3 border-b border-border px-4 pb-3 pt-4">
        <DayPicker value={day} onChange={setDay} days={days} locale={locale} />
        <ChipRow bleed label={t('lifeguard.filtersLabel')}>
          {LIFEGUARD_FILTERS.map((f) => (
            <FilterChip
              key={f}
              label={t(`lifeguard.filters.${f}`)}
              count={counts?.[f]}
              accessibilityLabel={
                counts
                  ? t('lifeguard.chipLabel', {
                      label: t(`lifeguard.filters.${f}`),
                      count: counts[f],
                    })
                  : undefined
              }
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ChipRow>
        {rows ? (
          <Text variant="muted" accessibilityLiveRegion="polite">
            {t('lifeguard.results', {
              count: groups.reduce((n, g) => n + g.spots.length, 0),
            })}
          </Text>
        ) : null}
      </View>

      {rows ? (
        <>
          {servedFromCache(query) ? (
            <View className="px-4 pt-3">
              <CachedNotice stale updatedAt={query.dataUpdatedAt} />
            </View>
          ) : null}
          <FlatList
            data={groups}
            keyExtractor={(g) => g.row || '-'}
            renderItem={renderItem}
            contentContainerClassName="grow gap-4 px-4 pt-4 pb-safe"
            refreshControl={
              <RefreshControl
                refreshing={query.isRefetching}
                onRefresh={() => void query.refetch()}
              />
            }
            ListEmptyComponent={
              rows.length === 0 ? (
                <StateView align="top" icon={LifeBuoyIcon} title={t('lifeguard.emptyTitle')} />
              ) : (
                <StateView align="top" icon={SearchXIcon} title={t('lifeguard.noMatchTitle')}>
                  <Button variant="outline" onPress={() => setFilter('all')}>
                    <Text>{t('lifeguard.showAll')}</Text>
                  </Button>
                </StateView>
              )
            }
          />
        </>
      ) : (query.isError || query.isPaused) && !online && !inOfflineWindow(date, days) ? (
        <StateView
          align="top"
          icon={CloudOffIcon}
          title={t('closedDay.offlineTitle')}
          description={t('closedDay.offlineDescription')}
        />
      ) : query.isError || query.isPaused ? (
        isForbidden(query.error) ? (
          <StateView align="top" icon={LockIcon} title={t('offline.errors.forbidden')} />
        ) : (
          <StateView
            align="top"
            icon={CircleAlertIcon}
            tone="destructive"
            title={t('today.errorTitle')}
            description={t('today.errorDescription')}
          >
            <Button variant="outline" onPress={() => void query.refetch()}>
              <Icon as={RefreshCwIcon} size={16} />
              <Text>{t('common.retry')}</Text>
            </Button>
          </StateView>
        )
      ) : (
        <StateView align="top" busy title={t('common.loading')} />
      )}
    </View>
  );
}

/** One beach row: its heading and its occupied spots. */
function RowGroup({
  group,
  bookingOf,
}: {
  group: LifeguardGroup;
  bookingOf: ReadonlyMap<string, string>;
}) {
  const { t } = useTranslation();
  const title = group.row ? t('lifeguard.row', { row: group.row }) : t('lifeguard.noRow');
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      <Text variant="h4" className="border-b border-border bg-muted px-4 py-2">
        {title}
      </Text>
      <View role="list" accessibilityLabel={title}>
        {group.spots.map((s, i) => (
          <SpotLine
            key={s.spot_id}
            spot={s}
            bookingId={bookingOf.get(s.spot_id)}
            last={i === group.spots.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

/** A spot in large type: label, last name, setup, group and the day's flags. */
function SpotLine({
  spot,
  bookingId,
  last,
}: {
  spot: LifeguardRow;
  bookingId?: string;
  last: boolean;
}) {
  const { t } = useTranslation();
  const name = spot.occupant_label || t('lifeguard.anonymous');
  const flags = FLAGS.filter((f) => spot[f.key]);
  const label = [
    spot.spot_label,
    name,
    spot.setup_label,
    spot.group_name,
    ...flags.map((f) => t(`lifeguard.flags.${f.key}`)),
  ]
    .filter(Boolean)
    .join(', ');
  const className = cn(
    'min-h-14 flex-row items-center gap-4 px-4 py-3',
    !last && 'border-b border-border',
    bookingId && 'active:bg-accent',
  );
  const content = (
    <>
      <Text className="w-20 text-2xl font-bold" numberOfLines={1}>
        {spot.spot_label}
      </Text>
      <View className="flex-1 gap-1">
        <Text
          className={
            spot.occupant_label
              ? 'text-xl font-semibold'
              : 'text-xl font-semibold text-muted-foreground'
          }
          numberOfLines={2}
        >
          {name}
        </Text>
        {spot.setup_label || spot.group_name ? (
          <Text className="text-base text-muted-foreground" numberOfLines={2}>
            {[spot.setup_label, spot.group_name].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {flags.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {flags.map((f) => (
              <Badge key={f.key} variant={f.tone} className="px-3 py-1">
                <Icon as={f.icon} size={16} className={f.iconClass} />
                <Text className="text-sm font-semibold">{t(`lifeguard.flags.${f.key}`)}</Text>
              </Badge>
            ))}
          </View>
        ) : null}
      </View>
    </>
  );
  return bookingId ? (
    <View role="listitem">
      <Pressable
        role="link"
        accessibilityLabel={label}
        accessibilityHint={t('lifeguard.openBooking')}
        testID={`lifeguard-spot-${spot.spot_id}`}
        onPress={() => router.push({ pathname: '/bookings/[bookingId]', params: { bookingId } })}
        className={className}
      >
        {content}
      </Pressable>
    </View>
  ) : (
    <View
      role="listitem"
      accessible
      accessibilityLabel={label}
      testID={`lifeguard-spot-${spot.spot_id}`}
      className={className}
    >
      {content}
    </View>
  );
}

/** The day's flags of a spot, each with its own symbol (never colour alone). */
const FLAGS = [
  { key: 'arriving', icon: LogInIcon, tone: 'default', iconClass: 'text-primary-foreground' },
  {
    key: 'departing',
    icon: LogOutIcon,
    tone: 'secondary',
    iconClass: 'text-secondary-foreground',
  },
  {
    key: 'balance_due',
    icon: WalletIcon,
    tone: 'destructive',
    iconClass: 'text-destructive-foreground',
  },
] as const satisfies readonly {
  key: 'arriving' | 'departing' | 'balance_due';
  icon: LucideIcon;
  tone: 'default' | 'secondary' | 'destructive';
  iconClass: string;
}[];
