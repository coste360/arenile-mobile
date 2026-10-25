import { zodResolver } from '@hookform/resolvers/zod';
import {
  BanIcon,
  CalendarMinusIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CloudOffIcon,
  LockOpenIcon,
  LogInIcon,
  XIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import type { Slots } from '@/api/types';
import { useEnqueueOperation, useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import { formatDayLabel, type CalendarDate } from '@/lib/calendar';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

import { hasAnyAction, spotActions } from '../actions';
import { blockSchema, type BlockValues } from '../block-form';
import { blockErrorKey, useBlockSpot, useUnblockSpot } from '../blocks';
import type { DaySpot } from '../model';
import { indicatorsOf } from '../status';
import { SpotSheetExtras } from './spot-sheet-extras';
import { StatusGlyph } from './status-glyph';

type Dialog = 'release' | 'block' | 'unblock' | null;
type Notice = { tone: 'success' | 'error'; text: string } | null;

export interface SpotSheetProps {
  spot: DaySpot;
  date: CalendarDate;
  today: CalendarDate;
  slot: Slots;
  locale: string;
  timeZone?: string;
  onClose: () => void;
  className?: string;
}

/**
 * Card of a spot (core spec 11.3 "tocco su una postazione", phase 1 "Scheda
 * postazione"): status with glyph and label, booking or season pass,
 * customer (only with bookings.read), balance, and the actions the role
 * may perform. Check-in and the release of a pass day go through the offline
 * queue; blocks need the instance.
 */
export function SpotSheet({
  spot,
  date,
  today,
  slot,
  locale,
  timeZone,
  onClose,
  className,
}: SpotSheetProps) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const enqueue = useEnqueueOperation();
  const { available: online } = useOnlineOnly();
  const block = useBlockSpot();
  const unblock = useUnblockSpot();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const op = spot.op;
  const b = op?.booking;
  const actions = spotActions(spot, abilities, { date, today, slot });
  const indicators = indicatorsOf(b);
  const label = `${spot.label}${b ? ` · ${b.code}` : ''}`;
  const queuedHint = online ? '' : ` ${t('dayMap.notices.queued')}`;
  const day = formatDayLabel(date, locale);
  const slotLabel = t(`dayMap.slot.${slot}`);

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ tone: 'success', text: await work() });
    } catch (e) {
      setNotice({ tone: 'error', text: t(blockErrorKey(e)) });
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  const checkIn = () =>
    run(async () => {
      if (!b) throw new Error('no booking');
      await enqueue({
        kind: 'check_in',
        bookingId: b.booking_id,
        ifMatch: `"${b.version}"`,
        label,
      });
      return t('dayMap.notices.checkIn', { code: b.code }) + queuedHint;
    });

  const releaseDay = () =>
    run(async () => {
      if (!b) throw new Error('no booking');
      await enqueue({ kind: 'day_release', bookingId: b.booking_id, date, slots: slot, label });
      return t('dayMap.notices.release', { label: spot.label }) + queuedHint;
    });

  const blockSpot = (values: BlockValues) =>
    run(async () => {
      await block.mutateAsync({ spotId: spot.id, date, slot, reason: values.reason || undefined });
      return t('dayMap.notices.blocked', { label: spot.label });
    });

  const unblockSpot = () =>
    run(async () => {
      if (!op?.block_id) throw new Error('no block');
      await unblock.mutateAsync(op.block_id);
      return t('dayMap.notices.unblocked', { label: spot.label });
    });

  const statusLabel = spot.status ? t(`dayMap.status.${spot.status}`) : t('dayMap.status.unknown');

  return (
    <View className={cn('bg-card', className)} testID="spot-sheet">
      <View className="flex-row items-start gap-3 border-b border-border px-4 py-3">
        <View className="flex-1 gap-1">
          <Text variant="large" role="heading">
            {t('dayMap.sheet.title', { label: spot.label })}
          </Text>
          <View
            className="flex-row flex-wrap items-center gap-2"
            accessible
            accessibilityLabel={`${statusLabel}, ${day}, ${slotLabel}`}
          >
            {spot.status ? <StatusGlyph status={spot.status} size={20} /> : null}
            <Text className="font-medium">{statusLabel}</Text>
            <Text variant="muted">
              {day} · {slotLabel}
            </Text>
          </View>
        </View>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          accessibilityLabel={t('dayMap.sheet.close')}
          onPress={onClose}
        >
          <Icon as={XIcon} size={20} />
        </Button>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 py-4" keyboardShouldPersistTaps="handled">
        {b ? (
          <View className="gap-3" accessibilityLabel={t('dayMap.sheet.booking')}>
            {spot.occupant ? (
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-base font-semibold">{spot.occupant}</Text>
              </View>
            ) : null}
            {b.is_season_pass || b.test || indicators.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {b.is_season_pass ? (
                  <Badge variant="secondary">
                    <Text>{t('dayMap.sheet.seasonPass')}</Text>
                  </Badge>
                ) : null}
                {b.test ? (
                  <Badge variant="outline">
                    <Text>{t('dayMap.sheet.test')}</Text>
                  </Badge>
                ) : null}
                {indicators.map((i) => (
                  <Badge key={i} variant="outline">
                    <Text>{t(`dayMap.indicator.${i}`)}</Text>
                  </Badge>
                ))}
              </View>
            ) : null}
            <View className="gap-1.5">
              {b.ticket ? <Row label={t('dayMap.sheet.ticket')}>{b.ticket.label}</Row> : null}
              <Row label={t('dayMap.sheet.code')}>{b.code}</Row>
              <Row label={t('dayMap.sheet.period')}>
                {b.starts_on === b.ends_on
                  ? formatDayLabel(b.starts_on, locale)
                  : `${formatDayLabel(b.starts_on, locale)} – ${formatDayLabel(b.ends_on, locale)}`}
              </Row>
              <Row label={t('dayMap.sheet.slots')}>{t(`dayMap.slot.${b.slots}`)}</Row>
              <Row label={t('dayMap.sheet.bookingStatus')}>
                {t(`dayMap.bookingStatus.${b.status}`)}
              </Row>
            </View>
            <Separator />
            <View className="gap-1.5">
              <Row label={t('dayMap.sheet.total')}>{formatCents(b.total_amount)}</Row>
              <Row label={t('dayMap.sheet.paid')}>{formatCents(b.paid_amount)}</Row>
              <Row label={t('dayMap.sheet.balance')} emphasis={b.balance_due > 0}>
                {formatCents(b.balance_due)}
              </Row>
            </View>
          </View>
        ) : null}

        <StatusNote spot={spot} locale={locale} timeZone={timeZone} />

        {notice ? (
          <Alert
            icon={notice.tone === 'error' ? CircleAlertIcon : CircleCheckIcon}
            variant={notice.tone === 'error' ? 'destructive' : 'default'}
            accessibilityLiveRegion="polite"
          >
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : null}

        {hasAnyAction(actions) ? (
          <View className="gap-2" accessibilityLabel={t('dayMap.sheet.actions')}>
            {actions.checkIn ? (
              <Button size="lg" disabled={busy} onPress={() => void checkIn()}>
                <Icon as={LogInIcon} size={18} className="text-primary-foreground" />
                <Text>{t('dayMap.actions.checkIn')}</Text>
              </Button>
            ) : null}
            {actions.releaseDay ? (
              <Button
                size="lg"
                variant="outline"
                disabled={busy}
                onPress={() => setDialog('release')}
              >
                <Icon as={CalendarMinusIcon} size={18} />
                <Text>{t('dayMap.actions.releaseDay')}</Text>
              </Button>
            ) : null}
            {actions.block ? (
              <Button
                size="lg"
                variant="outline"
                disabled={busy || !online}
                onPress={() => setDialog('block')}
              >
                <Icon as={BanIcon} size={18} />
                <Text>{t('dayMap.actions.block')}</Text>
              </Button>
            ) : null}
            {actions.unblock ? (
              <Button
                size="lg"
                variant="outline"
                disabled={busy || !online}
                onPress={() => setDialog('unblock')}
              >
                <Icon as={LockOpenIcon} size={18} />
                <Text>{t('dayMap.actions.unblock')}</Text>
              </Button>
            ) : null}
            {(actions.block || actions.unblock) && !online ? (
              <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
                <Icon as={CloudOffIcon} size={16} className="text-muted-foreground" />
                <Text variant="muted" className="flex-1">
                  {t('dayMap.onlineOnly')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : abilities.known && !abilities.canCheckIn && !abilities.canBlockSpot ? (
          <Text variant="muted">{t('dayMap.sheet.readOnly')}</Text>
        ) : null}

        <SpotSheetExtras spot={spot} date={date} today={today} slot={slot} />
      </ScrollView>

      <ConfirmDialog
        open={dialog === 'release'}
        onClose={() => setDialog(null)}
        title={t('dayMap.release.title', { label: spot.label })}
        description={t('dayMap.release.description', {
          customer: spot.occupant ?? t('dayMap.sheet.passHolder'),
          date: day,
          slot: slotLabel,
        })}
        confirm={t('dayMap.release.confirm')}
        busy={busy}
        onConfirm={() => void releaseDay()}
      />
      <ConfirmDialog
        open={dialog === 'unblock'}
        onClose={() => setDialog(null)}
        title={t('dayMap.unblock.title', { label: spot.label })}
        description={t('dayMap.unblock.description')}
        confirm={t('dayMap.unblock.confirm')}
        busy={busy}
        onConfirm={() => void unblockSpot()}
      />
      <BlockDialog
        open={dialog === 'block'}
        onClose={() => setDialog(null)}
        title={t('dayMap.block.title', { label: spot.label })}
        description={t('dayMap.block.description', { date: day, slot: slotLabel })}
        busy={busy}
        onSubmit={(v) => void blockSpot(v)}
      />
    </View>
  );
}

function Row({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <View
      className="flex-row items-baseline justify-between gap-4"
      accessible
      accessibilityLabel={typeof children === 'string' ? `${label}: ${children}` : undefined}
    >
      <Text variant="muted">{label}</Text>
      <Text
        className={cn(
          'flex-shrink text-right font-medium tabular-nums',
          emphasis && 'text-destructive',
        )}
      >
        {children}
      </Text>
    </View>
  );
}

/** What the status means when there is no booking to show (or on top of it). */
function StatusNote({
  spot,
  locale,
  timeZone,
}: {
  spot: DaySpot;
  locale: string;
  timeZone?: string;
}) {
  const { t } = useTranslation();
  const op = spot.op;
  let text: string | null = null;
  switch (spot.serverStatus) {
    case undefined:
      text = t('dayMap.sheet.unknown');
      break;
    case 'free':
      text = t('dayMap.sheet.free');
      break;
    case 'blocked':
      text = op?.block_reason
        ? t('dayMap.sheet.blockedReason', { reason: op.block_reason })
        : t('dayMap.sheet.blocked');
      break;
    case 'closed':
    case 'inactive':
      text = t('dayMap.sheet.unavailable');
      break;
    case 'held':
      text = op?.hold_expires_at
        ? t('dayMap.sheet.holdExpires', {
            time: new Intl.DateTimeFormat(locale, {
              hour: '2-digit',
              minute: '2-digit',
              timeZone,
            }).format(new Date(op.hold_expires_at)),
          })
        : null;
      break;
    default:
      text = null;
  }
  return text ? <Text variant="muted">{text}</Text> : null;
}

function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirm,
  busy,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirm: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            <Text>{t('common.cancel')}</Text>
          </AlertDialogCancel>
          <Button disabled={busy} onPress={onConfirm}>
            <Text>{confirm}</Text>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BlockDialog({
  open,
  onClose,
  title,
  description,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  busy: boolean;
  onSubmit: (values: BlockValues) => void;
}) {
  const { t } = useTranslation();
  const { control, handleSubmit, reset } = useForm<BlockValues>({
    resolver: zodResolver(blockSchema),
    defaultValues: { reason: '' },
    mode: 'onTouched',
  });
  const submit = () => void handleSubmit((v) => onSubmit(v))();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <FormField
          control={control}
          name="reason"
          label={t('dayMap.block.reason')}
          placeholder={t('dayMap.block.reasonPlaceholder')}
          maxLength={200}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            <Text>{t('common.cancel')}</Text>
          </AlertDialogCancel>
          <Button disabled={busy} onPress={submit}>
            <Text>{t('dayMap.block.confirm')}</Text>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
