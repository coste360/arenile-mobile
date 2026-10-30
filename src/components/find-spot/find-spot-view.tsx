import { router } from 'expo-router';
import {
  CircleAlertIcon,
  LockIcon,
  MapIcon,
  RefreshCwIcon,
  UmbrellaIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { BeachMap, Slots } from '@/api/types';
import { DateField } from '@/components/date-field';
import { ChipRow, FilterChip } from '@/components/filter-chip';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { OnlineOnlyNotice } from '@/components/online-only-notice';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { mapName } from '@/features/day-map/model';
import { freeCount, rowsOf, visibleRows, type FindSpotRow } from '@/features/find-spot/find-spot';
import { useAvailability, type AvailabilityParams } from '@/features/find-spot/queries';
import { useMapDocument, useMaps } from '@/features/maps/queries';
import {
  canCreateBooking,
  endFor,
  MAX_STAY_DAYS,
  STAY_LENGTHS,
  stayLength,
  validStay,
  withStart,
} from '@/features/new-booking/new-booking';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationalDays } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatDayLabel, type CalendarDate } from '@/lib/calendar';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

const SLOTS: readonly Slots[] = ['FULL', 'AM', 'PM'];
const QUERY_DEBOUNCE_MS = 300;

/**
 * "Trova posto" (core spec 7.8, 30.4): the spots free for the whole stay,
 * row by row, for the customer at the desk. A free spot starts the new
 * booking on the fly with the same dates and slot; a spot free only on some
 * days is shown greyed with its free days. Online only, for the roles that
 * create bookings.
 */
export function FindSpotView({ startsOn }: { startsOn: CalendarDate }) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  if (!abilities.known) return <StateView busy title={t('common.loading')} />;
  if (!canCreateBooking(abilities)) {
    return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
  }
  return <FindSpotForm initialStart={startsOn} />;
}

