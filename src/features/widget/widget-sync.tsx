// Keeps the home screen widget in step with the app: whenever today's
// operational day changes in the query cache (fetch, offline restore,
// optimistic check-in from the queue), the language changes or the device is
// unpaired, the widget gets a new snapshot. It reads today's day from the
// cache only, never fetching it for the widget (spec 04, phase 3); the
// session queries it shares (device, establishment, /auth/me) are the ones
// the app runs anyway.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { operationsDayQuery, useOperationalDays } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useEstablishment } from '@/features/session/queries';
import { useApiClient, usePairedSession, useSession } from '@/features/session/session-provider';
import { useDependencies } from '@/providers/dependencies';

import { widgetEntries, type WidgetSource } from './summary';

/** Renders nothing; mount once inside the providers. */
export function WidgetSync() {
  const { state } = useSession();
  return state.status === 'paired' ? <PairedWidgetSync /> : <Publish source={UNPAIRED} />;
}

const UNPAIRED: WidgetSource = { status: 'unpaired' };

function PairedWidgetSync() {
  const session = usePairedSession();
  const client = useApiClient();
  const establishment = useEstablishment();
  const abilities = useAbilities();
  const { today, timeZone } = useOperationalDays();
  // Observes today's day without fetching it: the screens and the offline
  // prefetch keep it fresh, the widget only mirrors what is cached.
  const day = useQuery({
    ...operationsDayQuery(client, session.establishmentId, today),
    enabled: false,
  });

  if (!abilities.known) return null;
  const source: WidgetSource = {
    status: 'paired',
    establishmentName: establishment.data?.name ?? session.establishmentName ?? '',
    timeZone,
    today,
    day: day.data,
    updatedAt: day.dataUpdatedAt || undefined,
    restricted: !abilities.canViewBookings,
  };
  return <Publish source={source} />;
}

function Publish({ source }: { source: WidgetSource }) {
  const { widget, clock } = useDependencies();
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!widget) return;
    const entries = widgetEntries(source, { now: clock.now(), locale, t });
    // Same content, same timeline: skip the native write (dates excluded,
    // they move with the clock; midnight only depends on the day).
    const signature = JSON.stringify(entries.map((e) => e.props));
    if (signature === last.current) return;
    last.current = signature;
    widget.publish(entries);
  }, [widget, clock, source, locale, t]);

  return null;
}
