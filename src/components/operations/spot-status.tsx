import {
  BanIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  ClockIcon,
  LockIcon,
  RefreshCwIcon,
  TicketIcon,
  UndoDotIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { OperationalSpotStatus } from '@/api/types';

/** One symbol per status of the operational map (spec 11.3): never colour alone. */
export const SPOT_STATUS_ICON: Record<OperationalSpotStatus, LucideIcon> = {
  free: CircleIcon,
  booked: CircleDotIcon,
  checked_in: CircleCheckIcon,
  pass_holder: TicketIcon,
  released: UndoDotIcon,
  held: ClockIcon,
  renewal_offer: RefreshCwIcon,
  blocked: LockIcon,
  closed: BanIcon,
  inactive: CircleDashedIcon,
};

/** Status of a spot as symbol and text. */
export function SpotStatusLabel({ status }: { status: OperationalSpotStatus }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-1" accessible>
      <Icon as={SPOT_STATUS_ICON[status]} size={16} className="text-muted-foreground" />
      <Text className="text-sm">{t(`operations.spotStatus.${status}`)}</Text>
    </View>
  );
}
