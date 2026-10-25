import { router } from 'expo-router';
import {
  ChevronRightIcon,
  CircleAlertIcon,
  CloudOffIcon,
  DoorOpenIcon,
  SearchXIcon,
  TicketCheckIcon,
  TicketXIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { GateCheckInResult } from '@/api/types';
import { isForbidden } from '@/api/errors';
import type { BookingRef } from '@/features/booking-actions/booking-ref';
import { onlineErrorKey } from '@/features/booking-actions/errors';
import { useBookingRef } from '@/features/booking-actions/hooks';
import { useAdmitEntry, type CodeLookup } from '@/features/check-in/hooks';
import type { Resolution } from '@/features/check-in/resolve';
import { useAbilities } from '@/features/permissions/use-abilities';

import { BookingSummary } from './booking-summary';
import { CheckInAction } from './check-in-action';

/**
 * What a scanned or typed code turned out to be, with the next step:
 * a booking (its check-in at hand, its operations one tap away), an entry
 * ticket (admitted at the gate: at once when scanned, after confirmation
 * when typed) or the reason nothing can be done.
 */
export function CodeResult({ resolution }: { resolution: Resolution }) {
  const { t } = useTranslation();

  switch (resolution.type) {
    case 'booking':
      return <BookingResult found={resolution.booking} />;
    case 'entry_ticket':
      return (
        <GateEntry
          title={t('operations.gate.ticketTitle', { number: resolution.ticket.number_label })}
          code={resolution.code}
          manual={resolution.manual}
        />
      );
    case 'entry_number':
      return (
        <GateEntry
          title={t('operations.gate.numberTitle', { number: resolution.code })}
          code={resolution.code}
          manual
        />
      );
    case 'not_found':
      return <Notice icon={SearchXIcon} text={t('operations.result.notFound')} />;
    case 'needs_connection':
      return <Notice icon={CloudOffIcon} text={t('operations.result.needsConnection')} />;
    case 'unrecognized':
      return <Notice icon={CircleAlertIcon} text={t('operations.result.unrecognized')} />;
  }
}

/** The state of a lookup: progress, its result, or why it failed. */
export function CodeLookupView({ state }: { state: CodeLookup }) {
  const { t } = useTranslation();
  switch (state.status) {
    case 'idle':
      return null;
    case 'busy':
      return (
        <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
          <ActivityIndicator className="text-primary" />
          <Text>{t('operations.hub.searching')}</Text>
        </View>
      );
    case 'done':
      return <CodeResult resolution={state.resolution} />;
    case 'error':
      return (
        <Notice
          icon={CircleAlertIcon}
          text={
            isForbidden(state.error)
              ? t('operations.errors.forbidden')
              : t('operations.result.error')
          }
        />
      );
  }
}

/**
 * A found booking, kept live: once its check-in is queued the cached copy
 * changes at once, so the button gives way to "Check-in fatto" and cannot
 * be pressed twice.
 */
function BookingResult({ found }: { found: BookingRef }) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const { ref } = useBookingRef(found.id);
  const booking = ref ?? found;
  return (
    <View className="gap-3">
      <BookingSummary booking={booking} />
      {abilities.canCheckIn ? <CheckInAction booking={booking} /> : null}
      <Button
        variant="outline"
        onPress={() =>
          router.push({
            pathname: '/operations/booking/[bookingId]',
            params: { bookingId: booking.id },
          })
        }
      >
        <Text>{t('operations.result.openBooking')}</Text>
        <Icon as={ChevronRightIcon} size={16} />
      </Button>
    </View>
  );
}

function Notice({ icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <Alert icon={icon} accessibilityLiveRegion="polite">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

const OUTCOME_ICON: Record<GateCheckInResult['outcome'], LucideIcon> = {
  admitted: TicketCheckIcon,
  already_entered: TicketXIcon,
  voided: TicketXIcon,
  wrong_date: TicketXIcon,
};

/**
 * Admission at the gate (operations.run, online only). A scanned QR is
 * admitted at once, a typed code only after the staff confirms (manual
 * entry, recorded in the core audit log).
 */
function GateEntry({ title, code, manual }: { title: string; code: string; manual: boolean }) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const admit = useAdmitEntry();
  const started = useRef(false);
  const allowed = abilities.canCheckIn;

  useEffect(() => {
    if (manual || !allowed || started.current) return;
    started.current = true;
    admit.mutate({ code, manual: false });
  }, [manual, allowed, code, admit]);

  const outcome = admit.data?.outcome;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{title}</CardTitle>
        {manual && !outcome ? (
          <CardDescription>{t('operations.gate.manualDescription')}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="gap-3">
        {!allowed ? (
          <Text variant="muted">{t('operations.gate.forbidden')}</Text>
        ) : outcome ? (
          <Alert
            icon={OUTCOME_ICON[outcome]}
            variant={outcome === 'admitted' ? 'default' : 'destructive'}
            iconClassName={outcome === 'admitted' ? 'text-success' : undefined}
            accessibilityLiveRegion="assertive"
          >
            <AlertTitle>{t(`operations.gate.outcome.${outcome}`)}</AlertTitle>
          </Alert>
        ) : admit.isPending ? (
          <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
            <ActivityIndicator className="text-primary" />
            <Text>{t('operations.gate.working')}</Text>
          </View>
        ) : manual || admit.isError ? (
          <Button size="lg" onPress={() => admit.mutate({ code, manual })}>
            <Icon as={DoorOpenIcon} size={18} />
            <Text>{t('operations.gate.admit')}</Text>
          </Button>
        ) : null}
        {admit.isError ? (
          <Text className="text-destructive" accessibilityLiveRegion="polite">
            {t(onlineErrorKey(admit.error))}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
