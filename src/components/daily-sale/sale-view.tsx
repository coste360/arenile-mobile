import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import {
  BanknoteIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CreditCardIcon,
  LockIcon,
  MapIcon,
  SearchXIcon,
  TicketIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { DailySaleResult, Slots, TicketPaymentMethod } from '@/api/types';
import { DetailRow } from '@/components/detail-row';
import { FilterChip, ChipRow } from '@/components/filter-chip';
import { FormField } from '@/components/form-field';
import { PolicyReasons } from '@/components/policy-reasons';
import { ScrollToTop } from '@/components/layout/scroll-top';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { OnlineOnlyNotice } from '@/components/online-only-notice';
import { ChoiceGroup } from '@/components/operations/choice-group';
import { ConfirmDialog } from '@/components/operations/confirm-dialog';
import { TicketPrint } from '@/components/printing/ticket-print';
import { StateView } from '@/components/state-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCashDesk, useInstanceFeature } from '@/features/booking-actions/hooks';
import {
  useCreateDailySale,
  useDailySaleSettings,
  useExtras,
  usePacks,
  useSaleQuote,
} from '@/features/daily-sale/queries';
import {
  canSell,
  changeDue,
  extrasForPack,
  packsForSale,
  saleErrorKey,
  saleFormSchema,
  sellableSpot,
  toCreateRequest,
  toQuoteRequest,
  type SaleFormValues,
  type SaleValues,
} from '@/features/daily-sale/sale';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatDayLabel, type CalendarDate } from '@/lib/calendar';
import { localizedText } from '@/lib/i18n-text';
import { formatCents, parseCents } from '@/lib/money';
import { cn } from '@/lib/utils';

import { ExtraStepper } from './extra-stepper';

const SLOTS: readonly Slots[] = ['FULL', 'AM', 'PM'];

/**
 * Daily quick sale of a spot (spec 03 "Vendita giornaliera rapida"): slot,
 * pack, extras, optional name, payment in cash (with the change) or by card,
 * then the numbered ticket. Online only, for roles with bookings.write and
 * cash.operate; the server checks availability and numbers the ticket.
 */
export function SaleView({
  spotId,
  date,
  initialSlot,
}: {
  spotId: string;
  date: CalendarDate;
  initialSlot: Slots;
}) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const cashFeature = useInstanceFeature('cash');
  const [sold, setSold] = useState<DailySaleResult | null>(null);

  if (abilities.known && (!canSell(abilities) || !cashFeature)) {
    return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
  }
  if (!abilities.known) return <StateView busy title={t('common.loading')} />;
  if (sold) return <SaleDone result={sold} />;
  return <SaleForm spotId={spotId} date={date} initialSlot={initialSlot} onSold={setSold} />;
}

