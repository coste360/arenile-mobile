import { router } from 'expo-router';
import {
  ArrowRightLeftIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LockIcon,
  RefreshCwIcon,
  SearchIcon,
  SearchXIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { isForbidden, ProblemError } from '@/api/errors';
import type { BookingChangeResult, BookingDetail, Ticket } from '@/api/types';
import { DetailRow } from '@/components/detail-row';
import { ScrollToTop } from '@/components/layout/scroll-top';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { OnlineOnlyNotice } from '@/components/online-only-notice';
import { ChoiceGroup } from '@/components/operations/choice-group';
import { ConfirmDialog } from '@/components/operations/confirm-dialog';
import { StateView } from '@/components/state-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useBooking } from '@/features/bookings/queries';
import {
  canMove,
  movable,
  movableLines,
  moveErrorKey,
  moveFrom,
  priceChange,
  targetDay,
  targetSpots,
  toMoveRequest,
  useApplyMove,
  useMovePreview,
  type MoveErrorKey,
} from '@/features/move-booking/move';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useBookingTicket } from '@/features/tickets/queries';
import { formatDayLabel } from '@/lib/calendar';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * "Sposta prenotazione" (spec 03): choose the line and a free spot, see the
 * server's preview (conflicts on other days, new price), confirm. Online
 * only, for roles with bookings.write.
 */
export function MoveView({ bookingId, lineId }: { bookingId: string; lineId?: string }) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const query = useBooking(bookingId);

  if (abilities.known && !canMove(abilities)) {
    return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
  }
  if (query.data && abilities.known) {
    return <MoveForm booking={query.data} initialLineId={lineId} />;
  }
  if (query.isError) {
    if (isForbidden(query.error)) {
      return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
    }
    if (query.error instanceof ProblemError && query.error.status === 404) {
      return <StateView icon={SearchXIcon} title={t('bookings.detail.notFound')} />;
    }
    return (
      <StateView icon={CircleAlertIcon} tone="destructive" title={t('bookings.detail.errorTitle')}>
        <Button variant="outline" onPress={() => void query.refetch()}>
          <Icon as={RefreshCwIcon} size={16} />
          <Text>{t('common.retry')}</Text>
        </Button>
      </StateView>
    );
  }
  return <StateView busy title={t('common.loading')} />;
}

