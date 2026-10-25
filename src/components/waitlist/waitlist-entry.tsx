import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LockIcon,
  RefreshCwIcon,
  SearchXIcon,
  SendIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { isForbidden, ProblemError } from '@/api/errors';
import type { WaitlistEntry, WaitlistOffer } from '@/api/types';
import { DetailRow } from '@/components/detail-row';
import { FormField } from '@/components/form-field';
import { ConfirmDialog } from '@/components/operations/confirm-dialog';
import { StateView } from '@/components/state-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isBookable, slotStatus } from '@/features/day-map/status';
import { usePacks } from '@/features/daily-sale/queries';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useEstablishment } from '@/features/session/queries';
import { matchSpots } from '@/features/spot-blocks/spot-search';
import {
  canOfferWaitlist,
  offerable,
  offerSchema,
  toOfferCreate,
  useOfferWaitlistEntry,
  useWaitlistEntry,
  useWaitlistSettings,
  waitlistErrorKey,
  type FreedSpot,
  type OfferErrorKey,
  type OfferValues,
} from '@/features/waitlist/waitlist';
import { formatDayLabel } from '@/lib/calendar';
import { formatInstant } from '@/lib/datetime';
import { localizedText } from '@/lib/i18n-text';
import { cn } from '@/lib/utils';

import { WaitlistOfferBadge, WaitlistStatusBadge } from './waitlist-badges';

/**
 * A waitlist entry: the request, its offers and, for roles with
 * bookings.write, "Offri un posto" (a spot, or the first compatible one,
 * held for the customer for N minutes; the server emails the link).
 */
export function WaitlistEntryView({ entryId, spot }: { entryId: string; spot?: FreedSpot }) {
  const { t } = useTranslation();
  const query = useWaitlistEntry(entryId, true);
  if (query.data) {
    return <EntrySheet entry={query.data.entry} offers={query.data.offers} spot={spot} />;
  }
  if (query.isError) {
    if (isForbidden(query.error)) {
      return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
    }
    if (query.error instanceof ProblemError && query.error.status === 404) {
      return <StateView icon={SearchXIcon} title={t('waitlist.errors.notFound')} />;
    }
    return (
      <StateView icon={CircleAlertIcon} tone="destructive" title={t(waitlistErrorKey(query.error))}>
        <Button variant="outline" onPress={() => void query.refetch()}>
          <Icon as={RefreshCwIcon} size={16} />
          <Text>{t('common.retry')}</Text>
        </Button>
      </StateView>
    );
  }
  return <StateView busy title={t('common.loading')} />;
}

