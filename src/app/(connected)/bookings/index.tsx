import { router, useLocalSearchParams } from 'expo-router';
import { MousePointerClickIcon } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import type { BookingSummary } from '@/api/types';
import { BookingDetailView } from '@/components/bookings/booking-detail';
import { BookingsList, type ListDay } from '@/components/bookings/bookings-list';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { StateView } from '@/components/state-view';
import { isDayFilter } from '@/features/bookings/day-list';
import { useBooking } from '@/features/bookings/queries';

/**
 * "Prenotazioni del giorno" (phase 1). Phone: the list, a row opens the
 * sheet. Tablet: the list and the sheet side by side, the selection kept in
 * the `selected` parameter. `filter` and `day` come from the figures of "Oggi".
 */
export default function BookingsScreen() {
  const { t } = useTranslation();
  const layout = useDeviceLayout();
  const params = useLocalSearchParams<{ filter?: string; day?: string; selected?: string }>();
  const filter = isDayFilter(params.filter) ? params.filter : 'all';
  const day: ListDay = params.day === 'tomorrow' ? 'tomorrow' : 'today';
  const selected = typeof params.selected === 'string' ? params.selected : undefined;
  const tablet = layout === 'tablet';

  const onSelect = useCallback(
    (b: BookingSummary) => {
      if (tablet) router.setParams({ selected: b.id });
      else router.push({ pathname: '/bookings/[bookingId]', params: { bookingId: b.id } });
    },
    [tablet],
  );

  if (!tablet) {
    return <BookingsList initialFilter={filter} initialDay={day} onSelect={onSelect} />;
  }

  return (
    <View className="flex-1 flex-row bg-background">
      <View className="w-80 border-r border-border xl:w-96">
        <BookingsList
          initialFilter={filter}
          initialDay={day}
          selectedId={selected}
          onSelect={onSelect}
        />
      </View>
      <View className="flex-1" role="region" accessibilityLabel={t('nav.booking')}>
        {selected ? (
          <DetailPane key={selected} bookingId={selected} />
        ) : (
          <StateView
            icon={MousePointerClickIcon}
            title={t('bookings.list.selectTitle')}
            description={t('bookings.list.selectDescription')}
          />
        )}
      </View>
    </View>
  );
}

function DetailPane({ bookingId }: { bookingId: string }) {
  const query = useBooking(bookingId);
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 px-8 py-8 pb-safe"
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
      }
    >
      <View className="w-full max-w-2xl gap-4 self-center">
        <BookingDetailView bookingId={bookingId} />
      </View>
    </ScrollView>
  );
}