function MoveForm({ booking, initialLineId }: { booking: BookingDetail; initialLineId?: string }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const layout = useDeviceLayout();
  const { available: online } = useOnlineOnly();
  const { today } = useOperationalDays();
  const lines = movableLines(booking);
  const [lineId, setLineId] = useState(
    lines.some((l) => l.id === initialLineId) ? (initialLineId as string) : (lines[0]?.id ?? ''),
  );
  const line = lines.find((l) => l.id === lineId);
  const from = moveFrom(booking, today);
  const day = useOperationsDay(targetDay(booking, from));
  const ticket = useBookingTicket(booking, online);
  const [search, setSearch] = useState('');
  const [spotId, setSpotId] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<MoveErrorKey | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const preview = useMovePreview();
  const apply = useApplyMove();
  const viaTicket: Ticket | null = ticket.data ?? null;

  const candidates = targetSpots(day.data, booking.slots, line?.spot_id, search);
  const target = day.data?.spots.find((s) => s.spot_id === spotId);

  // Preview each choice with a dry run (not for a ticket: its price never changes).
  const previewMutate = preview.mutate;
  const previewReset = preview.reset;
  const selectedLineId = line?.id;
  const ticketMove = !!viaTicket;
  useEffect(() => {
    previewReset();
    if (!spotId || !selectedLineId || !online || ticket.isPending || ticketMove) return;
    previewMutate({
      bookingId: booking.id,
      body: toMoveRequest({ lineId: selectedLineId, spotId, from, dryRun: true }),
      version: booking.version,
    });
  }, [
    spotId,
    selectedLineId,
    online,
    ticket.isPending,
    ticketMove,
    booking.id,
    booking.version,
    from,
    previewMutate,
    previewReset,
  ]);

  if (!movable(booking, today)) {
    return <StateView icon={LockIcon} title={t('move.notMovable', { code: booking.code })} />;
  }
  if (lines.length === 0) {
    return <StateView icon={SearchXIcon} title={t('move.noLines', { code: booking.code })} />;
  }
  if (moved) {
    return (
      <View className="gap-4" testID="move-done">
        <ScrollToTop />
        <Alert icon={CircleCheckIcon} accessibilityLiveRegion="assertive">
          <AlertTitle>{t('move.done.title', { code: booking.code, label: moved })}</AlertTitle>
          <AlertDescription>{t('move.done.description')}</AlertDescription>
        </Alert>
        <Button size="lg" onPress={() => router.back()}>
          <Text>{t('move.done.back')}</Text>
        </Button>
      </View>
    );
  }

  const result: BookingChangeResult | undefined = preview.data;
  const conflicts = result?.conflicts ?? [];
  const previewOk = viaTicket ? true : !!result && conflicts.length === 0;
  const canConfirm =
    online && !!target && previewOk && !preview.isPending && !apply.isPending && !ticket.isPending;

  const confirm = async () => {
    setConfirming(false);
    setError(null);
    if (!line || !target) return;
    try {
      await apply.mutateAsync(
        viaTicket
          ? {
              kind: 'ticket',
              ticketId: viaTicket.id,
              spotId: target.spot_id,
              version: viaTicket.version,
            }
          : {
              kind: 'booking',
              bookingId: booking.id,
              body: toMoveRequest({ lineId: line.id, spotId: target.spot_id, from, dryRun: false }),
              version: booking.version,
            },
      );
      setMoved(target.label);
    } catch (e) {
      setError(moveErrorKey(e));
    }
  };

  const choose = (
    <View className="gap-4">
      {lines.length > 1 ? (
        <ChoiceGroup
          id="move-line"
          label={t('move.line')}
          value={lineId}
          onChange={(v) => {
            setLineId(v);
            setSpotId(undefined);
          }}
          options={lines.map((l) => ({ value: l.id, label: l.spot_label ?? l.id }))}
        />
      ) : null}
      <View className="gap-2">
        <Text variant="small" nativeID="move-search-label">
          {t('move.target')}
        </Text>
        <View className="flex-row items-center gap-2">
          <Icon as={SearchIcon} size={18} className="text-muted-foreground" />
          <Input
            className="flex-1"
            value={search}
            onChangeText={setSearch}
            placeholder={t('move.searchPlaceholder')}
            accessibilityLabel={t('move.search')}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        <Text variant="muted">
          {t('move.freeOn', {
            day: formatDayLabel(targetDay(booking, from), locale),
            slot: t(`dayMap.slot.${booking.slots}`),
          })}
        </Text>
      </View>
      {day.isPending ? (
        <StateView busy title={t('common.loading')} />
      ) : candidates.spots.length === 0 ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {t('move.noSpots')}
        </Text>
      ) : (
        <View
          role="radiogroup"
          accessibilityLabel={t('move.target')}
          className="flex-row flex-wrap gap-2"
        >
          {candidates.spots.map((s) => {
            const selected = s.spot_id === spotId;
            return (
              <Pressable
                key={s.spot_id}
                role="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t('move.spotOption', { label: s.label })}
                onPress={() => {
                  setError(null);
                  setSpotId(s.spot_id);
                }}
                className={cn(
                  'min-h-11 min-w-16 items-center justify-center rounded-md border px-3',
                  selected
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background active:bg-accent',
                )}
              >
                <View className="flex-row items-center gap-1">
                  {selected ? (
                    <Icon as={CheckIcon} size={14} className="text-primary-foreground" />
                  ) : null}
                  <Text
                    className={cn(
                      'font-semibold tabular-nums',
                      selected ? 'text-primary-foreground' : 'text-foreground',
                    )}
                  >
                    {s.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {candidates.more ? <Text variant="muted">{t('move.more')}</Text> : null}
    </View>
  );

  const summary = (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('move.summary')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <DetailRow label={t('move.from')} value={line?.spot_label ?? t('bookings.unassigned')} />
        <DetailRow label={t('move.to')} value={target?.label ?? '—'} />
        {from ? (
          <Text variant="muted">{t('move.fromToday', { day: formatDayLabel(from, locale) })}</Text>
        ) : null}
        {viaTicket ? (
          <Text variant="muted">{t('move.ticketPrice', { number: viaTicket.number_label })}</Text>
        ) : null}
        {preview.isPending ? <Text variant="muted">{t('move.previewing')}</Text> : null}
        {result && conflicts.length > 0 ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="polite">
            <AlertTitle>{t('move.conflicts', { label: target?.label ?? '' })}</AlertTitle>
            {conflicts.map((c) => (
              <AlertDescription key={`${c.date}-${c.slot}`}>
                {t('move.conflictDay', {
                  day: formatDayLabel(c.date, locale),
                  slot: t(`move.halfSlot.${c.slot}`),
                })}
              </AlertDescription>
            ))}
          </Alert>
        ) : null}
        {result && conflicts.length === 0 ? (
          <View accessible accessibilityLiveRegion="polite" className="gap-1">
            {priceChange(result) === 'same' ? (
              <Text>{t('move.priceSame', { total: formatCents(result.new_total) })}</Text>
            ) : (
              <Text className="font-semibold">
                {t(priceChange(result) === 'up' ? 'move.priceUp' : 'move.priceDown', {
                  total: formatCents(result.new_total),
                  diff: formatCents(Math.abs(result.price_difference)),
                })}
              </Text>
            )}
          </View>
        ) : null}
        {preview.error ? (
          <Alert icon={CircleAlertIcon} variant="destructive">
            <AlertDescription>{t(moveErrorKey(preview.error))}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="assertive">
            <AlertTitle>{t('move.failedTitle')}</AlertTitle>
            <AlertDescription>{t(error)}</AlertDescription>
          </Alert>
        ) : null}
        <Button size="lg" disabled={!canConfirm} onPress={() => setConfirming(true)}>
          <Icon as={ArrowRightLeftIcon} size={18} className="text-primary-foreground" />
          <Text>{target ? t('move.submitTo', { label: target.label }) : t('move.submit')}</Text>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text variant="h3" role="heading">
          {t('move.title', { code: booking.code })}
        </Text>
        <Text variant="muted">{booking.customer.display_name}</Text>
      </View>
      <OnlineOnlyNotice />
      <View className={cn('gap-4', layout === 'tablet' && 'flex-row items-start')}>
        <View className={cn(layout === 'tablet' && 'flex-1')}>{choose}</View>
        <View className={cn(layout === 'tablet' && 'flex-1')}>{summary}</View>
      </View>
      <ConfirmDialog
        open={confirming}
        title={t('move.confirm.title', { code: booking.code, label: target?.label ?? '' })}
        description={t('move.confirm.description', {
          from: line?.spot_label ?? '',
          to: target?.label ?? '',
        })}
        confirmLabel={t('move.confirm.submit')}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}
