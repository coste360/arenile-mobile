import {
  BanIcon,
  CircleCheckIcon,
  CircleDotIcon,
  ClockIcon,
  TicketIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DetailRow } from '@/components/detail-row';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { BookingStatus } from '@/api/types';
import type { BookingRef } from '@/features/booking-actions/booking-ref';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatDayLabel } from '@/lib/calendar';
import { formatCents } from '@/lib/money';

const STATUS_ICON: Partial<Record<BookingStatus, LucideIcon>> = {
  confirmed: CircleDotIcon,
  checked_in: CircleCheckIcon,
  completed: CircleCheckIcon,
  held: ClockIcon,
  pending_payment: ClockIcon,
  awaiting_approval: ClockIcon,
};

/** Booking status as a badge: icon shape and text, never colour alone. */
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const ended = !STATUS_ICON[status];
  return (
    <Badge variant={ended ? 'destructive' : status === 'checked_in' ? 'default' : 'secondary'}>
      <Icon as={STATUS_ICON[status] ?? BanIcon} size={12} />
      <Text>{t(`operations.bookingStatus.${status}`)}</Text>
    </Badge>
  );
}

/**
 * Who, where and how much of a booking (spec 02 "Scheda prenotazione"):
 * code, status, spots, customer (bookings.read, never contact details),
 * period and amounts in cents formatted in Italian.
 */
export function BookingSummary({ booking }: { booking: BookingRef }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const period =
    booking.starts_on === booking.ends_on
      ? formatDayLabel(booking.starts_on, locale)
      : t('operations.booking.periodRange', {
          from: formatDayLabel(booking.starts_on, locale),
          to: formatDayLabel(booking.ends_on, locale),
        });
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 gap-1">
          <CardTitle role="heading">
            {t('operations.booking.title', { code: booking.code })}
          </CardTitle>
          {booking.is_season_pass ? (
            <View className="flex-row items-center gap-1">
              <Icon as={TicketIcon} size={14} className="text-muted-foreground" />
              <Text variant="muted">{t('operations.booking.seasonPass')}</Text>
            </View>
          ) : null}
        </View>
        <BookingStatusBadge status={booking.status} />
      </CardHeader>
      <CardContent className="gap-4">
        {booking.spotLabels.length ? (
          <DetailRow label={t('operations.booking.spots')} value={booking.spotLabels.join(', ')} />
        ) : null}
        <DetailRow
          label={t('operations.booking.customer')}
          value={booking.customerName || t('operations.booking.anonymous')}
        />
        <DetailRow label={t('operations.booking.period')} value={period} />
        <View className="flex-row flex-wrap gap-6">
          <DetailRow
            label={t('operations.booking.total')}
            value={formatCents(booking.total_amount)}
          />
          <DetailRow
            label={t('operations.booking.paid')}
            value={formatCents(booking.paid_amount)}
          />
          <DetailRow
            label={t('operations.booking.balance')}
            value={formatCents(booking.balance_due)}
          />
        </View>
      </CardContent>
    </Card>
  );
}