function SaleForm({
  spotId,
  date,
  initialSlot,
  onSold,
}: {
  spotId: string;
  date: CalendarDate;
  initialSlot: Slots;
  onSold: (result: DailySaleResult) => void;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const layout = useDeviceLayout();
  const { available: online } = useOnlineOnly();
  const day = useOperationsDay(date);
  const packs = usePacks(online);
  const extras = useExtras(online);
  const desk = useCashDesk(online);
  const create = useCreateDailySale();

  const [slots, setSlots] = useState<Slots>(initialSlot);
  const [packId, setPackId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<TicketPaymentMethod>('cash');
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const { control, handleSubmit } = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: { firstName: '', lastName: '', tendered: '' },
    mode: 'onTouched',
  });
  const form = useWatch({ control });

  const spot = day.data?.spots.find((s) => s.spot_id === spotId);
  const sellable = packsForSale(packs.data ?? [], spot?.zone_id ?? '');
  const chosenPack = sellable.some((p) => p.id === packId) ? packId : (sellable[0]?.id ?? '');
  const offered = extrasForPack(extras.data ?? [], chosenPack);
  const visible = new Set(offered.map((x) => x.id));
  const tendered = parseCents(form.tendered ?? '') ?? undefined;

  const values: SaleValues = {
    date,
    slots,
    spotId,
    packId: chosenPack,
    extras: Object.fromEntries(Object.entries(quantities).filter(([id]) => visible.has(id))),
    firstName: form.firstName ?? '',
    lastName: form.lastName ?? '',
    tendered,
  };
  const quoteBody = online ? toQuoteRequest(values) : null;
  const quote = useSaleQuote(quoteBody);
  const total = quote.data?.total;
  const fresh = !!quote.data && !quote.isPlaceholderData && !quote.isFetching;
  const available = quote.data?.available ?? false;
  const cashBlocked = desk === 'closed';
  const payMethod: TicketPaymentMethod = cashBlocked ? 'card' : method;
  const change =
    total !== undefined && payMethod === 'cash' ? changeDue(total, tendered) : undefined;
  const ready = online && fresh && available && total !== undefined && !create.isPending;

  if (day.isPending || (online && (packs.isPending || extras.isPending))) {
    return <StateView busy title={t('common.loading')} />;
  }
  if (!spot) {
    return <StateView icon={SearchXIcon} title={t('sale.spotUnknown')} />;
  }
  const pickedSlotFree = sellableSpot(spot, slots);
  const label = spot.label;

  const sell = async () => {
    setConfirming(false);
    setFailure(null);
    // Cash goes to the open session of the register: the server picks it.
    const body = toCreateRequest(values, payMethod, { expectedTotal: total });
    if (!body) return;
    try {
      onSold(await create.mutateAsync(body));
    } catch (e) {
      setFailure(e);
    }
  };

  const formPart = (
    <View className="gap-4">
      <ChipRow label={t('sale.slot')}>
        {SLOTS.map((s) => (
          <FilterChip
            key={s}
            label={t(`dayMap.slot.${s}`)}
            selected={slots === s}
            onPress={() => {
              setFailure(null);
              setSlots(s);
            }}
          />
        ))}
      </ChipRow>
      {!pickedSlotFree ? (
        <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="polite">
          <AlertDescription>{t('sale.slotTaken', { label })}</AlertDescription>
        </Alert>
      ) : null}

      {sellable.length === 0 ? (
        <Alert icon={CircleAlertIcon}>
          <AlertDescription>{t('sale.noPacks')}</AlertDescription>
        </Alert>
      ) : (
        <ChoiceGroup
          id="sale-pack"
          label={t('sale.pack')}
          value={chosenPack}
          onChange={(v) => {
            setFailure(null);
            setPackId(v);
          }}
          options={sellable.map((p) => ({ value: p.id, label: localizedText(p.name, locale) }))}
        />
      )}

      {offered.length > 0 ? (
        <View className="gap-1" role="group" accessibilityLabel={t('sale.extras')}>
          <Text variant="small">{t('sale.extras')}</Text>
          {offered.map((x) => (
            <ExtraStepper
              key={x.id}
              name={localizedText(x.name, locale)}
              quantity={quantities[x.id] ?? 0}
              max={x.max_quantity}
              onChange={(q) => {
                setFailure(null);
                setQuantities((prev) => ({ ...prev, [x.id]: q }));
              }}
            />
          ))}
        </View>
      ) : null}

      <View className="gap-3">
        <Text variant="small">{t('sale.holder')}</Text>
        <FormField
          control={control}
          name="firstName"
          label={t('sale.form.firstName')}
          autoComplete="off"
          maxLength={100}
        />
        <FormField
          control={control}
          name="lastName"
          label={t('sale.form.lastName')}
          autoComplete="off"
          maxLength={100}
        />
        <Text variant="muted">{t('sale.holderHint')}</Text>
      </View>
    </View>
  );

  const summaryPart = (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('sale.summary')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <DetailRow label={t('sale.spot')} value={label} />
        <DetailRow
          label={t('sale.day')}
          value={`${formatDayLabel(date, locale)} · ${t(`dayMap.slot.${slots}`)}`}
        />
        <Separator />
        <View
          className="flex-row items-baseline justify-between"
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            total !== undefined && fresh
              ? t('sale.totalA11y', { total: formatCents(total) })
              : t('sale.computing')
          }
        >
          <Text className="font-semibold">{t('sale.total')}</Text>
          <Text variant="large" className="tabular-nums">
            {total !== undefined ? formatCents(total) : '—'}
          </Text>
        </View>
        {quote.data && !available && fresh ? (
          <Alert icon={CircleAlertIcon} variant="destructive">
            <AlertDescription>{t('sale.unavailable', { label })}</AlertDescription>
          </Alert>
        ) : null}
        {quote.error ? (
          <Alert icon={CircleAlertIcon} variant="destructive">
            <AlertDescription>{t(saleErrorKey(quote.error))}</AlertDescription>
            <PolicyReasons error={quote.error} />
          </Alert>
        ) : null}

        <ChoiceGroup
          id="sale-method"
          label={t('sale.method')}
          value={payMethod}
          onChange={(v) => setMethod(v)}
          options={[
            ...(cashBlocked ? [] : [{ value: 'cash' as const, label: t('sale.cash') }]),
            { value: 'card' as const, label: t('sale.card') },
          ]}
        />
        {cashBlocked ? (
          <Text variant="muted" accessibilityLiveRegion="polite">
            {t('sale.cashClosed')}
          </Text>
        ) : null}
        {payMethod === 'cash' ? (
          <View className="gap-2">
            <FormField
              control={control}
              name="tendered"
              label={t('sale.tendered')}
              keyboardType="decimal-pad"
              placeholder="0,00"
            />
            {change !== undefined ? (
              <Text className="font-semibold" accessibilityLiveRegion="polite">
                {t('sale.change', { amount: formatCents(change) })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {failure ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="assertive">
            <AlertTitle>{t('sale.failedTitle')}</AlertTitle>
            <AlertDescription>{t(saleErrorKey(failure))}</AlertDescription>
            <PolicyReasons error={failure} />
          </Alert>
        ) : null}

        <Button
          size="lg"
          disabled={!ready || !pickedSlotFree}
          onPress={() => void handleSubmit(() => setConfirming(true))()}
        >
          <Icon
            as={payMethod === 'cash' ? BanknoteIcon : CreditCardIcon}
            size={18}
            className="text-primary-foreground"
          />
          <Text>
            {total !== undefined
              ? t(payMethod === 'cash' ? 'sale.sellCash' : 'sale.sellCard', {
                  total: formatCents(total),
                })
              : t('sale.sell')}
          </Text>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text variant="h3" role="heading">
          {t('sale.title', { label })}
        </Text>
        <Text variant="muted">{t('sale.subtitle')}</Text>
      </View>
      <OnlineOnlyNotice />
      <View className={cn('gap-4', layout === 'tablet' && 'flex-row items-start')}>
        <View className={cn(layout === 'tablet' && 'flex-1')}>{formPart}</View>
        <View className={cn(layout === 'tablet' && 'flex-1')}>{summaryPart}</View>
      </View>
      <ConfirmDialog
        open={confirming}
        title={t('sale.confirm.title', { label })}
        description={t(payMethod === 'cash' ? 'sale.confirm.cash' : 'sale.confirm.card', {
          total: total !== undefined ? formatCents(total) : '',
          label,
        })}
        confirmLabel={t('sale.confirm.submit')}
        onConfirm={() => void sell()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

/** The ticket just issued: number, spot, total, change, printing, next steps. */
function SaleDone({ result }: { result: DailySaleResult }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const settings = useDailySaleSettings();
  const ticket = result.ticket;
  return (
    <View className="gap-4" testID="sale-done">
      <ScrollToTop />
      <Alert icon={CircleCheckIcon} accessibilityLiveRegion="assertive">
        <AlertTitle>{t('sale.done.title', { number: ticket.number_label })}</AlertTitle>
        <AlertDescription>
          {t('sale.done.description', {
            label: ticket.spot_label ?? localizedText(ticket.zone_name, locale),
          })}
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <View className="flex-row items-center gap-2">
            <Icon as={TicketIcon} size={18} />
            <CardTitle role="heading">
              {t('sale.done.ticket', { number: ticket.number_label })}
            </CardTitle>
          </View>
        </CardHeader>
        <CardContent className="gap-4">
          <DetailRow label={t('sale.spot')} value={ticket.spot_label ?? ''} />
          <DetailRow label={t('sale.code')} value={ticket.booking_code} />
          <DetailRow label={t('sale.total')} value={formatCents(ticket.total_amount)} />
          <DetailRow
            label={t('sale.method')}
            value={t(ticket.payment_method === 'cash' ? 'sale.cash' : 'sale.card')}
          />
          {result.change_amount !== undefined && result.change_amount > 0 ? (
            <DetailRow label={t('sale.changeLabel')} value={formatCents(result.change_amount)} />
          ) : null}
          <TicketPrint
            ticketId={ticket.id}
            ticketLabel={ticket.number_label}
            autoPrint={settings.data?.auto_print ?? false}
          />
        </CardContent>
      </Card>
      <Button size="lg" onPress={() => router.back()}>
        <Icon as={MapIcon} size={18} className="text-primary-foreground" />
        <Text>{t('sale.done.backToMap')}</Text>
      </Button>
    </View>
  );
}
