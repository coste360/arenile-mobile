import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import {
  CalendarPlusIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClipboardListIcon,
  LockIcon,
  LockOpenIcon,
  SearchIcon,
  TimerIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { BookingDetail, Hold, Slots } from '@/api/types';
import { ExtraStepper } from '@/components/daily-sale/extra-stepper';
import { DateField } from '@/components/date-field';
import { DetailRow } from '@/components/detail-row';
import { ChipRow, FilterChip } from '@/components/filter-chip';
import { FormField } from '@/components/form-field';
import { ScrollToTop } from '@/components/layout/scroll-top';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { OnlineOnlyNotice } from '@/components/online-only-notice';
import { ChoiceGroup } from '@/components/operations/choice-group';
import { ConfirmDialog } from '@/components/operations/confirm-dialog';
import { PolicyReasons } from '@/components/policy-reasons';
import { StateView } from '@/components/state-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { extrasForPack, packsForSale } from '@/features/daily-sale/sale';
import { useExtras, usePacks } from '@/features/daily-sale/queries';
import {
  canCreateBooking,
  customerSchema,
  endFor,
  formulaFor,
  holdKey,
  holdSecondsLeft,
  HOLD_TTL_SECONDS,
  MAX_STAY_DAYS,
  newBookingErrorKey,
  packsForStay,
  quoteAllows,
  selectionKey,
  spotChoices,
  STAY_LENGTHS,
  stayLength,
  toCreateRequest,
  toHoldRequest,
  toSelection,
  withStart,
  type CustomerValues,
} from '@/features/new-booking/new-booking';
import {
  releaseHold,
  useBookingQuote,
  useCreateBooking,
  useCreateHold,
  useReleaseHold,
} from '@/features/new-booking/queries';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { formatDayLabel, type CalendarDate } from '@/lib/calendar';
import { formatTime } from '@/lib/datetime';
import { localizedText } from '@/lib/i18n-text';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useDependencies } from '@/providers/dependencies';

const SLOTS: readonly Slots[] = ['FULL', 'AM', 'PM'];

/**
 * "Nuova prenotazione" on the fly: a spot, the stay from one day to another,
 * a pack, the customer's surname; the price and the booking rules from the
 * server's quote while the form changes, an optional hold of the spot, then
 * the booking (confirmed, payment at the desk). Online only, for roles with
 * bookings.write; the server checks availability and the rules.
 */
export function NewBookingView({
  spotId,
  startsOn,
  endsOn,
  initialSlot,
}: {
  spotId?: string;
  startsOn: CalendarDate;
  endsOn?: CalendarDate;
  initialSlot: Slots;
}) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const [created, setCreated] = useState<BookingDetail | null>(null);

  if (abilities.known && !canCreateBooking(abilities)) {
    return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
  }
  if (!abilities.known) return <StateView busy title={t('common.loading')} />;
  if (created) return <NewBookingDone booking={created} />;
  return (
    <NewBookingForm
      initialSpotId={spotId}
      initialStart={startsOn}
      initialEnd={endsOn ?? startsOn}
      initialSlot={initialSlot}
      onCreated={setCreated}
    />
  );
}

