import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { MousePointerClickIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BookingSummary } from '@/api/types';
import { BookingDetailView } from '@/components/bookings/booking-detail';
import { BookingsList, daySelectionParam } from '@/components/bookings/bookings-list';
import {
  DetailScroll,
  MasterDetail,
  useSplitView,
  type ListState,
} from '@/components/layout/master-detail';
import { isDayFilter } from '@/features/bookings/day-list';
import { useBooking } from '@/features/bookings/queries';

/**
 * "Prenotazioni del giorno" (phase 1). Phone: the list, a row opens the
 * sheet. Tablet with room for both: the list and the sheet side by side, the
 * selection kept in the `selected` parameter. `filter` and `day` come from
 * the figures of "Oggi".
 */
export default function BookingsScreen() {
  const { t } = useTranslation();
  const split = useSplitView();
  const navigation = useNavigation<{ setParams(params: { selected?: string }): void }>();
  const params = useLocalSearchParams<{ filter?: string; day?: string; selected?: string }>();
  const filter = isDayFilter(params.filter) ? params.filter : 'all';
  const day = daySelectionParam(params.day);
  const selected = typeof params.selected === 'string' ? params.selected : undefined;
  const [listState, setListState] = useState<ListState>('loading');

  const onSelect = useCallback(
    (b: BookingSummary) => {
      if (split) router.setParams({ selected: b.id });
      else router.push({ pathname: '/bookings/[bookingId]', params: { bookingId: b.id } });
    },
    [split],
  );

  // The window got too narrow for the split (rotation, Split View): the open
  // sheet goes on as on phones.
  useEffect(() => {
    if (split || !selected) return;
    // On this list's own route: router.setParams would target the screen pushed right after.
    navigation.setParams({ selected: undefined });
    router.push({ pathname: '/bookings/[bookingId]', params: { bookingId: selected } });
  }, [split, selected, navigation]);

  const list = (
    <BookingsList
      initialFilter={filter}
      initialDay={day}
      selectedId={split ? selected : undefined}
      onSelect={onSelect}
      onListState={setListState}
    />
  );
  if (!split) return list;

  return (
    <MasterDetail
      list={list}
      listState={listState}
      detailLabel={t('nav.booking')}
      detail={selected ? <DetailPane key={selected} bookingId={selected} /> : null}
      placeholder={{
        icon: MousePointerClickIcon,
        title: t('bookings.list.selectTitle'),
        description: t('bookings.list.selectDescription'),
      }}
    />
  );
}

function DetailPane({ bookingId }: { bookingId: string }) {
  const query = useBooking(bookingId);
  return (
    <DetailScroll refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <BookingDetailView bookingId={bookingId} />
    </DetailScroll>
  );
}
