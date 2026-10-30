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
  Undo2Icon,
} from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { isForbidden, ProblemError } from '@/api/errors';
import type {
  BookingChangeResult,
  BookingDetail,
  BookingSwapResult,
  MoveUndoInfo,
  OperationalSpot,
  Ticket,
} from '@/api/types';
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
  lastMoveOf,
  movable,
  lineSpotOn,
  lineSpotsFrom,
  movableLines,
  moveErrorKey,
  moveFrom,
  moveStarts,
  priceChange,
  swapCandidates,
  swapErrorKey,
  targetDay,
  targetSpots,
  toMoveRequest,
  toSwapRequest,
  undoErrorKey,
  undoOpen,
  undoScope,
  useApplyMove,
  useLastMove,
  useMovePreview,
  useSwapPreview,
  useUndoMove,
  type MoveErrorKey,
  type MoveStart,
  type UndoErrorKey,
  type UndoScope,
} from '@/features/move-booking/move';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useBookingTicket } from '@/features/tickets/queries';
import { formatDayLabel } from '@/lib/calendar';
import { formatTime } from '@/lib/datetime';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useDependencies } from '@/providers/dependencies';

/**
 * "Sposta prenotazione" (spec 03): choose the line and a free spot, see the
 * server's preview (conflicts on other days, new price), confirm. Online
 * only, for roles with bookings.write. Core 1.1 (spec 30.7): from today or
 * tomorrow, swap with another booking, undo within 5 minutes.
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

type Mode = 'move' | 'swap';

interface Done {
  title: string;
  undo?: MoveUndoInfo;
  /** Code of the other booking of a swap, named by the undo. */
  otherCode?: string;
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
  const [start, setStart] = useState<MoveStart>('today');
  const [mode, setMode] = useState<Mode>('move');
  const from = moveFrom(booking, today, start);
  const firstDay = targetDay(booking, from);
  const day = useOperationsDay(firstDay);
  // A split stay holds another spot on later days: the one of the first day moved.
  const current = line ? lineSpotOn(line, firstDay) : {};
  const freed = line
    ? lineSpotsFrom(line, firstDay)
        .map((l) => l ?? t('bookings.unassigned'))
        .join(' → ')
    : t('bookings.unassigned');
  const ticket = useBookingTicket(booking, online);
  const [search, setSearch] = useState('');
  const [spotId, setSpotId] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<MoveErrorKey | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const preview = useMovePreview();
  const swapPreview = useSwapPreview();
  const apply = useApplyMove();
  const viaTicket: Ticket | null = ticket.data ?? null;
  // A daily ticket moves through the ticket, for its day only: no start, no swap.
  const swapping = mode === 'swap' && !viaTicket;
  const starts = viaTicket ? [] : moveStarts(booking, today);

  const free = targetSpots(day.data, booking.slots, current.spotId, search);
  const taken = swapCandidates(day.data, booking.id, search);
  const candidates = swapping ? taken : free;
  const target = candidates.spots.find((s) => s.spot_id === spotId);
  const other = swapping ? taken.spots.find((s) => s.spot_id === spotId)?.booking : undefined;

  // Preview each choice with a dry run (not for a ticket: its price never changes).
  const previewMutate = preview.mutate;
  const previewReset = preview.reset;
  const swapMutate = swapPreview.mutate;
  const swapReset = swapPreview.reset;
  const selectedLineId = line?.id;
  const ticketMove = !!viaTicket;
  const otherBookingId = other?.booking_id;
  const otherLineId = other?.line_id;
  const otherVersion = other?.version;
  useEffect(() => {
    previewReset();
    swapReset();
    if (!spotId || !selectedLineId || !online || ticket.isPending || ticketMove) return;
    if (swapping) {
      if (!otherBookingId || !otherLineId || otherVersion === undefined) return;
      swapMutate(
        toSwapRequest({
          bookingId: booking.id,
          lineId: selectedLineId,
          version: booking.version,
          other: { booking_id: otherBookingId, line_id: otherLineId, version: otherVersion },
          from: firstDay,
          dryRun: true,
        }),
      );
      return;
    }
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
    swapping,
    otherBookingId,
    otherLineId,
    otherVersion,
    booking.id,
    booking.version,
    from,
    firstDay,
    previewMutate,
    previewReset,
    swapMutate,
    swapReset,
  ]);

  if (done) {
    return <MoveDone bookingId={booking.id} done={done} />;
  }
  if (!movable(booking, today)) {
    return <StateView icon={LockIcon} title={t('move.notMovable', { code: booking.code })} />;
  }
  if (lines.length === 0) {
    return <StateView icon={SearchXIcon} title={t('move.noLines', { code: booking.code })} />;
  }

  const result: BookingChangeResult | undefined = swapping ? undefined : preview.data;
  const swapResult: BookingSwapResult | undefined = swapping ? swapPreview.data : undefined;
  const conflicts = (swapping ? swapResult?.conflicts : result?.conflicts) ?? [];
  const previewError = swapping ? swapPreview.error : preview.error;
  const previewPending = swapping ? swapPreview.isPending : preview.isPending;
  const previewOk = viaTicket
    ? true
    : swapping
      ? !!swapResult && conflicts.length === 0
      : !!result && conflicts.length === 0;
  const canConfirm =
    online && !!target && previewOk && !previewPending && !apply.isPending && !ticket.isPending;
  const otherCode = other?.code ?? '';

  const confirm = async () => {
    setConfirming(false);
    setError(null);
    if (!line || !target) return;
    try {
      if (swapping && other) {
        const outcome = await apply.mutateAsync({
          kind: 'swap',
          body: toSwapRequest({
            bookingId: booking.id,
            lineId: line.id,
            version: booking.version,
            other,
            from: firstDay,
            dryRun: false,
          }),
        });
        setDone({
          title: t('move.swap.done.title', { code: booking.code, other: other.code }),
          undo: outcome.undo,
          otherCode: other.code,
        });
        return;
      }
      const outcome = await apply.mutateAsync(
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
      setDone({
        title: t('move.done.title', { code: booking.code, label: target.label }),
        undo: outcome.undo,
      });
    } catch (e) {
      // A refused swap refreshes both bookings (useApplyMove): with the new
      // versions the preview runs again and the message points to it.
      setError(swapping ? swapErrorKey(e) : moveErrorKey(e));
    }
  };

  const reset = () => {
    setError(null);
    setSpotId(undefined);
  };

  const choose = (
    <View className="gap-4">
      {!viaTicket ? <LastMoveNotice booking={booking} /> : null}
      {lines.length > 1 ? (
        <ChoiceGroup
          id="move-line"
          label={t('move.line')}
          value={lineId}
          onChange={(v) => {
            setLineId(v);
            reset();
          }}
          options={lines.map((l) => ({
            value: l.id,
            label: lineSpotOn(l, firstDay).label ?? l.id,
          }))}
        />
      ) : null}
      {starts.length > 0 ? (
        <ChoiceGroup
          id="move-start"
          label={t('move.start.label')}
          value={start}
          onChange={(v) => {
            setStart(v);
            reset();
          }}
          options={starts.map((s) => ({
            value: s,
            label: `${t(`move.start.${s}`)} · ${formatDayLabel(
              moveFrom(booking, today, s) ?? today,
              locale,
            )}`,
          }))}
        />
      ) : null}
      {!viaTicket ? (
        <ChoiceGroup
          id="move-mode"
          label={t('move.mode.label')}
          value={mode}
          onChange={(v) => {
            setMode(v);
            reset();
          }}
          options={[
            { value: 'move', label: t('move.mode.move') },
            { value: 'swap', label: t('move.mode.swap') },
          ]}
        />
      ) : null}
      <View className="gap-2">
        <Text variant="small" nativeID="move-search-label">
          {swapping ? t('move.swap.target') : t('move.target')}
        </Text>
        <View className="flex-row items-center gap-2">
          <Icon as={SearchIcon} size={18} className="text-muted-foreground" />
          <Input
            className="flex-1"
            value={search}
            onChangeText={setSearch}
            placeholder={t('move.searchPlaceholder')}
            accessibilityLabel={swapping ? t('move.swap.search') : t('move.search')}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        <Text variant="muted">
          {t(swapping ? 'move.swap.takenOn' : 'move.freeOn', {
            day: formatDayLabel(firstDay, locale),
            slot: t(`dayMap.slot.${booking.slots}`),
          })}
        </Text>
      </View>
      {day.isPending ? (
        <StateView busy title={t('common.loading')} />
      ) : candidates.spots.length === 0 ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {swapping ? t('move.swap.none') : t('move.noSpots')}
        </Text>
      ) : (
        <SpotChoices
          label={swapping ? t('move.swap.target') : t('move.target')}
          spots={candidates.spots}
          selectedId={spotId}
          optionLabel={(s) =>
            swapping && s.booking
              ? t('move.swap.option', {
                  label: s.label,
                  name: s.booking.occupant_label || s.booking.code,
                })
              : t('move.spotOption', { label: s.label })
          }
          onSelect={(id) => {
            setError(null);
            setSpotId(id);
          }}
        />
      )}
      {candidates.more ? (
        <Text variant="muted">{swapping ? t('move.swap.more') : t('move.more')}</Text>
      ) : null}
    </View>
  );

  const summary = (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('move.summary')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <DetailRow label={t('move.from')} value={freed} />
        {swapping ? (
          <DetailRow
            label={t('move.swap.with')}
            value={other && target ? `${target.label} · ${other.code}` : '—'}
          />
        ) : (
          <DetailRow label={t('move.to')} value={target?.label ?? '—'} />
        )}
        {start === 'tomorrow' && from ? (
          <Text variant="muted">
            {t('move.fromTomorrow', { day: formatDayLabel(from, locale) })}
          </Text>
        ) : from ? (
          <Text variant="muted">{t('move.fromToday', { day: formatDayLabel(from, locale) })}</Text>
        ) : null}
        {viaTicket ? (
          <Text variant="muted">{t('move.ticketPrice', { number: viaTicket.number_label })}</Text>
        ) : null}
        {previewPending ? <Text variant="muted">{t('move.previewing')}</Text> : null}
        {(result || swapResult) && conflicts.length > 0 ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="polite">
            <AlertTitle>
              {swapping
                ? t('move.swap.conflicts')
                : t('move.conflicts', { label: target?.label ?? '' })}
            </AlertTitle>
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
            <PriceText change={result} />
          </View>
        ) : null}
        {swapResult && conflicts.length === 0 ? (
          <View accessible accessibilityLiveRegion="polite" className="gap-1">
            <Text variant="muted">
              {t('move.swap.days', {
                from: formatDayLabel(swapResult.from, locale),
                to: formatDayLabel(swapResult.to, locale),
              })}
            </Text>
            <PriceText change={swapResult.a} code={booking.code} />
            <PriceText change={swapResult.b} code={otherCode} />
          </View>
        ) : null}
        {previewError ? (
          <Alert icon={CircleAlertIcon} variant="destructive">
            <AlertDescription>
              {t(swapping ? swapErrorKey(previewError) : moveErrorKey(previewError))}
            </AlertDescription>
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
          <Text>
            {swapping
              ? target
                ? t('move.swap.submitWith', { label: target.label })
                : t('move.swap.submit')
              : target
                ? t('move.submitTo', { label: target.label })
                : t('move.submit')}
          </Text>
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
        title={
          swapping
            ? t('move.swap.confirm.title', { code: booking.code, other: otherCode })
            : t('move.confirm.title', { code: booking.code, label: target?.label ?? '' })
        }
        description={
          swapping
            ? t('move.swap.confirm.description', {
                code: booking.code,
                other: otherCode,
                // The other booking takes every spot this one leaves (split stays too).
                from: freed,
                to: target?.label ?? '',
              })
            : t('move.confirm.description', { from: freed, to: target?.label ?? '' })
        }
        confirmLabel={swapping ? t('move.swap.confirm.submit') : t('move.confirm.submit')}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

/** New total of a booking after a move or swap; with its code when two bookings change. */
function PriceText({
  change,
  code,
}: {
  change: Pick<BookingChangeResult, 'new_total' | 'price_difference'>;
  code?: string;
}) {
  const { t } = useTranslation();
  const kind = priceChange(change);
  const values = {
    total: formatCents(change.new_total),
    diff: formatCents(Math.abs(change.price_difference)),
  };
  const text =
    kind === 'same'
      ? t('move.priceSame', values)
      : t(kind === 'up' ? 'move.priceUp' : 'move.priceDown', values);
  return (
    <Text className={cn(kind !== 'same' && 'font-semibold')}>
      {code ? t('move.swap.side', { code, change: text }) : text}
    </Text>
  );
}

/** Spots offered as radio pills (free spots, or spots of bookings to swap with). */
function SpotChoices({
  label,
  spots,
  selectedId,
  optionLabel,
  onSelect,
}: {
  label: string;
  spots: OperationalSpot[];
  selectedId: string | undefined;
  optionLabel: (s: OperationalSpot) => string;
  onSelect: (spotId: string) => void;
}) {
  return (
    <View role="radiogroup" accessibilityLabel={label} className="flex-row flex-wrap gap-2">
      {spots.map((s) => {
        const selected = s.spot_id === selectedId;
        return (
          <Pressable
            key={s.spot_id}
            role="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={optionLabel(s)}
            onPress={() => onSelect(s.spot_id)}
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
  );
}

/**
 * Undo still offered for `info`: re-renders when the 5 minutes run out.
 * The deadline is read on the device clock, which may drift from the
 * server's: the button can show a little early or late, and the server's
 * 410 move_undo_expired stays the authority.
 */
function useUndoOpen(info: MoveUndoInfo | undefined): info is MoveUndoInfo {
  const { clock } = useDependencies();
  const [, setTick] = useState(0);
  const expiresAt = info?.expires_at;
  useEffect(() => {
    if (!expiresAt) return;
    const left = Date.parse(expiresAt) - clock.now().getTime();
    if (left <= 0) return;
    const timer = setTimeout(() => setTick((n) => n + 1), left);
    return () => clearTimeout(timer);
  }, [expiresAt, clock]);
  return undoOpen(info, clock.now());
}

/**
 * What an undo also puts back besides this booking: in the notice of the
 * last move (`last`) or in the confirmation (`confirm`, never for a move of
 * this booking alone).
 */
function useScopeText(): (
  scope: UndoScope,
  otherCode: string | undefined,
  where: 'last' | 'confirm',
) => string {
  const { t } = useTranslation();
  return (scope, otherCode, where) => {
    const other = otherCode ?? t('move.undo.anotherBooking');
    if (scope.kind === 'swap') {
      return where === 'last'
        ? t('move.undo.lastSwap', { other })
        : t('move.undo.confirm.swap', { other });
    }
    if (scope.kind === 'group') {
      return where === 'last'
        ? t('move.undo.lastGroup', { count: scope.others })
        : t('move.undo.confirm.group', { count: scope.others });
    }
    return where === 'last' ? t('move.undo.lastDescription') : '';
  };
}

/** Code of a booking (the other side of a swap), once loaded. */
function BookingCode({ id, children }: { id: string; children: (code?: string) => ReactNode }) {
  const query = useBooking(id);
  return children(query.data?.code);
}

/**
 * "Annulla spostamento" with its deadline, its outcome and its errors. When
 * the undo also puts back other bookings (a swap, a group move made in the
 * panel), it asks first and names them.
 */
function UndoAction({
  info,
  bookingId,
  otherCode,
  onUndone,
}: {
  info: MoveUndoInfo;
  bookingId: string;
  otherCode?: string;
  onUndone: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { timeZone } = useOperationalDays();
  const { available: online } = useOnlineOnly();
  const undo = useUndoMove();
  const scopeText = useScopeText();
  const [error, setError] = useState<UndoErrorKey | null>(null);
  const [confirming, setConfirming] = useState(false);
  const scope = undoScope(info, bookingId);

  const run = async () => {
    setConfirming(false);
    setError(null);
    try {
      await undo.mutateAsync(info.move_id);
      onUndone();
    } catch (e) {
      setError(undoErrorKey(e));
    }
  };

  return (
    <View className="gap-2">
      <Text variant="muted">
        {t('move.undo.until', { time: formatTime(info.expires_at, locale, timeZone) })}
      </Text>
      <Button
        size="lg"
        variant="outline"
        disabled={!online || undo.isPending}
        onPress={() => (scope.kind === 'self' ? void run() : setConfirming(true))}
      >
        <Icon as={Undo2Icon} size={18} />
        <Text>{t('move.undo.action')}</Text>
      </Button>
      {error ? (
        <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="assertive">
          <AlertTitle>{t('move.undo.failedTitle')}</AlertTitle>
          <AlertDescription>{t(error)}</AlertDescription>
        </Alert>
      ) : null}
      <ConfirmDialog
        open={confirming}
        title={t('move.undo.confirm.title')}
        description={scopeText(scope, otherCode, 'confirm')}
        confirmLabel={t('move.undo.confirm.submit')}
        onConfirm={() => void run()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

function UndoneNotice() {
  const { t } = useTranslation();
  return (
    <Alert icon={CircleCheckIcon} accessibilityLiveRegion="assertive">
      <AlertDescription>{t('move.undo.done')}</AlertDescription>
    </Alert>
  );
}

/** Outcome of a move or swap, with its undo while the 5 minutes last. */
function MoveDone({ bookingId, done }: { bookingId: string; done: Done }) {
  const { t } = useTranslation();
  const open = useUndoOpen(done.undo);
  const [undone, setUndone] = useState(false);
  return (
    <View className="gap-4" testID="move-done">
      <ScrollToTop />
      <Alert icon={CircleCheckIcon} accessibilityLiveRegion="assertive">
        <AlertTitle>{done.title}</AlertTitle>
        <AlertDescription>{t('move.done.description')}</AlertDescription>
      </Alert>
      {undone ? (
        <UndoneNotice />
      ) : open && done.undo ? (
        <UndoAction
          info={done.undo}
          bookingId={bookingId}
          otherCode={done.otherCode}
          onUndone={() => setUndone(true)}
        />
      ) : null}
      <Button size="lg" onPress={() => router.back()}>
        <Text>{t('move.done.back')}</Text>
      </Button>
    </View>
  );
}

/**
 * The user's last move, swap or group move of this booking, still undoable
 * (GET moves/last, per user: it may come from the panel): offered when the
 * move screen is opened again, saying what else it puts back.
 */
function LastMoveNotice({ booking }: { booking: BookingDetail }) {
  const { clock } = useDependencies();
  const { available: online } = useOnlineOnly();
  const last = useLastMove(online);
  const info = lastMoveOf(last.data, booking.id, clock.now());
  const open = useUndoOpen(info);
  const [undone, setUndone] = useState(false);
  if (undone) return <UndoneNotice />;
  if (!open || !info) return null;
  const scope = undoScope(info, booking.id);
  const body = (otherCode?: string) => (
    <LastMoveBody
      info={info}
      bookingId={booking.id}
      scope={scope}
      otherCode={otherCode}
      onUndone={() => setUndone(true)}
    />
  );
  return scope.kind === 'swap' ? <BookingCode id={scope.otherId}>{body}</BookingCode> : body();
}

function LastMoveBody({
  info,
  bookingId,
  scope,
  otherCode,
  onUndone,
}: {
  info: MoveUndoInfo;
  bookingId: string;
  scope: UndoScope;
  otherCode?: string;
  onUndone: () => void;
}) {
  const { t } = useTranslation();
  const scopeText = useScopeText();
  return (
    <Alert icon={Undo2Icon}>
      <AlertTitle>{t('move.undo.lastTitle')}</AlertTitle>
      <AlertDescription>{scopeText(scope, otherCode, 'last')}</AlertDescription>
      <View className="pt-2">
        <UndoAction info={info} bookingId={bookingId} otherCode={otherCode} onUndone={onUndone} />
      </View>
    </Alert>
  );
}
