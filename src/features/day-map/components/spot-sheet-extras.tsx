import { router } from 'expo-router';
import {
  ArrowRightLeftIcon,
  CloudOffIcon,
  ListOrderedIcon,
  TicketPlusIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Slots } from '@/api/types';
import { TicketPrint } from '@/components/printing/ticket-print';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useInstanceFeature } from '@/features/booking-actions/hooks';
import { canSell } from '@/features/daily-sale/sale';
import { canMove, MOVABLE_STATUSES } from '@/features/move-booking/move';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import { canViewWaitlist } from '@/features/waitlist/waitlist';
import type { CalendarDate } from '@/lib/calendar';

import type { DaySpot } from '../model';
import { isBookable } from '../status';

/**
 * Phase 2 actions of the spot sheet (spec 03), online only and each hidden
 * from the roles that cannot perform it: the daily quick sale of a free
 * spot, offering it to the waitlist, moving the booking on it and
 * printing the daily ticket of a sold one.
 */
export function SpotSheetExtras({
  spot,
  date,
  today,
  slot,
}: {
  spot: DaySpot;
  date: CalendarDate;
  today: CalendarDate;
  slot: Slots;
}) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const cash = useInstanceFeature('cash');
  const { available: online } = useOnlineOnly();
  const status = spot.serverStatus;
  const ticket = spot.op?.booking?.ticket;

  const sell = cash && canSell(abilities) && date >= today && !!status && isBookable(status);
  const print = !!ticket && !ticket.needs_assignment;
  const booking = spot.op?.booking;
  const move =
    canMove(abilities) &&
    !!booking?.line_id &&
    MOVABLE_STATUSES.has(booking.status) &&
    booking.ends_on >= today;
  // A freed spot (free, or a released pass day) can go to the waitlist.
  const waitlist =
    canViewWaitlist(abilities) && date >= today && !!status && isBookable(status) && !!spot.op;
  if (!sell && !print && !move && !waitlist) return null;

  return (
    <View className="gap-2" accessibilityLabel={t('dayMap.sheet.moreActions')}>
      {sell ? (
        <Button
          size="lg"
          disabled={!online}
          onPress={() =>
            router.push({ pathname: '/sale', params: { spotId: spot.id, date, slot } })
          }
        >
          <Icon as={TicketPlusIcon} size={18} className="text-primary-foreground" />
          <Text>{t('dayMap.actions.sell')}</Text>
        </Button>
      ) : null}
      {move && booking?.line_id ? (
        <Button
          size="lg"
          variant="outline"
          disabled={!online}
          onPress={() =>
            router.push({
              pathname: '/move/[bookingId]',
              params: { bookingId: booking.booking_id, lineId: booking.line_id as string },
            })
          }
        >
          <Icon as={ArrowRightLeftIcon} size={18} />
          <Text>{t('move.action')}</Text>
        </Button>
      ) : null}
      {waitlist && spot.op ? (
        <Button
          size="lg"
          variant="outline"
          disabled={!online}
          onPress={() =>
            router.push({
              pathname: '/waitlist',
              params: {
                spotId: spot.id,
                zoneId: spot.op?.zone_id ?? '',
                label: spot.label,
                date,
              },
            })
          }
        >
          <Icon as={ListOrderedIcon} size={18} />
          <Text>{t('waitlist.offerSpot')}</Text>
        </Button>
      ) : null}
      {(sell || move || waitlist) && !online ? (
        <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
          <Icon as={CloudOffIcon} size={16} className="text-muted-foreground" />
          <Text variant="muted" className="flex-1">
            {t(sell ? 'sale.onlineOnly' : move ? 'move.onlineOnly' : 'waitlist.onlineOnly')}
          </Text>
        </View>
      ) : null}
      {print ? <TicketPrint ticketId={ticket.id} ticketLabel={ticket.label} /> : null}
    </View>
  );
}
