import { Redirect, useLocalSearchParams } from 'expo-router';

import { BookingDetailView } from '@/components/bookings/booking-detail';
import { Screen } from '@/components/layout/screen';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { useBooking } from '@/features/bookings/queries';

/**
 * Booking sheet on phones. On tablets the sheet lives beside the list, so a
 * link here (from the map, a search) opens the split with it selected.
 */
export default function BookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const layout = useDeviceLayout();
  const query = useBooking(bookingId);

  if (layout === 'tablet') {
    return <Redirect href={{ pathname: '/bookings', params: { selected: bookingId } }} />;
  }
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <BookingDetailView bookingId={bookingId} />
    </Screen>
  );
}
