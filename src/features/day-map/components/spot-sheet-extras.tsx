import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { TicketPrint } from '@/components/printing/ticket-print';
import type { Slots } from '@/api/types';
import type { CalendarDate } from '@/lib/calendar';

import type { DaySpot } from '../model';

/**
 * Phase 2 actions of the spot sheet (spec 03), all online only and each
 * hidden from the roles that cannot perform it: print the daily ticket of
 * the spot.
 */
export function SpotSheetExtras({
  spot,
}: {
  spot: DaySpot;
  date: CalendarDate;
  today: CalendarDate;
  slot: Slots;
}) {
  const { t } = useTranslation();
  const ticket = spot.op?.booking?.ticket;
  if (!ticket || ticket.needs_assignment) return null;
  return (
    <View className="gap-2" accessibilityLabel={t('dayMap.sheet.ticketActions')}>
      <TicketPrint ticketId={ticket.id} ticketLabel={ticket.label} />
    </View>
  );
}
