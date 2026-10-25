import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { BookingRef } from '@/features/booking-actions/booking-ref';
import { useInstanceFeature } from '@/features/booking-actions/hooks';
import { useAbilities } from '@/features/permissions/use-abilities';
import { cn } from '@/lib/utils';

import { BookingSummary } from './booking-summary';
import { CashForm } from './cash-form';
import { CheckInAction } from './check-in-action';
import { NoteForm } from './note-form';
import { ReleaseForm } from './release-form';

/**
 * The operations of a booking (spec 02 "Operazioni"): check-in, pass day
 * release, notes, quick cash. Each is shown only to the roles that may do
 * it (useAbilities, core spec 16.1) and when the instance has the feature
 * (/meta `cash`, `season_passes`). Embeddable in the booking sheet and the
 * spot sheet; on tablets the summary and the actions sit side by side.
 */
export function BookingActionsPanel({ booking }: { booking: BookingRef }) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const layout = useDeviceLayout();
  const cash = useInstanceFeature('cash');
  const passes = useInstanceFeature('season_passes');

  const showCheckIn = abilities.canCheckIn;
  const showRelease = abilities.canReleaseDay && passes && booking.is_season_pass;
  const showNote = abilities.canAddNote;
  const showCash = abilities.canCollectCash && cash;
  const nothing = !showCheckIn && !showRelease && !showNote && !showCash;

  return (
    <View className={cn('gap-4', layout === 'tablet' && 'flex-row items-start gap-6')}>
      <View className={cn('gap-4', layout === 'tablet' && 'flex-1')}>
        <BookingSummary booking={booking} />
        {showCheckIn ? (
          <Card>
            <CardHeader>
              <CardTitle role="heading">{t('operations.checkIn.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckInAction booking={booking} />
            </CardContent>
          </Card>
        ) : null}
        {nothing && abilities.known ? (
          <Text variant="muted">{t('operations.booking.nothingAllowed')}</Text>
        ) : null}
      </View>
      {showRelease || showNote || showCash ? (
        <View className={cn('gap-4', layout === 'tablet' && 'flex-1')}>
          {showCash ? <CashForm booking={booking} /> : null}
          {showRelease ? <ReleaseForm booking={booking} /> : null}
          {showNote ? <NoteForm booking={booking} /> : null}
        </View>
      ) : null}
    </View>
  );
}
