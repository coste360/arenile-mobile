import { router } from 'expo-router';
import { CircleAlertIcon, LockIcon, LockOpenIcon, ChevronRightIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DetailRow } from '@/components/detail-row';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import type { OperationalSpot, Slots } from '@/api/types';
import { onlineErrorKey } from '@/features/booking-actions/errors';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationalDays } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import {
  BLOCK_PERIODS,
  BLOCK_REASON_MAX,
  spotBlockAction,
  toSpotBlockCreate,
  useCreateSpotBlock,
  useDeleteSpotBlock,
  type BlockPeriod,
} from '@/features/spot-blocks/spot-blocks';

import { ChoiceGroup } from './choice-group';
import { ConfirmDialog } from './confirm-dialog';
import { SpotStatusLabel } from './spot-status';

const SLOTS: readonly Slots[] = ['FULL', 'AM', 'PM'];

/**
 * The spot sheet's operations (spec 02): its status today, the booking on
 * it, and block / unblock (operations.run). Blocks are online-only (ADR
 * 0008): offline the form is replaced by the reason.
 */
export function SpotActionsPanel({ spot }: { spot: OperationalSpot }) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const action = spotBlockAction(spot);

  return (
    <View className="gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle role="heading">{t('operations.spot.title', { label: spot.label })}</CardTitle>
          <SpotStatusLabel status={spot.status} />
        </CardHeader>
        <CardContent className="gap-4">
          {spot.status === 'blocked' && spot.block_reason ? (
            <DetailRow label={t('operations.spot.blockReason')} value={spot.block_reason} />
          ) : null}
          {spot.booking ? (
            <>
              <DetailRow label={t('operations.spot.booking')} value={spot.booking.code} />
              <Button
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: '/operations/booking/[bookingId]',
                    params: { bookingId: spot.booking!.booking_id },
                  })
                }
              >
                <Text>{t('operations.spot.openBooking')}</Text>
                <Icon as={ChevronRightIcon} size={16} />
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
      {abilities.canBlockSpot && action === 'block' ? <BlockForm spot={spot} /> : null}
      {abilities.canBlockSpot && action === 'unblock' ? <UnblockAction spot={spot} /> : null}
    </View>
  );
}

function OnlineOnlyBlock() {
  const { t } = useTranslation();
  return (
    <Alert icon={CircleAlertIcon} accessibilityLiveRegion="polite">
      <AlertDescription>{t('operations.block.onlineOnly')}</AlertDescription>
    </Alert>
  );
}

function BlockForm({ spot }: { spot: OperationalSpot }) {
  const { t } = useTranslation();
  const { today } = useOperationalDays();
  const { available } = useOnlineOnly();
  const create = useCreateSpotBlock();
  const [period, setPeriod] = useState<BlockPeriod>('today');
  const [slots, setSlots] = useState<Slots>('FULL');
  const [reason, setReason] = useState('');
  const tooLong = reason.trim().length > BLOCK_REASON_MAX;

  const submit = () => {
    if (tooLong) return;
    create.mutate(toSpotBlockCreate({ spotId: spot.spot_id, period, slots, reason, today }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('operations.block.title')}</CardTitle>
        <CardDescription>{t('operations.block.description')}</CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        {!available ? (
          <OnlineOnlyBlock />
        ) : (
          <>
            <ChoiceGroup
              id="block-period"
              label={t('operations.block.period')}
              value={period}
              options={BLOCK_PERIODS.map((p) => ({
                value: p,
                label: t(`operations.block.periods.${p}`),
              }))}
              onChange={setPeriod}
            />
            <ChoiceGroup
              id="block-slot"
              label={t('operations.block.slot')}
              value={slots}
              options={SLOTS.map((s) => ({ value: s, label: t(`operations.slots.${s}`) }))}
              onChange={setSlots}
            />
            <View className="gap-2">
              <Label nativeID="block-reason">{t('operations.block.reason')}</Label>
              <Input
                value={reason}
                onChangeText={setReason}
                placeholder={t('operations.block.reasonPlaceholder')}
                accessibilityLabel={t('operations.block.reason')}
                accessibilityLabelledBy="block-reason"
                aria-invalid={tooLong}
                className={tooLong ? 'border-destructive' : undefined}
              />
              {tooLong ? (
                <Text variant="small" className="text-destructive" accessibilityLiveRegion="polite">
                  {t('operations.block.reasonTooLong')}
                </Text>
              ) : null}
            </View>
            <Button onPress={submit} disabled={create.isPending || tooLong}>
              <Icon as={LockIcon} size={16} />
              <Text>{t('operations.block.submit')}</Text>
            </Button>
          </>
        )}
        {create.isError ? (
          <Text className="text-destructive" accessibilityLiveRegion="polite">
            {t(onlineErrorKey(create.error))}
          </Text>
        ) : null}
        {create.isSuccess ? (
          <Text accessibilityLiveRegion="polite">{t('operations.block.done')}</Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UnblockAction({ spot }: { spot: OperationalSpot }) {
  const { t } = useTranslation();
  const { available } = useOnlineOnly();
  const remove = useDeleteSpotBlock();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card>
      <CardContent className="gap-4 pt-6">
        {!available ? (
          <OnlineOnlyBlock />
        ) : (
          <Button variant="outline" onPress={() => setConfirming(true)} disabled={remove.isPending}>
            <Icon as={LockOpenIcon} size={16} />
            <Text>{t('operations.block.unblock')}</Text>
          </Button>
        )}
        {remove.isError ? (
          <Text className="text-destructive" accessibilityLiveRegion="polite">
            {t(onlineErrorKey(remove.error))}
          </Text>
        ) : null}
        {remove.isSuccess ? (
          <Text accessibilityLiveRegion="polite">{t('operations.block.unblocked')}</Text>
        ) : null}
      </CardContent>
      <ConfirmDialog
        open={confirming}
        title={t('operations.block.unblockTitle', { label: spot.label })}
        description={t('operations.block.unblockDescription')}
        confirmLabel={t('operations.block.unblock')}
        onConfirm={() => {
          setConfirming(false);
          if (spot.block_id) remove.mutate(spot.block_id);
        }}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}
