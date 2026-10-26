import { useLocalSearchParams } from 'expo-router';

import { BookingDetailView } from '@/components/bookings/booking-detail';
import { Screen } from '@/components/layout/screen';
import { ToSplit, useSplitView } from '@/components/layout/master-detail';
import { useBooking } from '@/features/bookings/queries';

/**
 * Booking sheet on phones. When the sheet fits beside the list, a
 * link here (from the map, a search) opens the split with it selected.
 */
export default function BookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const split = useSplitView();
  const query = useBooking(bookingId);

  if (split) {
    return <ToSplit href={{ pathname: '/bookings', params: { selected: bookingId } }} />;
  }
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <BookingDetailView bookingId={bookingId} />
    </Screen>
  );
}