function EntrySheet({
  entry: e,
  offers,
  spot,
}: {
  entry: WaitlistEntry;
  offers: WaitlistOffer[];
  spot?: FreedSpot;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const timeZone = useEstablishment().data?.timezone;
  const abilities = useAbilities();
  const packs = usePacks();
  const pack = packs.data?.find((p) => p.id === e.pack_id);
  const period =
    e.starts_on === e.ends_on
      ? formatDayLabel(e.starts_on, locale)
      : t('bookings.stay', {
          from: formatDayLabel(e.starts_on, locale),
          to: formatDayLabel(e.ends_on, locale),
        });
  const active = e.active_offer ?? offers.find((o) => o.status === 'pending');

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text variant="h3" role="heading">
          {e.customer_display_name}
        </Text>
        <View className="flex-row flex-wrap gap-1">
          <WaitlistStatusBadge status={e.status} />
        </View>
      </View>
      <Card>
        <CardHeader>
          <CardTitle role="heading">{t('waitlist.request')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          {e.status === 'waiting' ? (
            <DetailRow label={t('waitlist.positionLabel')} value={String(e.position)} />
          ) : null}
          <DetailRow label={t('waitlist.period')} value={period} />
          <DetailRow label={t('waitlist.slots')} value={t(`dayMap.slot.${e.slots}`)} />
          {pack ? (
            <DetailRow label={t('waitlist.pack')} value={localizedText(pack.name, locale)} />
          ) : null}
          {e.quantity > 1 ? (
            <DetailRow label={t('waitlist.quantity')} value={String(e.quantity)} />
          ) : null}
          <DetailRow label={t('waitlist.channel')} value={t(`bookings.channel.${e.channel}`)} />
          {e.note ? <DetailRow label={t('waitlist.note')} value={e.note} /> : null}
          {e.offer_count > 0 ? (
            <DetailRow label={t('waitlist.offerCount')} value={String(e.offer_count)} />
          ) : null}
        </CardContent>
      </Card>

      {active ? (
        <Card>
          <CardHeader>
            <CardTitle role="heading">{t('waitlist.activeOffer')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="flex-row flex-wrap gap-1">
              <WaitlistOfferBadge status={active.status} />
            </View>
            {active.spot_label ? (
              <DetailRow label={t('waitlist.offer.spot')} value={active.spot_label} />
            ) : null}
            <DetailRow
              label={t('waitlist.expires')}
              value={formatInstant(active.expires_at, locale, timeZone)}
            />
            {active.cause ? (
              <DetailRow label={t('waitlist.cause')} value={t(`waitlist.causes.${active.cause}`)} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canOfferWaitlist(abilities) && offerable(e) ? (
        <OfferForm entry={e} spot={spot} />
      ) : abilities.known && !canOfferWaitlist(abilities) ? (
        <Text variant="muted">{t('waitlist.readOnly')}</Text>
      ) : null}
    </View>
  );
}

const ANY = 'any';

function OfferForm({ entry, spot }: { entry: WaitlistEntry; spot?: FreedSpot }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const timeZone = useEstablishment().data?.timezone;
  const { available: online } = useOnlineOnly();
  const settings = useWaitlistSettings(online);
  const day = useOperationsDay(entry.starts_on);
  const offer = useOfferWaitlistEntry();
  const [choice, setChoice] = useState<string>(spot?.spotId ?? entry.spot_id ?? ANY);
  const [pending, setPending] = useState<OfferValues | null>(null);
  const [error, setError] = useState<OfferErrorKey | null>(null);
  const [done, setDone] = useState<WaitlistOffer | null>(null);
  const { control, handleSubmit } = useForm<OfferValues>({
    resolver: zodResolver(offerSchema),
    values: { minutes: String(settings.data?.offer_hold_minutes ?? 120) },
    mode: 'onTouched',
  });

  // Spots free on the first day asked, in the requested zone (the server checks the rest).
  const free = (day.data?.spots ?? []).filter(
    (s) =>
      (!entry.zone_id || s.zone_id === entry.zone_id) && isBookable(slotStatus(s, entry.slots)),
  );
  const options = matchSpots(free, '').spots.map((s) => ({ spot_id: s.spot_id, label: s.label }));
  // The freed spot opened from the map stays offered even if the day is not loaded.
  if (spot && !options.some((s) => s.spot_id === spot.spotId)) {
    options.unshift({ spot_id: spot.spotId, label: spot.label });
  }
  const chosenLabel =
    choice === ANY ? t('waitlist.offer.anySpot') : options.find((s) => s.spot_id === choice)?.label;

  if (done) {
    return (
      <Alert icon={CircleCheckIcon} accessibilityLiveRegion="assertive" testID="offer-done">
        <AlertTitle>
          {t('waitlist.offer.done', { customer: entry.customer_display_name })}
        </AlertTitle>
        <AlertDescription>
          {t('waitlist.offer.doneDetail', {
            spot: done.spot_label ?? t('waitlist.offer.anySpot'),
            time: formatInstant(done.expires_at, locale, timeZone),
          })}
        </AlertDescription>
      </Alert>
    );
  }

  const send = async () => {
    const values = pending;
    setPending(null);
    if (!values) return;
    setError(null);
    try {
      setDone(
        await offer.mutateAsync({
          entryId: entry.id,
          body: toOfferCreate(choice === ANY ? undefined : choice, values.minutes),
        }),
      );
    } catch (err) {
      setError(waitlistErrorKey(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('waitlist.offer.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <Text variant="muted">
          {t('waitlist.offer.description', { customer: entry.customer_display_name })}
        </Text>
        <View className="gap-2">
          <Text variant="small">{t('waitlist.offer.spot')}</Text>
          <View
            role="radiogroup"
            accessibilityLabel={t('waitlist.offer.spot')}
            className="flex-row flex-wrap gap-2"
          >
            {[{ spot_id: ANY, label: t('waitlist.offer.anySpot') }, ...options].map((s) => {
              const selected = choice === s.spot_id;
              return (
                <Pressable
                  key={s.spot_id}
                  role="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={s.label}
                  onPress={() => setChoice(s.spot_id)}
                  className={cn(
                    'min-h-11 flex-row items-center gap-1 rounded-md border px-3',
                    selected
                      ? 'border-primary bg-primary'
                      : 'border-border bg-background active:bg-accent',
                  )}
                >
                  {selected ? (
                    <Icon as={CheckIcon} size={14} className="text-primary-foreground" />
                  ) : null}
                  <Text
                    className={cn(
                      'font-medium',
                      selected ? 'text-primary-foreground' : 'text-foreground',
                    )}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <FormField
          control={control}
          name="minutes"
          label={t('waitlist.offer.minutes')}
          keyboardType="number-pad"
          hint={t('waitlist.offer.help')}
        />
        {!online ? (
          <Text variant="muted" accessibilityLiveRegion="polite">
            {t('waitlist.onlineOnly')}
          </Text>
        ) : null}
        {error ? (
          <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="assertive">
            <AlertDescription>{t(error)}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          size="lg"
          disabled={!online || offer.isPending}
          onPress={() => void handleSubmit((v) => setPending(v))()}
        >
          <Icon as={SendIcon} size={18} className="text-primary-foreground" />
          <Text>{t('waitlist.offer.submit')}</Text>
        </Button>
      </CardContent>
      <ConfirmDialog
        open={!!pending}
        title={t('waitlist.offer.confirmTitle', { customer: entry.customer_display_name })}
        description={t('waitlist.offer.confirmDescription', {
          spot: chosenLabel ?? '',
          minutes: pending?.minutes ?? '',
        })}
        confirmLabel={t('waitlist.offer.submit')}
        onConfirm={() => void send()}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}
