import { zodResolver } from '@hookform/resolvers/zod';
import { BanknoteIcon, CircleAlertIcon, CloudOffIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { BookingRef } from '@/features/booking-actions/booking-ref';
import { cashSchema, type CashValues } from '@/features/booking-actions/forms';
import { useBookingOperations, useCashDesk } from '@/features/booking-actions/hooks';
import { canCollect, operationLabel } from '@/features/booking-actions/rules';
import { centsToInput, formatCents, parseCents, type Cents } from '@/lib/money';

import { ConfirmDialog } from './confirm-dialog';
import { QueuedNotice, useQueuedFeedback } from './queued-feedback';

/**
 * Quick cash collection on an existing booking (cash.operate: cashier,
 * manager, owner; checked by the caller). Cash needs an open cash session:
 * online the app checks it first and says so when the desk is closed;
 * offline it cannot know, warns, and queues (a refusal becomes a conflict
 * in the pending operations, ADR 0007). Confirmed before queueing.
 */
export function CashForm({ booking }: { booking: BookingRef }) {
  const { t } = useTranslation();
  const payable = canCollect(booking);
  const desk = useCashDesk(payable);
  const { collectCash } = useBookingOperations(booking);
  const [outcome, report, clear] = useQueuedFeedback();
  const [confirming, setConfirming] = useState<Cents | null>(null);
  const schema = useMemo(() => cashSchema(booking.balance_due), [booking.balance_due]);
  const { control, handleSubmit, reset } = useForm<CashValues>({
    resolver: zodResolver(schema),
    values: { amount: booking.balance_due > 0 ? centsToInput(booking.balance_due) : '' },
  });

  const onSubmit = () =>
    void handleSubmit(({ amount }) => {
      clear();
      setConfirming(parseCents(amount));
    })();

  const onConfirm = async () => {
    const amount = confirming;
    setConfirming(null);
    if (amount === null) return;
    await collectCash(amount);
    reset();
    report();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('operations.cash.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        {!payable ? (
          <Text variant="muted">{t('operations.cash.settled')}</Text>
        ) : (
          <>
            <Text>
              {t('operations.cash.balance', { amount: formatCents(booking.balance_due) })}
            </Text>
            {desk === 'closed' ? (
              <Alert icon={CircleAlertIcon} variant="destructive">
                <AlertDescription>{t('operations.cash.deskClosed')}</AlertDescription>
              </Alert>
            ) : desk === 'unknown' ? (
              <Alert icon={CloudOffIcon}>
                <AlertDescription>{t('operations.cash.deskUnknown')}</AlertDescription>
              </Alert>
            ) : null}
            {desk !== 'closed' ? (
              <>
                <FormField
                  control={control}
                  name="amount"
                  label={t('operations.cash.label')}
                  hint={t('operations.cash.hint')}
                  keyboardType="decimal-pad"
                  autoCorrect={false}
                  onSubmitEditing={onSubmit}
                />
                <Button onPress={onSubmit}>
                  <Icon as={BanknoteIcon} size={16} />
                  <Text>{t('operations.cash.submit')}</Text>
                </Button>
              </>
            ) : null}
          </>
        )}
        <QueuedNotice outcome={outcome} />
      </CardContent>
      <ConfirmDialog
        open={confirming !== null}
        title={t('operations.cash.confirmTitle', { amount: formatCents(confirming ?? 0) })}
        description={t('operations.cash.confirmDescription', { label: operationLabel(booking) })}
        confirmLabel={t('operations.cash.confirm')}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  );
}
