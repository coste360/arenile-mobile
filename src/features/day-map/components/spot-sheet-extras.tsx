import { router } from 'expo-router';
import { CloudOffIcon, TicketPlusIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Slots } from '@/api/types';
import { TicketPrint } from '@/components/printing/ticket-print';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useInstanceFeature } from '@/features/booking-actions/hooks';
import { canSell } from '@/features/daily-sale/sale';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import type { CalendarDate } from '@/lib/calendar';

import type { DaySpot } from '../model';
import { isBookable } from '../status';

/**
 * Phase 2 actions of the spot sheet (spec 03), online only and each hidden
 * from the roles that cannot perform it: the daily quick sale of a free
 * spot and the printing of the daily ticket of a sold one.
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
  if (!sell && !print) return null;

  return (
    <View className="gap-2" accessibilityLabel={t('dayMap.sheet.moreActions')}>
      {sell ? (
        <>
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
          {!online ? (
            <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
              <Icon as={CloudOffIcon} size={16} className="text-muted-foreground" />
              <Text variant="muted" className="flex-1">
                {t('sale.onlineOnly')}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
      {print ? <TicketPrint ticketId={ticket.id} ticketLabel={ticket.label} /> : null}
    </View>
  );
}
