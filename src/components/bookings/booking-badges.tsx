import {
  CheckCheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  FilePenIcon,
  FlaskConicalIcon,
  GlobeIcon,
  HourglassIcon,
  TicketIcon,
  TimerOffIcon,
  UserCheckIcon,
  UserXIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { BookingStatus, BookingSummary } from '@/api/types';

/** Each status has its own symbol, so it is never told by colour alone. */
const STATUS_ICON: Record<BookingStatus, LucideIcon> = {
  draft: FilePenIcon,
  held: ClockIcon,
  pending_payment: ClockIcon,
  awaiting_approval: HourglassIcon,
  confirmed: CircleCheckIcon,
  checked_in: UserCheckIcon,
  completed: CheckCheckIcon,
  cancelled: CircleXIcon,
  no_show: UserXIcon,
  expired: TimerOffIcon,
  rejected: CircleXIcon,
};

const NEGATIVE: readonly BookingStatus[] = ['cancelled', 'no_show', 'expired', 'rejected'];

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const negative = NEGATIVE.includes(status);
  return (
    <Badge variant={status === 'checked_in' ? 'default' : negative ? 'outline' : 'secondary'}>
      <Icon
        as={STATUS_ICON[status]}
        size={12}
        className={
          status === 'checked_in'
            ? 'text-primary-foreground'
            : negative
              ? 'text-destructive'
              : 'text-secondary-foreground'
        }
      />
      <Text>{t(`bookings.status.${status}`)}</Text>
    </Badge>
  );
}

/** Season pass, sales channel (not shown for the desk, the usual case) and test mode. */
export function BookingKindBadges({
  booking,
}: {
  booking: Pick<BookingSummary, 'is_season_pass' | 'channel' | 'test'>;
}) {
  const { t } = useTranslation();
  return (
    <>
      {booking.is_season_pass ? (
        <Badge variant="outline">
          <Icon as={TicketIcon} size={12} className="text-foreground" />
          <Text>{t('bookings.seasonPass')}</Text>
        </Badge>
      ) : null}
      {booking.channel !== 'desk' ? (
        <Badge variant="outline">
          <Icon as={GlobeIcon} size={12} className="text-foreground" />
          <Text>{t(`bookings.channel.${booking.channel}`)}</Text>
        </Badge>
      ) : null}
      {booking.test ? (
        <Badge variant="outline">
          <Icon as={FlaskConicalIcon} size={12} className="text-foreground" />
          <Text>{t('bookings.test')}</Text>
        </Badge>
      ) : null}
    </>
  );
}
