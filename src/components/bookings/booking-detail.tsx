import { router } from 'expo-router';
import {
  CircleAlertIcon,
  ClockIcon,
  LockIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  RefreshCwIcon,
  SearchXIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { isForbidden, ProblemError } from '@/api/errors';
import type { BookingDetail as Booking } from '@/api/types';
import { CachedNotice, servedFromCache } from '@/components/cached-notice';
import { DetailRow } from '@/components/detail-row';
import { StateView } from '@/components/state-view';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
  agreementView,
  canSeeCustomerContacts,
  customerView,
  guestsView,
  historyViews,
  paymentViews,
  queuedFor,
  spotLines,
  stayDays,
} from '@/features/bookings/detail';
import { contactLinks } from '@/features/bookings/contacts';
import { useBooking } from '@/features/bookings/queries';
import { useOfflineQueue } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useEstablishment } from '@/features/session/queries';
import { useDependencies } from '@/providers/dependencies';
import { formatDayLabel } from '@/lib/calendar';
import { formatInstant } from '@/lib/datetime';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

import { BookingKindBadges, BookingStatusBadge } from './booking-badges';
import { BookingSheetActions } from './booking-sheet-actions';
import { RequirementCheck } from './requirement-check';

/** History entries shown before "show all". */
const HISTORY_PREVIEW = 5;

/**
 * Booking sheet (phase 1 "Scheda prenotazione"): spot, period and slots,
 * customer (only what the role may see), amounts, payments, notes and the
 * essential history. Content only: the phone screen and the tablet detail
 * pane provide the scrolling. Reads from the offline cache when the
 * instance does not answer.
 */
