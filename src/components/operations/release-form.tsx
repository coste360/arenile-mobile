import { CalendarMinusIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Slots } from '@/api/types';
import type { BookingRef } from '@/features/booking-actions/booking-ref';
import { useBookingOperations } from '@/features/booking-actions/hooks';
import { operationLabel, releasableDays, releasableSlots } from '@/features/booking-actions/rules';
import { useOperationalDays } from '@/features/operations/queries';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatDayLabel, type CalendarDate } from '@/lib/calendar';

import { ChoiceGroup } from './choice-group';
import { ConfirmDialog } from './confirm-dialog';
import { QueuedNotice, useQueuedFeedback } from './queued-feedback';

/**
 * Release of a season pass day (operations.run, checked by the caller):
 * today or tomorrow, the whole day or a half, confirmed, then queued
 * (ADR 0007). The spot becomes bookable for others.
 */
export function ReleaseForm({ booking }: { booking: BookingRef }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const days = useOperationalDays();
  const { releaseDay } = useBookingOperations(booking);
  const [outcome, report, clear] = useQueuedFeedback();
  const dates = releasableDays(booking, days);
  const slotOptions = releasableSlots(booking.slots);
  const [date, setDate] = useState<CalendarDate | undefined>(dates[0]);
  const [slots, setSlots] = useState<Slots>(slotOptions[0] ?? 'FULL');
  const [confirming, setConfirming] = useState(false);
  const selected = date && dates.includes(date) ? date : dates[0];

  const onConfirm = async () => {
    setConfirming(false);
    if (!selected) return;
    await releaseDay(selected, slots);
    report();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('operations.release.title')}</CardTitle>
        <CardDescription>{t('operations.release.description')}</CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        {selected ? (
          <>
            <ChoiceGroup
              id="release-day"
              label={t('operations.release.day')}
              value={selected}
              options={dates.map((d) => ({ value: d, label: formatDayLabel(d, locale) }))}
              onChange={(d) => {
                clear();
                setDate(d);
              }}
            />
            {slotOptions.length > 1 ? (
              <ChoiceGroup
                id="release-slot"
                label={t('operations.release.slot')}
                value={slots}
                options={slotOptions.map((s) => ({ value: s, label: t(`operations.slots.${s}`) }))}
                onChange={(s) => {
                  clear();
                  setSlots(s);
                }}
              />
            ) : null}
            <Button variant="outline" onPress={() => setConfirming(true)}>
              <Icon as={CalendarMinusIcon} size={16} />
              <Text>{t('operations.release.submit')}</Text>
            </Button>
          </>
        ) : (
          <Text variant="muted">{t('operations.release.none')}</Text>
        )}
        <QueuedNotice outcome={outcome} />
      </CardContent>
      <ConfirmDialog
        open={confirming}
        title={t('operations.release.confirmTitle', {
          date: selected ? formatDayLabel(selected, locale) : '',
        })}
        description={t('operations.release.confirmDescription', {
          label: operationLabel(booking),
          slot: t(`operations.slots.${slots}`),
        })}
        confirmLabel={t('operations.release.confirm')}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}