function FindSpotForm({ initialStart }: { initialStart: CalendarDate }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const layout = useDeviceLayout();
  const { today } = useOperationalDays();
  const { available: online } = useOnlineOnly();
  const maps = useMaps();

  const [stay, setStay] = useState({ startsOn: initialStart, endsOn: initialStart });
  const [slots, setSlots] = useState<Slots>('FULL');
  const [chosenMap, setChosenMap] = useState<string | null>(null);
  const [onlyFree, setOnlyFree] = useState(false);

  const mapList = maps.data ?? [];
  const mapId =
    chosenMap && mapList.some((m) => m.id === chosenMap) ? chosenMap : (mapList[0]?.id ?? '');
  const doc = useMapDocument(mapId);

  const params: AvailabilityParams | null =
    mapId && validStay(stay.startsOn, stay.endsOn)
      ? { from: stay.startsOn, to: stay.endsOn, slots, mapId }
      : null;
  const key = params ? JSON.stringify(params) : '';
  const debounced = useDebouncedValue(key, QUERY_DEBOUNCE_MS);
  // The first question goes at once; later changes wait for the debounce.
  const settled = debounced || key;
  const availability = useAvailability(
    settled ? (JSON.parse(settled) as AvailabilityParams) : null,
  );
  const days = stayLength(stay.startsOn, stay.endsOn);

  const form = (
    <View className="gap-3">
      <Text variant="muted">{t('findSpot.subtitle')}</Text>
      <View className="flex-row gap-3">
        <DateField
          label={t('newBooking.from')}
          value={stay.startsOn}
          locale={locale}
          minimumDate={today}
          testID="find-spot-from"
          onChange={(d) => setStay((s) => withStart(s, d))}
        />
        <DateField
          label={t('newBooking.to')}
          value={stay.endsOn}
          locale={locale}
          minimumDate={stay.startsOn}
          maximumDate={endFor(stay.startsOn, MAX_STAY_DAYS)}
          testID="find-spot-to"
          onChange={(d) => setStay((s) => ({ ...s, endsOn: d < s.startsOn ? s.startsOn : d }))}
        />
      </View>
      <ChipRow label={t('newBooking.length')}>
        {STAY_LENGTHS.map((n) => (
          <FilterChip
            key={n}
            label={t('newBooking.days', { count: n })}
            selected={days === n}
            onPress={() => setStay((s) => ({ ...s, endsOn: endFor(s.startsOn, n) }))}
          />
        ))}
      </ChipRow>
      <ChipRow label={t('newBooking.slot')}>
        {SLOTS.map((s) => (
          <FilterChip
            key={s}
            label={t(`dayMap.slot.${s}`)}
            selected={slots === s}
            onPress={() => setSlots(s)}
          />
        ))}
      </ChipRow>
      {mapList.length > 1 ? (
        <ChipRow label={t('findSpot.map')}>
          {mapList.map((m: BeachMap) => (
            <FilterChip
              key={m.id}
              label={mapName(m, locale, t('dayMap.mapFallback'))}
              selected={m.id === mapId}
              onPress={() => setChosenMap(m.id)}
            />
          ))}
        </ChipRow>
      ) : null}
    </View>
  );

  let results;
  if (!online) {
    results = null;
  } else if (maps.data && mapList.length === 0) {
    results = <StateView align="top" icon={MapIcon} title={t('dayMap.states.noMaps.title')} />;
  } else if (maps.isError || doc.isError || (availability.isError && !availability.data)) {
    results = (
      <StateView
        align="top"
        icon={CircleAlertIcon}
        tone="destructive"
        title={t('findSpot.errorTitle')}
        description={t('findSpot.errorDescription')}
      >
        <Button
          variant="outline"
          onPress={() => {
            if (maps.isError) void maps.refetch();
            if (doc.isError) void doc.refetch();
            void availability.refetch();
          }}
        >
          <Icon as={RefreshCwIcon} size={16} />
          <Text>{t('common.retry')}</Text>
        </Button>
      </StateView>
    );
  } else if (!doc.data || !availability.data) {
    results = <StateView align="top" busy title={t('findSpot.loading')} />;
  } else {
    const rows = rowsOf(doc.data, availability.data);
    const shown = visibleRows(rows, onlyFree);
    const total = freeCount(rows);
    const closed = availability.data.closed_dates ?? [];
    results = (
      <View className="gap-3">
        <Text className="font-semibold" accessibilityLiveRegion="polite" testID="find-spot-total">
          {total > 0 ? t('findSpot.total', { count: total }) : t('findSpot.none')}
        </Text>
        {closed.length > 0 ? (
          <Text variant="muted">
            {t('findSpot.closedDays', {
              dates: closed.map((d) => formatDayLabel(d, locale)).join(', '),
            })}
          </Text>
        ) : null}
        {rows.length > 0 ? (
          <ChipRow label={t('findSpot.filters')}>
            <FilterChip
              label={t('findSpot.onlyFree')}
              selected={onlyFree}
              onPress={() => setOnlyFree((v) => !v)}
            />
          </ChipRow>
        ) : null}
        {rows.length === 0 ? (
          <StateView align="top" icon={UmbrellaIcon} title={t('findSpot.noSpots')} />
        ) : shown.length === 0 ? (
          <StateView align="top" icon={UmbrellaIcon} title={t('findSpot.noFreeRows')} />
        ) : (
          <View className="gap-3" role="list" accessibilityLabel={t('nav.findSpot')}>
            {shown.map((row) => (
              <RowCard
                key={row.row ?? ''}
                row={row}
                onBook={(spotId) =>
                  router.push({
                    pathname: '/new-booking',
                    params: { spotId, from: stay.startsOn, to: stay.endsOn, slot: slots },
                  })
                }
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="gap-4">
      <OnlineOnlyNotice />
      <View className={cn('gap-4', layout === 'tablet' && 'flex-row items-start')}>
        <View className={cn(layout === 'tablet' && 'flex-1')}>{form}</View>
        <View className={cn(layout === 'tablet' && 'flex-1')}>{results}</View>
      </View>
    </View>
  );
}

function RowCard({ row, onBook }: { row: FindSpotRow; onBook: (spotId: string) => void }) {
  const { t } = useTranslation();
  const title = row.row === null ? t('findSpot.noRow') : t('findSpot.row', { row: row.row });
  const state = row.free > 0 ? t('findSpot.rowFree', { count: row.free }) : t('findSpot.rowFull');
  const partly = row.spots.filter((s) => s.state === 'partly');
  return (
    <Card role="listitem" className="py-3" testID={`find-spot-row-${row.row ?? ''}`}>
      <CardContent className="gap-2 px-4">
        <View className="flex-row items-baseline justify-between gap-3" accessible>
          <Text className="font-semibold">{title}</Text>
          <Text variant="muted" className={cn(row.free > 0 && 'text-foreground')}>
            {state}
          </Text>
        </View>
        {row.free > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {row.spots
              .filter((s) => s.state === 'free')
              .map((s) => (
                <Pressable
                  key={s.spotId}
                  role="button"
                  accessibilityLabel={t('newBooking.actionSpot', { label: s.label })}
                  onPress={() => onBook(s.spotId)}
                  testID={`find-spot-${s.spotId}`}
                  className="min-h-11 min-w-16 items-center justify-center rounded-md border border-primary bg-background px-3 active:bg-accent"
                >
                  <Text className="font-semibold tabular-nums text-primary">{s.label}</Text>
                </Pressable>
              ))}
          </View>
        ) : null}
        {partly.length > 0 ? (
          <Text variant="muted" testID={`find-spot-partly-${row.row ?? ''}`}>
            {t('findSpot.partly', {
              spots: partly
                .map((s) =>
                  t('findSpot.partlySpot', {
                    label: s.label,
                    free: s.freeDays,
                    total: s.totalDays,
                  }),
                )
                .join(', '),
            })}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
