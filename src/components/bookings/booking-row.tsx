import { ChevronRightIcon } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { BookingSummary } from '@/api/types';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatDayLabel } from '@/lib/calendar';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

import { BookingKindBadges, BookingStatusBadge } from './booking-badges';

/**
 * One booking of the day list: spot(s), customer, code, stay when longer
 * than the day, status and what is still due. Read as one button.
 */
export const BookingRow = memo(function BookingRow({
  booking: b,
  selected = false,
  onPress,
}: {
  booking: BookingSummary;
  selected?: boolean;
  onPress: (booking: BookingSummary) => void;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const spots = b.spot_labels.length > 0 ? b.spot_labels.join(', ') : t('bookings.unassigned');
  const name = b.customer_display_name.trim() || t('bookings.anonymous');
  const multiDay = b.starts_on !== b.ends_on;
  const stay = multiDay
    ? t('bookings.stay', {
        from: formatDayLabel(b.starts_on, locale),
        to: formatDayLabel(b.ends_on, locale),
      })
    : null;
  const due =
    b.balance_due > 0
      ? t('bookings.balanceDue', { amount: formatCents(b.balance_due) })
      : t('bookings.settled');
  const status = t(`bookings.status.${b.status}`);
  const slot = b.slots !== 'FULL' ? t(`bookings.slots.${b.slots}`) : null;
  const label = [spots, name, b.code, status, slot, stay, due].filter(Boolean).join(', ');

  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      accessibilityHint={t('bookings.list.rowHint')}
      accessibilityState={{ selected }}
      onPress={() => onPress(b)}
      testID={`booking-row-${b.id}`}
      className={cn(
        'min-h-16 flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-accent',
        selected && 'bg-accent',
      )}
    >
      <View className="w-16">
        <Text className="font-semibold" numberOfLines={2}>
          {spots}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        <Text className="font-medium" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {[b.code, slot, stay].filter(Boolean).join(' · ')}
        </Text>
        <View className="flex-row flex-wrap gap-1">
          <BookingStatusBadge status={b.status} />
          <BookingKindBadges booking={b} />
        </View>
      </View>
      <View className="items-end gap-1">
        <Text
          className={cn(
            'text-sm',
            b.balance_due > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground',
          )}
        >
          {due}
        </Text>
      </View>
      <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
    </Pressable>
  );
});
