import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  HourglassIcon,
  SendIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { WaitlistEntryStatus, WaitlistOfferStatus } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

const ENTRY_ICON: Record<WaitlistEntryStatus, LucideIcon> = {
  waiting: ClockIcon,
  offered: SendIcon,
  converted: CircleCheckIcon,
  expired: HourglassIcon,
  removed: CircleXIcon,
};

const OFFER_ICON: Record<WaitlistOfferStatus, LucideIcon> = {
  pending: SendIcon,
  accepted: CircleCheckIcon,
  declined: CircleXIcon,
  expired: HourglassIcon,
  revoked: CircleXIcon,
};

/** Status of an entry: icon and label, never colour alone (panel wording). */
export function WaitlistStatusBadge({ status }: { status: WaitlistEntryStatus }) {
  const { t } = useTranslation();
  const open = status === 'waiting' || status === 'offered';
  return (
    <Badge variant={open ? 'secondary' : 'outline'}>
      <Icon
        as={ENTRY_ICON[status]}
        size={12}
        className={open ? 'text-secondary-foreground' : 'text-foreground'}
      />
      <Text>{t(`waitlist.status.${status}`)}</Text>
    </Badge>
  );
}

export function WaitlistOfferBadge({ status }: { status: WaitlistOfferStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline">
      <Icon as={OFFER_ICON[status]} size={12} className="text-foreground" />
      <Text>{t(`waitlist.offerStatus.${status}`)}</Text>
    </Badge>
  );
}
