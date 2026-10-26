import {
  CalendarXIcon,
  CircleAlertIcon,
  LockIcon,
  RefreshCwIcon,
  SearchXIcon,
  SlidersHorizontalIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { isForbidden } from '@/api/errors';
import type { BookingSummary } from '@/api/types';
import { CachedNotice, servedFromCache } from '@/components/cached-notice';
import { ChipRow, FilterChip } from '@/components/filter-chip';
import type { ListState } from '@/components/layout/master-detail';
import { SearchField } from '@/components/search-field';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  CHANNEL_FILTERS,
  DAY_FILTERS,
  DAY_SORTS,
  DEFAULT_DAY_LIST_QUERY,
  filterCounts,
  selectBookings,
  type ChannelFilter,
  type DayFilter,
  type DaySort,
} from '@/features/bookings/day-list';
import { useBookingsOfDay } from '@/features/bookings/queries';
import { useOperationalDays } from '@/features/operations/queries';

import { BookingRow } from './booking-row';

export type ListDay = 'today' | 'tomorrow';

/**
 * Bookings of today or tomorrow (the offline window) with the filters of
 * phase 1, search and sort. Selecting a row is up to the screen: the phone
 * opens the sheet, the tablet shows it beside the list.
 */
export function BookingsList({
  initialFilter = 'all',
  initialDay = 'today',
  selectedId,
  onSelect,
  onListState,
}: {
  initialFilter?: DayFilter;
  initialDay?: ListDay;
  selectedId?: string;
  onSelect: (booking: BookingSummary) => void;
  /** What the list shows, for the detail beside it (MasterDetail). */
  onListState?: (state: ListState) => void;
}) {
  const { t } = useTranslation();
  const days = useOperationalDays();
  const [day, setDay] = useState<ListDay>(initialDay);
  const [filter, setFilter] = useState<DayFilter>(initialFilter);
  const [channel, setChannel] = useState<ChannelFilter>(DEFAULT_DAY_LIST_QUERY.channel);
  const [sort, setSort] = useState<DaySort>(DEFAULT_DAY_LIST_QUERY.sort);
  const [includeClosed, setIncludeClosed] = useState(DEFAULT_DAY_LIST_QUERY.includeClosed);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  // A new link from "Oggi" (another figure) replaces the current filter
  // (state adjusted while rendering, not in an effect).
  const [linked, setLinked] = useState({ filter: initialFilter, day: initialDay });
  if (linked.filter !== initialFilter || linked.day !== initialDay) {
    setLinked({ filter: initialFilter, day: initialDay });
    setFilter(initialFilter);
    setDay(initialDay);
  }

  const date = day === 'today' ? days.today : days.tomorrow;
  const query = useBookingsOfDay(date);
  const all = query.data;

  const shown = useMemo(
    () => (all ? selectBookings(all, { date, filter, channel, search, sort, includeClosed }) : []),
    [all, date, filter, channel, search, sort, includeClosed],
  );
  const counts = useMemo(
    () => (all ? filterCounts(all, { date, channel, search, includeClosed }) : null),
    [all, date, channel, search, includeClosed],
  );

  const listState: ListState = all
    ? all.length === 0
      ? 'empty'
      : shown.length === 0
        ? 'noMatch'
        : 'items'
    : query.isError || query.isPaused
      ? 'empty'
      : 'loading';
  useEffect(() => onListState?.(listState), [listState, onListState]);

  const extraActive =
    (channel !== DEFAULT_DAY_LIST_QUERY.channel ? 1 : 0) +
    (sort !== DEFAULT_DAY_LIST_QUERY.sort ? 1 : 0) +
    (includeClosed ? 1 : 0);
  const filtered = filter !== 'all' || extraActive > 0 || search.trim() !== '';
  const reset = () => {
    setFilter('all');
    setChannel(DEFAULT_DAY_LIST_QUERY.channel);
    setSort(DEFAULT_DAY_LIST_QUERY.sort);
    setIncludeClosed(false);
    setSearch('');
  };

  const renderItem = useCallback(
    ({ item }: { item: BookingSummary }) => (
      <BookingRow booking={item} selected={item.id === selectedId} onPress={onSelect} />
    ),
    [selectedId, onSelect],
  );

  return (
    <View className="flex-1 bg-background">
      <View className="gap-3 border-b border-border px-4 pb-3 pt-4">
        <SearchField
          value={search}
          onChangeText={setSearch}
          label={t('bookings.list.searchLabel')}
          placeholder={t('bookings.list.searchPlaceholder')}
        />
        <ChipRow bleed label={t('bookings.list.filtersLabel')}>
          {DAY_FILTERS.map((f) => (
            <FilterChip
              key={f}
              label={t(`bookings.list.filters.${f}`)}
              count={counts?.[f]}
              accessibilityLabel={
                counts
                  ? t('bookings.list.chipLabel', {
                      label: t(`bookings.list.filters.${f}`),
                      count: counts[f],
                    })
                  : undefined
              }
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ChipRow>
        <View className="flex-row flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <ChipRow label={t('bookings.list.dayLabel')} scroll={false}>
            {(['today', 'tomorrow'] as const).map((d) => (
              <FilterChip
                key={d}
                label={t(`bookings.list.days.${d}`)}
                selected={day === d}
                onPress={() => setDay(d)}
              />
            ))}
          </ChipRow>
          <Button
            variant="ghost"
            onPress={() => setExpanded((v) => !v)}
            accessibilityState={{ expanded }}
          >
            <Icon as={SlidersHorizontalIcon} size={16} />
            <Text>
              {expanded
                ? t('bookings.list.hideFilters')
                : extraActive > 0
                  ? t('bookings.list.moreFiltersActive', { count: extraActive })
                  : t('bookings.list.moreFilters')}
            </Text>
          </Button>
        </View>
        {expanded ? (
          <View className="gap-3">
            <ChipRow bleed label={t('bookings.list.channelLabel')}>
              {CHANNEL_FILTERS.map((c) => (
                <FilterChip
                  key={c}
                  label={t(`bookings.list.channels.${c}`)}
                  selected={channel === c}
                  onPress={() => setChannel(c)}
                />
              ))}
            </ChipRow>
            <ChipRow bleed label={t('bookings.list.sortLabel')}>
              {DAY_SORTS.map((s) => (
                <FilterChip
                  key={s}
                  label={t(`bookings.list.sorts.${s}`)}
                  selected={sort === s}
                  onPress={() => setSort(s)}
                />
              ))}
            </ChipRow>
            <View className="flex-row">
              <FilterChip
                label={t('bookings.list.includeClosed')}
                selected={includeClosed}
                onPress={() => setIncludeClosed((v) => !v)}
              />
            </View>
          </View>
        ) : null}
        {all ? (
          <Text variant="muted" accessibilityLiveRegion="polite">
            {t('bookings.list.results', { count: shown.length })}
          </Text>
        ) : null}
      </View>

      {all ? (
        <>
          {servedFromCache(query) ? (
            <View className="px-4 pt-3">
              <CachedNotice stale updatedAt={query.dataUpdatedAt} />
            </View>
          ) : null}
          <FlatList
            data={shown}
            keyExtractor={(b) => b.id}
            renderItem={renderItem}
            extraData={selectedId}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerClassName="grow pb-safe"
            refreshControl={
              <RefreshControl
                refreshing={query.isRefetching}
                onRefresh={() => void query.refetch()}
              />
            }
            ListEmptyComponent={
              all.length === 0 ? (
                <StateView
                  align="top"
                  icon={CalendarXIcon}
                  title={t('bookings.list.emptyTitle')}
                  description={t('bookings.list.emptyDescription')}
                />
              ) : (
                <StateView
                  align="top"
                  icon={SearchXIcon}
                  title={t('bookings.list.noMatchTitle')}
                  description={t('bookings.list.noMatchDescription')}
                >
                  {filtered ? (
                    <Button variant="outline" onPress={reset}>
                      <Text>{t('bookings.list.resetFilters')}</Text>
                    </Button>
                  ) : null}
                </StateView>
              )
            }
          />
        </>
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