function NewBookingForm({
  initialSpotId,
  initialStart,
  initialEnd,
  initialSlot,
  onCreated,
}: {
  initialSpotId?: string;
  initialStart: CalendarDate;
  initialEnd: CalendarDate;
  initialSlot: Slots;
  onCreated: (booking: BookingDetail) => void;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const layout = useDeviceLayout();
  const { clock } = useDependencies();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { available: online } = useOnlineOnly();
  const { today, timeZone } = useOperationalDays();

  const [stay, setStay] = useState({
    startsOn: initialStart,
    endsOn: initialEnd < initialStart ? initialStart : initialEnd,
  });
  const [slots, setSlots] = useState<Slots>(initialSlot);
  const [spotId, setSpotId] = useState(initialSpotId ?? '');
  const [search, setSearch] = useState('');
  const [packId, setPackId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [hold, setHold] = useState<Hold | null>(null);
  const [holdExpired, setHoldExpired] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const day = useOperationsDay(stay.startsOn);
  const packs = usePacks(online);
  const extras = useExtras(online);
  const createHold = useCreateHold();
  const release = useReleaseHold();
  const create = useCreateBooking();
  const { control, handleSubmit } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { lastName: '', firstName: '', phone: '', email: '' },
    mode: 'onTouched',
  });

  const spot = day.data?.spots.find((s) => s.spot_id === spotId);
  const zoneId = spot?.zone_id ?? '';
  const formula = formulaFor(stay.startsOn, stay.endsOn, slots);
  const offeredPacks = packsForStay(packs.data ?? [], zoneId, formula);
  const chosenPack = offeredPacks.some((p) => p.id === packId)
    ? packId
    : (offeredPacks[0]?.id ?? '');
  const offered = extrasForPack(extras.data ?? [], chosenPack);
  const visible = new Set(offered.map((x) => x.id));
  const selection = toSelection(
    {
      spotId,
      zoneId,
      startsOn: stay.startsOn,
      endsOn: stay.endsOn,
      slots,
      packId: chosenPack,
      extras: Object.fromEntries(Object.entries(quantities).filter(([id]) => visible.has(id))),
    },
    offered,
  );
  const priced = useBookingQuote(online ? selection : null);
  const total = priced.data?.breakdown.total;
  const fresh = !!priced.data && !priced.isPlaceholderData && !priced.isFetching;
  const allowed = !!priced.data && quoteAllows(priced.data);
  const held = !!hold && !holdExpired;
  // The spot, the dates and the slots of a hold cannot change: release it first.
  const holdMatches = held && holdKey(hold) === selectionKey(selection);
  const ready =
    online && fresh && allowed && total !== undefined && !create.isPending && !createHold.isPending;

  // The hold the screen still owns, released when the screen goes away.
  const owned = useRef<string | null>(null);
  useEffect(
    () => () => {
      const id = owned.current;
      if (id) void releaseHold(client, establishmentId, id).catch(() => undefined);
    },
    [client, establishmentId],
  );
  // The hold expires on the server at expires_at: the form says so then.
  useEffect(() => {
    if (!hold) return;
    const left = holdSecondsLeft(hold.expires_at, clock.now());
    const timer = setTimeout(() => setHoldExpired(true), left * 1000);
    return () => clearTimeout(timer);
  }, [hold, clock]);

  if (day.isPending || (online && (packs.isPending || extras.isPending))) {
    return <StateView busy title={t('common.loading')} />;
  }

  const clearFailure = () => setFailure(null);
  const days = stayLength(stay.startsOn, stay.endsOn);
  const choices = spotChoices(day.data?.spots, slots, search, spotId);
  const label = spot?.label ?? '';
  const period =
    days === 1
      ? formatDayLabel(stay.startsOn, locale)
      : t('newBooking.period', {
          from: formatDayLabel(stay.startsOn, locale),
          to: formatDayLabel(stay.endsOn, locale),
        });

  const forgetHold = () => {
    owned.current = null;
    setHold(null);
    setHoldExpired(false);
  };

  const doHold = async () => {
    clearFailure();
    if (!selection) return;
    try {
      const h = await createHold.mutateAsync(toHoldRequest(selection));
      owned.current = h.id;
      setHoldExpired(false);
      setHold(h);
    } catch (e) {
      setFailure(e);
    }
  };

  const doRelease = async () => {
    clearFailure();
    if (!hold) return;
    const id = hold.id;
    forgetHold();
    try {
      await release.mutateAsync(id);
    } catch (e) {
      setFailure(e);
    }
  };

  const book = async (customer: CustomerValues) => {
    setConfirming(false);
    clearFailure();
    if (!selection) return;
    const body = toCreateRequest(selection, customer, holdMatches ? hold?.id : undefined);
    try {
      const booking = await create.mutateAsync(body);
      // The hold became the booking: nothing to release.
      owned.current = null;
      onCreated(booking);
    } catch (e) {
      setFailure(e);
      if (e instanceof Error && newBookingErrorKey(e) === 'newBooking.errors.hold_expired') {
        forgetHold();
      }
    }
  };

  const formPart = (
    <View className="gap-4">
      <View className="gap-2">
        <Text variant="small" nativeID="new-booking-spot-label">
          {t('newBooking.spot')}
        </Text>
        {held ? (
          <Text className="font-semibold">{label}</Text>
        ) : (
          <>
            <View className="flex-row items-center gap-2">
              <Icon as={SearchIcon} size={18} className="text-muted-foreground" />
              <Input
                className="flex-1"
                value={search}
                onChangeText={setSearch}
                placeholder={t('newBooking.searchPlaceholder')}
                accessibilityLabel={t('newBooking.search')}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <Text variant="muted">
              {t('newBooking.freeOn', {
                day: formatDayLabel(stay.startsOn, locale),
                slot: t(`dayMap.slot.${slots}`),
              })}
            </Text>
            {choices.spots.length === 0 ? (
              <Text variant="muted" accessibilityLiveRegion="polite">
                {t('newBooking.noSpots')}
              </Text>
            ) : (
              <View
                role="radiogroup"
                accessibilityLabel={t('newBooking.spot')}
                className="flex-row flex-wrap gap-2"
              >
                {choices.spots.map((s) => {
                  const selected = s.spot_id === spotId;
                  return (
                    <Pressable
                      key={s.spot_id}
                      role="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={t('newBooking.spotOption', { label: s.label })}
                      onPress={() => {
                        clearFailure();
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
            {choices.more ? <Text variant="muted">{t('newBooking.more')}</Text> : null}
          </>
        )}
      </View>

      {held ? (
        <Text variant="muted">{t('newBooking.hold.locked')}</Text>
      ) : (
        <>
          <View className="flex-row gap-3">
            <DateField
              label={t('newBooking.from')}
              value={stay.startsOn}
              locale={locale}
              minimumDate={today}
              testID="new-booking-from"
              onChange={(d) => {
                clearFailure();
                setStay((s) => withStart(s, d));
              }}
            />
            <DateField
              label={t('newBooking.to')}
              value={stay.endsOn}
              locale={locale}
              minimumDate={stay.startsOn}
              maximumDate={endFor(stay.startsOn, MAX_STAY_DAYS)}
              testID="new-booking-to"
              onChange={(d) => {
                clearFailure();
                setStay((s) => ({ ...s, endsOn: d < s.startsOn ? s.startsOn : d }));
              }}
            />
          </View>
          <ChipRow label={t('newBooking.length')}>
            {STAY_LENGTHS.map((n) => (
              <FilterChip
                key={n}
                label={t('newBooking.days', { count: n })}
                selected={days === n}
                onPress={() => {
                  clearFailure();
                  setStay((s) => ({ ...s, endsOn: endFor(s.startsOn, n) }));
                }}
              />
            ))}
          </ChipRow>
          <ChipRow label={t('newBooking.slot')}>
            {SLOTS.map((s) => (
              <FilterChip
                key={s}
                label={t(`dayMap.slot.${s}`)}
                selected={slots === s}
                onPress={() => {
                  clearFailure();
                  setSlots(s);
                }}
              />
            ))}
          </ChipRow>
        </>
      )}

      {spot && offeredPacks.length === 0 ? (
        <Alert icon={CircleAlertIcon}>
          <AlertDescription>
            {packsForSale(packs.data ?? [], zoneId).length > 0
              ? t('newBooking.noPacksForStay')
              : t('newBooking.noPacks')}
          </AlertDescription>
        </Alert>
      ) : offeredPacks.length > 0 ? (
        <ChoiceGroup
          id="new-booking-pack"
          label={t('newBooking.pack')}
          value={chosenPack}
          onChange={(v) => {
            clearFailure();
            setPackId(v);
          }}
          options={offeredPacks.map((p) => ({ value: p.id, label: localizedText(p.name, locale) }))}
        />
      ) : null}

      {offered.length > 0 ? (
        <View className="gap-1" role="group" accessibilityLabel={t('newBooking.extras')}>
          <Text variant="small">{t('newBooking.extras')}</Text>
          {offered.map((x) => (
            <ExtraStepper
              key={x.id}
              name={localizedText(x.name, locale)}
              quantity={quantities[x.id] ?? 0}
              max={x.max_quantity}
              onChange={(q) => {
                clearFailure();
                setQuantities((prev) => ({ ...prev, [x.id]: q }));
              }}
            />
          ))}
        </View>
      ) : null}

      <View className="gap-3">
        <Text variant="small">{t('newBooking.customer')}</Text>
        <FormField
          control={control}
          name="lastName"
          label={t('newBooking.form.lastName')}
          autoComplete="off"
          maxLength={100}
        />
        <FormField
          control={control}
          name="firstName"
          label={t('newBooking.form.firstName')}
          autoComplete="off"
          maxLength={100}
        />
        <FormField
          control={control}
          name="phone"
          label={t('newBooking.form.phone')}
          keyboardType="phone-pad"
          autoComplete="off"
          placeholder="+39 333 1234567"
        />
        <FormField
          control={control}
          name="email"
          label={t('newBooking.form.email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="off"
          maxLength={254}
        />
        <Text variant="muted">{t('newBooking.customerHint')}</Text>
      </View>
    </View>
  );

  const conflicts = priced.data?.conflicts ?? [];
  const violations = priced.data?.policy.violations ?? [];
  const summaryPart = (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('newBooking.summary')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <DetailRow label={t('newBooking.spot')} value={label || '—'} />
        <DetailRow
          label={t('newBooking.stay')}
          value={`${period} · ${t('newBooking.days', { count: days })}`}
        />
        <DetailRow label={t('newBooking.slot')} value={t(`dayMap.slot.${slots}`)} />
        <Separator />
        <View
          className="flex-row items-baseline justify-between"
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            total !== undefined && fresh
              ? t('newBooking.totalA11y', { total: formatCents(total) })
              : selection
                ? t('newBooking.computing')
                : t('newBooking.incomplete')
          }
        >
          <Text className="font-semibold">{t('newBooking.total')}</Text>
          <Text variant="large" className="tabular-nums">
            {total !== undefined && selection ? formatCents(total) : '—'}
          </Text>
        </View>
        {!selection ? <Text variant="muted">{t('newBooking.incomplete')}</Text> : null}
        {total !== undefined && selection ? (
          <Text variant="muted">{t('newBooking.payAtDesk')}</Text>
        ) : null}

        {priced.data && fresh && !priced.data.available ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="polite">
            <AlertTitle>{t('newBooking.unavailable', { label })}</AlertTitle>
            {conflicts.slice(0, 5).map((c) => (
              <AlertDescription key={`${c.date}-${c.slot}-${c.spot_id ?? ''}`}>
                {t('newBooking.conflictDay', {
                  day: formatDayLabel(c.date, locale),
                  slot: t(`move.halfSlot.${c.slot}`),
                })}
              </AlertDescription>
            ))}
          </Alert>
        ) : null}
        {priced.data && fresh && violations.length > 0 ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="polite">
            <AlertTitle>{t('newBooking.errors.policy')}</AlertTitle>
            <PolicyReasons violations={violations} />
          </Alert>
        ) : null}
        {priced.error ? (
          <Alert icon={CircleAlertIcon} variant="destructive">
            <AlertDescription>{t(newBookingErrorKey(priced.error))}</AlertDescription>
            <PolicyReasons error={priced.error} />
          </Alert>
        ) : null}

        {held && hold ? (
          <Alert icon={TimerIcon} accessibilityLiveRegion="polite">
            <AlertTitle>
              {t('newBooking.hold.active', {
                label,
                time: formatTime(hold.expires_at, locale, timeZone),
              })}
            </AlertTitle>
            <AlertDescription>{t('newBooking.hold.hint')}</AlertDescription>
          </Alert>
        ) : null}
        {hold && holdExpired ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="polite">
            <AlertDescription>{t('newBooking.hold.expired')}</AlertDescription>
          </Alert>
        ) : null}

        {failure ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="assertive">
            <AlertTitle>{t('newBooking.failedTitle')}</AlertTitle>
            <AlertDescription>{t(newBookingErrorKey(failure))}</AlertDescription>
            <PolicyReasons error={failure} />
          </Alert>
        ) : null}

        {held ? (
          <Button
            size="lg"
            variant="outline"
            disabled={release.isPending || create.isPending}
            onPress={() => void doRelease()}
          >
            <Icon as={LockOpenIcon} size={18} />
            <Text>{t('newBooking.hold.release')}</Text>
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            disabled={!ready}
            onPress={() => {
              if (hold) forgetHold();
              void doHold();
            }}
          >
            <Icon as={LockIcon} size={18} />
            <Text>{t('newBooking.hold.submit', { minutes: HOLD_TTL_SECONDS / 60 })}</Text>
          </Button>
        )}
        <Button
          size="lg"
          disabled={!ready}
          onPress={() => void handleSubmit(() => setConfirming(true))()}
        >
          <Icon as={CalendarPlusIcon} size={18} className="text-primary-foreground" />
          <Text>
            {total !== undefined && selection
              ? t('newBooking.submitTotal', { total: formatCents(total) })
              : t('newBooking.submit')}
          </Text>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text variant="h3" role="heading">
          {label ? t('newBooking.titleSpot', { label }) : t('newBooking.title')}
        </Text>
        <Text variant="muted">{t('newBooking.subtitle')}</Text>
      </View>
      <OnlineOnlyNotice />
      <View className={cn('gap-4', layout === 'tablet' && 'flex-row items-start')}>
        <View className={cn(layout === 'tablet' && 'flex-1')}>{formPart}</View>
        <View className={cn(layout === 'tablet' && 'flex-1')}>{summaryPart}</View>
      </View>
      <ConfirmDialog
        open={confirming}
        title={t('newBooking.confirm.title', { label })}
        description={t('newBooking.confirm.description', {
          label,
          period,
          total: total !== undefined ? formatCents(total) : '',
        })}
        confirmLabel={t('newBooking.confirm.submit')}
        onConfirm={() => void handleSubmit(book)()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

/** The booking just created: code, spot, stay, total, then the sheet or back. */
function NewBookingDone({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const spots = booking.lines
    .map((l) => l.spot_label)
    .filter(Boolean)
    .join(', ');
  const period =
    booking.starts_on === booking.ends_on
      ? formatDayLabel(booking.starts_on, locale)
      : t('newBooking.period', {
          from: formatDayLabel(booking.starts_on, locale),
          to: formatDayLabel(booking.ends_on, locale),
        });
  return (
    <View className="gap-4" testID="new-booking-done">
      <ScrollToTop />
      <Alert icon={CircleCheckIcon} accessibilityLiveRegion="assertive">
        <AlertTitle>{t('newBooking.done.title', { code: booking.code })}</AlertTitle>
        <AlertDescription>
          {booking.status === 'awaiting_approval'
            ? t('newBooking.done.awaitingApproval')
            : t('newBooking.done.description')}
        </AlertDescription>
      </Alert>
      <Card>
        <CardContent className="gap-4 pt-6">
          <DetailRow label={t('newBooking.customer')} value={booking.customer.display_name} />
          <DetailRow label={t('newBooking.spot')} value={spots || '—'} />
          <DetailRow label={t('newBooking.stay')} value={period} />
          <DetailRow label={t('newBooking.total')} value={formatCents(booking.total_amount)} />
          <DetailRow label={t('newBooking.balance')} value={formatCents(booking.balance_due)} />
        </CardContent>
      </Card>
      <Button
        size="lg"
        onPress={() =>
          router.replace({ pathname: '/bookings/[bookingId]', params: { bookingId: booking.id } })
        }
      >
        <Icon as={ClipboardListIcon} size={18} className="text-primary-foreground" />
        <Text>{t('newBooking.done.open')}</Text>
      </Button>
      <Button size="lg" variant="outline" onPress={() => router.back()}>
        <Text>{t('newBooking.done.back')}</Text>
      </Button>
    </View>
  );
}
