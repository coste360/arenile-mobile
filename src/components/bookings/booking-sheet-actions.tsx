import { router } from 'expo-router';
import {
  ArrowRightLeftIcon,
  CircleAlertIcon,
  CloudOffIcon,
  MessageCircleIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { BookingDetail } from '@/api/types';
import { TicketPrint } from '@/components/printing/ticket-print';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  canShareSummary,
  shareable,
  shareErrorKey,
  useShareSummary,
} from '@/features/bookings/sheet-actions';
import { canMove, movable, movableLines } from '@/features/move-booking/move';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationalDays } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { useBookingTicket } from '@/features/tickets/queries';

/**
 * Online actions of the booking sheet (spec 03, core 1.1), hidden from the
 * roles that cannot perform them: move the booking to another spot, send
 * the summary to the customer, print its daily ticket.
 */
export function BookingSheetActions({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const { available: online } = useOnlineOnly();
  const { today } = useOperationalDays();
  const share = useShareSummary(booking.id);
  const move = canMove(abilities) && movable(booking, today) && movableLines(booking).length > 0;
  const sharing = canShareSummary(abilities) && shareable(booking);
  // Only desk bookings can come from a daily sale.
  const lookTicket = abilities.canCollectCash && booking.channel === 'desk';
  const ticket = useBookingTicket(booking, online && lookTicket);
  const printable = ticket.data && !ticket.data.needs_assignment ? ticket.data : null;

  if (!move && !sharing && !printable) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('bookings.detail.actionsTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        {move ? (
          <Button
            size="lg"
            variant="outline"
            disabled={!online}
            onPress={() =>
              router.push({ pathname: '/move/[bookingId]', params: { bookingId: booking.id } })
            }
          >
            <Icon as={ArrowRightLeftIcon} size={18} />
            <Text>{t('move.action')}</Text>
          </Button>
        ) : null}
        {sharing ? (
          <Button
            size="lg"
            variant="outline"
            disabled={!online || share.isPending}
            accessibilityHint={t('bookings.share.hint')}
            onPress={() => share.mutate()}
          >
            <Icon as={MessageCircleIcon} size={18} />
            <Text>{t('bookings.share.action')}</Text>
          </Button>
        ) : null}
        {sharing ? <Text variant="muted">{t('bookings.share.newLink')}</Text> : null}
        {share.error ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="assertive">
            <AlertDescription>{t(shareErrorKey(share.error))}</AlertDescription>
          </Alert>
        ) : null}
        {(move || sharing) && !online ? (
          <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
            <Icon as={CloudOffIcon} size={16} className="text-muted-foreground" />
            <Text variant="muted" className="flex-1">
              {t('bookings.detail.actionsOnlineOnly')}
            </Text>
          </View>
        ) : null}
        {printable ? (
          <TicketPrint ticketId={printable.id} ticketLabel={printable.number_label} />
        ) : null}
      </CardContent>
    </Card>
  );
}