export function BookingDetailView({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const query = useBooking(bookingId);

  if (query.data) {
    return (
      <View className="gap-4">
        <CachedNotice stale={servedFromCache(query)} updatedAt={query.dataUpdatedAt} />
        <BookingSheet booking={query.data} />
      </View>
    );
  }
  // Paused: no network and nothing saved for this booking.
  if (query.isError || query.isPaused) {
    const error = query.error;
    if (isForbidden(error)) {
      return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
    }
    if (error instanceof ProblemError && error.status === 404) {
      return <StateView icon={SearchXIcon} title={t('bookings.detail.notFound')} />;
    }
    return (
      <StateView
        icon={CircleAlertIcon}
        tone="destructive"
        title={t('bookings.detail.errorTitle')}
        description={t('bookings.detail.errorDescription')}
      >
        <Button variant="outline" onPress={() => void query.refetch()}>
          <Icon as={RefreshCwIcon} size={16} />
          <Text>{t('common.retry')}</Text>
        </Button>
      </StateView>
    );
  }
  return <StateView busy title={t('common.loading')} />;
}

function BookingSheet({ booking: b }: { booking: Booking }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  // Instants read in the establishment zone (UTC until it is known).
  const timeZone = useEstablishment().data?.timezone;
  const abilities = useAbilities();
  const { operations } = useOfflineQueue();
  const queued = queuedFor(operations, b.id);
  const lines = spotLines(b);
  const days = stayDays(b);
  const period =
    b.starts_on === b.ends_on
      ? formatDayLabel(b.starts_on, locale)
      : t('bookings.stay', {
          from: formatDayLabel(b.starts_on, locale),
          to: formatDayLabel(b.ends_on, locale),
        });

  return (
    <>
      <View className="gap-2">
        <Text variant="h3" role="heading" selectable>
          {b.code}
        </Text>
        <View className="flex-row flex-wrap gap-1">
          <BookingStatusBadge status={b.status} />
          <BookingKindBadges booking={b} />
        </View>
      </View>

      {queued.length > 0 ? (
        <Alert icon={ClockIcon} accessibilityLiveRegion="polite">
          <AlertDescription>
            {t('bookings.detail.queued', { count: queued.length })}
          </AlertDescription>
          <Button
            variant="link"
            className="self-start px-0"
            onPress={() => router.push('/pending')}
          >
            <Text>{t('bookings.detail.queuedLink')}</Text>
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('bookings.detail.stay')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <View className="gap-2" accessibilityLabel={t('bookings.detail.spots')}>
            <Text variant="muted">{t('bookings.detail.spots')}</Text>
            {lines.map((l) => {
              const unassigned = t('bookings.unassigned');
              const details = [
                l.pack ? t('bookings.detail.pack', { pack: l.pack }) : null,
                l.quantity > 1 ? t('bookings.detail.quantity', { count: l.quantity }) : null,
                l.extras > 0 ? t('bookings.detail.extras', { count: l.extras }) : null,
              ]
                .filter(Boolean)
                .join(' · ');
              const segments = l.segments?.map((s) =>
                t('bookings.detail.segment', {
                  spot: s.spot ?? unassigned,
                  from: formatDayLabel(s.from, locale),
                  to: formatDayLabel(s.to, locale),
                }),
              );
              const total = formatCents(l.total);
              return (
                <View
                  key={l.id}
                  className="flex-row items-center justify-between gap-3"
                  accessible
                  // A split stay is read once, segment by segment, without the arrows.
                  accessibilityLabel={
                    segments ? [...segments, details, total].filter(Boolean).join(', ') : undefined
                  }
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="font-semibold">
                      {l.segments
                        ? l.segments.map((s) => s.spot ?? unassigned).join(' → ')
                        : (l.spot ?? unassigned)}
                    </Text>
                    <Text variant="muted">{details}</Text>
                    {segments?.map((s) => (
                      <Text key={s} variant="muted">
                        {s}
                      </Text>
                    ))}
                  </View>
                  <Text>{total}</Text>
                </View>
              );
            })}
          </View>
          <DetailRow
            label={t('bookings.detail.period')}
            value={`${period} · ${t('bookings.detail.days', { count: days })}`}
          />
          <DetailRow label={t('bookings.detail.slots')} value={t(`bookings.slots.${b.slots}`)} />
          <DetailRow
            label={t('bookings.detail.formula')}
            value={t(`bookings.formula.${b.formula}`)}
          />
          <DetailRow
            label={t('bookings.detail.channel')}
            value={t(`bookings.channel.${b.channel}`)}
          />
        </CardContent>
      </Card>

      <CustomerCard booking={b} showContacts={canSeeCustomerContacts(abilities)} />
      <GuestsCard booking={b} />
      <AgreementCard booking={b} />

      <Card>
        <CardHeader>
          <CardTitle>{t('bookings.detail.amounts')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          <AmountRow label={t('bookings.detail.total')} cents={b.total_amount} />
          <AmountRow label={t('bookings.detail.paid')} cents={b.paid_amount} />
          {b.deposit_due > 0 ? (
            <AmountRow label={t('bookings.detail.deposit')} cents={b.deposit_due} />
          ) : null}
          <Separator />
          {b.balance_due > 0 ? (
            <AmountRow label={t('bookings.detail.balance')} cents={b.balance_due} strong />
          ) : (
            <View className="flex-row items-center justify-between" accessible>
              <Text className="font-semibold">{t('bookings.detail.balance')}</Text>
              <Text className="font-semibold">{t('bookings.settled')}</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <PaymentsCard booking={b} locale={locale} timeZone={timeZone} />
      <BookingSheetActions booking={b} />
      <NotesCard booking={b} />
      <HistoryCard booking={b} locale={locale} timeZone={timeZone} />
    </>
  );
}

function AmountRow({
  label,
  cents,
  strong = false,
}: {
  label: string;
  cents: number;
  strong?: boolean;
}) {
  const amount = formatCents(cents);
  return (
    <View
      className="flex-row items-center justify-between gap-3"
      accessible
      accessibilityLabel={`${label}: ${amount}`}
    >
      <Text className={cn(strong && 'font-semibold')}>{label}</Text>
      <Text className={cn(strong && 'font-semibold')}>{amount}</Text>
    </View>
  );
}

function CustomerCard({ booking, showContacts }: { booking: Booking; showContacts: boolean }) {
  const { t } = useTranslation();
  const c = customerView(booking.customer, showContacts);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('bookings.detail.customer')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <Text className="text-lg font-semibold" selectable>
          {c.anonymized || !c.name ? t('bookings.anonymous') : c.name}
        </Text>
        {c.tags.length > 0 ? (
          <DetailRow label={t('bookings.detail.tags')} value={c.tags.join(', ')} />
        ) : null}
        {c.email ? <DetailRow label={t('bookings.detail.email')} value={c.email} /> : null}
        {c.phone ? <DetailRow label={t('bookings.detail.phone')} value={c.phone} /> : null}
        <ContactActions phone={c.phone} email={c.email} name={c.name || t('bookings.anonymous')} />
        {c.notes ? <DetailRow label={t('bookings.detail.customerNotes')} value={c.notes} /> : null}
        {!showContacts && !c.anonymized ? (
          <Text variant="muted">{t('bookings.detail.contactsHidden')}</Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Call, WhatsApp and email from the sheet: shown only with the contacts the
 * role may see (customerView), opened in the phone's own apps.
 */
function ContactActions({ phone, email, name }: { phone?: string; email?: string; name: string }) {
  const { t } = useTranslation();
  const { openUrl } = useDependencies();
  const [failed, setFailed] = useState(false);
  const links = contactLinks({ phone, email });
  const actions = [
    links.call && { key: 'call', url: links.call, icon: PhoneIcon },
    links.whatsapp && { key: 'whatsapp', url: links.whatsapp, icon: MessageCircleIcon },
    links.email && { key: 'email', url: links.email, icon: MailIcon },
  ].filter((a) => !!a) as {
    key: 'call' | 'whatsapp' | 'email';
    url: string;
    icon: typeof PhoneIcon;
  }[];
  if (actions.length === 0) return null;
  const open = (url: string) => {
    setFailed(false);
    openUrl(url).catch(() => setFailed(true));
  };
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.key}
            variant="outline"
            className="min-h-11"
            accessibilityLabel={t(`bookings.contact.${a.key}Label`, { name })}
            onPress={() => open(a.url)}
          >
            <Icon as={a.icon} size={16} />
            <Text>{t(`bookings.contact.${a.key}`)}</Text>
          </Button>
        ))}
      </View>
      {failed ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {t('bookings.contact.failed')}
        </Text>
      ) : null}
    </View>
  );
}

/** Group and guests (core 1.1): only when the booking has them. */
function GuestsCard({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const g = guestsView(booking);
  if (!g) return null;
  const party = [
    g.adults ? t('bookings.guests.adults', { count: g.adults }) : null,
    g.children ? t('bookings.guests.children', { count: g.children }) : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('bookings.guests.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        {g.group ? <DetailRow label={t('bookings.guests.group')} value={g.group} /> : null}
        {g.origin ? <DetailRow label={t('bookings.guests.origin')} value={g.origin} /> : null}
        {party ? <DetailRow label={t('bookings.guests.party')} value={party} /> : null}
        {g.names.length > 0 ? (
          <DetailRow label={t('bookings.guests.names')} value={g.names.join(', ')} />
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Agreement, partner and requirement check (core 1.1): only when the booking has them. */
function AgreementCard({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const a = agreementView(booking);
  if (!a) return null;
  const share =
    a.share?.kind === 'full'
      ? t('bookings.agreement.shareFull')
      : a.share?.kind === 'percent'
        ? t('bookings.agreement.sharePercent', {
            percent: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
              a.share.percent,
            ),
          })
        : a.share?.kind === 'amount'
          ? t('bookings.agreement.shareAmount', { amount: formatCents(a.share.amount) })
          : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('bookings.agreement.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        {a.name ? <DetailRow label={t('bookings.agreement.name')} value={a.name} /> : null}
        {a.partner ? <DetailRow label={t('bookings.agreement.partner')} value={a.partner} /> : null}
        {share ? <DetailRow label={t('bookings.agreement.share')} value={share} /> : null}
        {a.partnerAmount !== undefined ? (
          <AmountRow label={t('bookings.agreement.partnerAmount')} cents={a.partnerAmount} />
        ) : null}
        {a.guestStay ? (
          <DetailRow
            label={t('bookings.agreement.guestStay')}
            value={t('bookings.stay', {
              from: formatDayLabel(a.guestStay.from, locale),
              to: formatDayLabel(a.guestStay.to, locale),
            })}
          />
        ) : null}
        {a.requirement ? (
          <RequirementCheck
            bookingId={booking.id}
            version={booking.version}
            requirement={a.requirement}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function PaymentsCard({
  booking,
  locale,
  timeZone,
}: {
  booking: Booking;
  locale: string;
  timeZone: string | undefined;
}) {
  const { t } = useTranslation();
  const payments = paymentViews(booking);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('bookings.detail.payments')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        {payments.length === 0 ? (
          <Text variant="muted">{t('bookings.detail.paymentsEmpty')}</Text>
        ) : (
          payments.map((p) => {
            const kind = p.refund
              ? `${t('bookings.detail.refund')} · ${t(`bookings.detail.methods.${p.method}`)}`
              : t(`bookings.detail.methods.${p.method}`);
            const status = t(`bookings.detail.paymentStatus.${p.status}`);
            const when = formatInstant(p.at, locale, timeZone);
            const amount = formatCents(p.signedAmount);
            return (
              <View
                key={p.id}
                className="flex-row items-start justify-between gap-3"
                accessible
                accessibilityLabel={[kind, amount, status, when, p.test ? t('bookings.test') : null]
                  .filter(Boolean)
                  .join(', ')}
              >
                <View className="flex-1 gap-0.5">
                  <Text className="font-medium">{kind}</Text>
                  <Text variant="muted">
                    {[when, status, p.test ? t('bookings.test') : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text
                  className={cn(
                    p.status === 'succeeded' ? 'text-foreground' : 'text-muted-foreground',
                    p.status !== 'succeeded' && 'line-through',
                  )}
                >
                  {amount}
                </Text>
              </View>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function NotesCard({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const internal = booking.notes_internal.trim();
  const customer = booking.notes_customer.trim();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('bookings.detail.notes')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        {!internal && !customer ? (
          <Text variant="muted">{t('bookings.detail.notesEmpty')}</Text>
        ) : null}
        {internal ? (
          <DetailRow label={t('bookings.detail.notesInternal')} value={internal} />
        ) : null}
        {customer ? (
          <DetailRow label={t('bookings.detail.notesCustomer')} value={customer} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function HistoryCard({
  booking,
  locale,
  timeZone,
}: {
  booking: Booking;
  locale: string;
  timeZone: string | undefined;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const total = booking.history.length;
  const entries = historyViews(booking, showAll ? undefined : HISTORY_PREVIEW);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('bookings.detail.history')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        {entries.length === 0 ? (
          <Text variant="muted">{t('bookings.detail.historyEmpty')}</Text>
        ) : (
          <View className="gap-3" role="list" accessibilityLabel={t('bookings.detail.history')}>
            {entries.map((e) => {
              const action =
                e.action === 'other'
                  ? t('bookings.detail.actions.other')
                  : t(`bookings.detail.actions.${e.action}`);
              const actor = e.actorName ?? t(`bookings.detail.actor.${e.actorType}`);
              const when = formatInstant(e.at, locale, timeZone);
              return (
                <View
                  key={e.key}
                  role="listitem"
                  className="gap-0.5 border-l-2 border-border pl-3"
                  accessible
                  accessibilityLabel={`${action}, ${when}, ${actor}`}
                >
                  <Text className="font-medium">{action}</Text>
                  <Text variant="muted">{`${when} · ${actor}`}</Text>
                </View>
              );
            })}
          </View>
        )}
        {!showAll && total > HISTORY_PREVIEW ? (
          <Button variant="outline" onPress={() => setShowAll(true)}>
            <Text>{t('bookings.detail.showAllHistory', { count: total })}</Text>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
