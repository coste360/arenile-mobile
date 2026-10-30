import { router } from 'expo-router';
import {
  CalendarOffIcon,
  CircleAlertIcon,
  LockIcon,
  MapIcon,
  RefreshCwIcon,
  UmbrellaIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { isForbidden } from '@/api/errors';
import type { Slots } from '@/api/types';
import { DateField } from '@/components/date-field';
import { ChipRow, FilterChip } from '@/components/filter-chip';
import { Columns } from '@/components/layout/columns';
import { useContentWidth } from '@/components/layout/nav-pane';
import { columnsFor } from '@/components/layout/panes';
import { OnlineOnlyNotice } from '@/components/online-only-notice';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  attributeOptions,
  freeCount,
  rowsOf,
  visibleRows,
  wholeStayClosed,
  zoneCards,
  type AvailabilityRow,
  type AvailabilityZone,
} from '@/features/availability/by-row';
import {
  useAvailability,
  useZones,
  type AvailabilityParams,
} from '@/features/availability/queries';
import { mapName } from '@/features/day-map/model';
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
import { localizedText } from '@/lib/i18n-text';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

const SLOTS: readonly Slots[] = ['FULL', 'AM', 'PM'];
const QUERY_DEBOUNCE_MS = 300;

/**
 * "Disponibilità" (core spec 7.8, 30.4): the spots free for the whole stay,
 * row by row, for the customer at the desk. A free spot starts the new
 * booking on the fly with the same dates and slot; a spot free only on some
 * days is listed with its free days. Online only, for the roles that create
 * bookings. `mapId` preselects a map (from the day map).
 */
export function AvailabilityView({ startsOn, mapId }: { startsOn: CalendarDate; mapId?: string }) {
  const { t } = useTranslation();
  const abilities = useAbilities();
  if (!abilities.known) return <StateView busy title={t('common.loading')} />;
  if (!canCreateBooking(abilities)) {
    return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
  }
  return <AvailabilityForm initialStart={startsOn} initialMap={mapId} />;
}

function AvailabilityForm({
  initialStart,
  initialMap,
}: {
  initialStart: CalendarDate;
  initialMap?: string;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { today } = useOperationalDays();
  const { available: online } = useOnlineOnly();
  const maps = useMaps();

  const [chosen, setChosen] = useState({ startsOn: initialStart, endsOn: initialStart });
  // A stay chosen yesterday starts today once the day changes (same length).
  const stay = chosen.startsOn < today ? withStart(chosen, today) : chosen;
  const [slots, setSlots] = useState<Slots>('FULL');
  const [chosenMap, setChosenMap] = useState<string | null>(initialMap ?? null);
  const [onlyFree, setOnlyFree] = useState(false);
  // Attributes chosen on a map; another map starts with none.
  const [chosenAttributes, setChosenAttributes] = useState<{ mapId: string; names: string[] }>({
    mapId: '',
    names: [],
  });
  const zones = useZones();
  // Chips scroll to the pane edges only when form and results are stacked.
  const stacked = columnsFor(useContentWidth(), 2) === 1;

  const mapList = maps.data ?? [];
  const mapId =
    chosenMap && mapList.some((m) => m.id === chosenMap) ? chosenMap : (mapList[0]?.id ?? '');
  const doc = useMapDocument(mapId);
  const options = doc.data ? attributeOptions(doc.data) : [];
  const attributes =
    chosenAttributes.mapId === mapId
      ? chosenAttributes.names.filter((n) => options.includes(n))
      : [];
  const toggleAttribute = (name: string) =>
    setChosenAttributes({
      mapId,
      names: attributes.includes(name)
        ? attributes.filter((n) => n !== name)
        : [...attributes, name],
    });
  const zoneInfo = new Map(
    (zones.data ?? []).map(
      (z) => [z.id, { name: localizedText(z.name, locale), mapId: z.map_id }] as const,
    ),
  );

  // Each input settles on its own; a change of several at once settles together.
  const from = useDebouncedValue(stay.startsOn, QUERY_DEBOUNCE_MS);
  const to = useDebouncedValue(stay.endsOn, QUERY_DEBOUNCE_MS);
  const settledSlots = useDebouncedValue(slots, QUERY_DEBOUNCE_MS);
  const asked: AvailabilityParams | null =
    mapId && validStay(from, to) ? { from, to, slots: settledSlots } : null;
  const availability = useAvailability(asked);
  // The answer on screen is for other inputs: shown dimmed, its spots not bookable.
  const stale =
    availability.isPlaceholderData ||
    from !== stay.startsOn ||
    to !== stay.endsOn ||
    settledSlots !== slots;
  const days = stayLength(stay.startsOn, stay.endsOn);
  const failed = [maps.error, doc.error, availability.data ? null : availability.error].find(
    (e) => !!e,
  );

  const form = (
    <View className="gap-3">
      <Text variant="muted">{t('availability.subtitle')}</Text>
      <View className="flex-row gap-3">
        <DateField
          label={t('newBooking.from')}
          value={stay.startsOn}
          locale={locale}
          minimumDate={today}
          testID="availability-from"
          onChange={(d) => setChosen(withStart(stay, d))}
        />
        <DateField
          label={t('newBooking.to')}
          value={stay.endsOn}
          locale={locale}
          minimumDate={stay.startsOn}
          maximumDate={endFor(stay.startsOn, MAX_STAY_DAYS)}
          testID="availability-to"
          onChange={(d) => setChosen({ ...stay, endsOn: d < stay.startsOn ? stay.startsOn : d })}
        />
      </View>
      <ChipRow label={t('newBooking.length')}>
        {STAY_LENGTHS.map((n) => (
          <FilterChip
            key={n}
            label={t('newBooking.days', { count: n })}
            selected={days === n}
            onPress={() => setChosen({ ...stay, endsOn: endFor(stay.startsOn, n) })}
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
        <ChipRow label={t('availability.map')}>
          {mapList.map((m) => (
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

  let results = null;
  if (!online) {
    results = null;
  } else if (failed && isForbidden(failed)) {
    results = <StateView align="top" icon={LockIcon} title={t('offline.errors.forbidden')} />;
  } else if (failed) {
    results = (
      <StateView
        align="top"
        icon={CircleAlertIcon}
        tone="destructive"
        title={t('availability.errorTitle')}
        description={t('availability.errorDescription')}
      >
        <Button
          variant="outline"
          onPress={() => {
            if (maps.isError) void maps.refetch();
            if (doc.isError) void doc.refetch();
            if (availability.isError) void availability.refetch();
          }}
        >
          <Icon as={RefreshCwIcon} size={16} />
          <Text>{t('common.retry')}</Text>
        </Button>
      </StateView>
    );
  } else if (maps.data && mapList.length === 0) {
    results = <StateView align="top" icon={MapIcon} title={t('dayMap.states.noMaps.title')} />;
  } else if (!doc.data || !availability.data) {
    results = <StateView align="top" busy title={t('availability.loading')} />;
  } else if (wholeStayClosed(availability.data)) {
    results = (
      <View className={cn(stale && 'opacity-50')}>
        <StateView align="top" icon={CalendarOffIcon} title={t('availability.closedStay')} />
      </View>
    );
  } else {
    const rows = rowsOf(doc.data, availability.data, { attributes });
    const shown = visibleRows(rows, onlyFree);
    const total = freeCount(rows);
    // Zones have no spot attributes: with an attribute chosen, only spots answer.
    const cards = attributes.length
      ? []
      : zoneCards(availability.data, mapId, zoneInfo).filter((z) => !onlyFree || z.available > 0);
    const closed = availability.data.closed_dates ?? [];
    const book = (spotId: string) =>
      router.push({
        pathname: '/new-booking',
        params: { spotId, from: stay.startsOn, to: stay.endsOn, slot: slots },
      });
    results = (
      <View className="gap-3">
        {stale ? (
          <Text variant="muted" accessibilityLiveRegion="polite" testID="availability-updating">
            {t('availability.updating')}
          </Text>
        ) : (
          <Text
            className="font-semibold"
            accessibilityLiveRegion="polite"
            testID="availability-total"
          >
            {total > 0 ? t('availability.total', { count: total }) : t('availability.none')}
          </Text>
        )}
        {closed.length > 0 ? (
          <Text variant="muted">
            {t('availability.closedDays', {
              dates: closed.map((d) => formatDayLabel(d, locale)).join(', '),
            })}
          </Text>
        ) : null}
        <ChipRow label={t('availability.filters')} bleed={stacked}>
          <FilterChip
            label={t('availability.onlyFree')}
            selected={onlyFree}
            onPress={() => setOnlyFree((v) => !v)}
          />
        </ChipRow>
        {options.length > 0 ? (
          <ChipRow label={t('availability.attributes')} bleed={stacked}>
            {options.map((name) => (
              <FilterChip
                key={name}
                label={name}
                selected={attributes.includes(name)}
                onPress={() => toggleAttribute(name)}
              />
            ))}
          </ChipRow>
        ) : null}
        {shown.length === 0 && cards.length === 0 ? (
          <StateView
            align="top"
            icon={UmbrellaIcon}
            title={
              attributes.length > 0
                ? t('availability.noMatch')
                : rows.length === 0 && zoneCards(availability.data, mapId, zoneInfo).length === 0
                  ? t('availability.noSpots')
                  : t('availability.noFreeRows')
            }
          />
        ) : (
          <View
            className={cn('gap-3', stale && 'opacity-50')}
            role="list"
            accessibilityLabel={t('nav.availability')}
          >
            {shown.map((row) => (
              <RowCard key={row.row ?? ''} row={row} disabled={stale} onBook={book} />
            ))}
            {cards.map((zone) => (
              <ZoneCard key={zone.zoneId} zone={zone} />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="gap-4">
      <OnlineOnlyNotice />
      <Columns>
        {form}
        {results}
      </Columns>
    </View>
  );
}

function RowCard({
  row,
  disabled,
  onBook,
}: {
  row: AvailabilityRow;
  disabled: boolean;
  onBook: (spotId: string) => void;
}) {
  const { t } = useTranslation();
  const title =
    row.row === null ? t('availability.noRow') : t('availability.row', { row: row.row });
  const state =
    row.free > 0 ? t('availability.rowFree', { count: row.free }) : t('availability.rowFull');
  const partly = row.spots.filter((s) => s.state === 'partly');
  return (
    <Card role="listitem" className="py-3" testID={`availability-row-${row.row ?? ''}`}>
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
                <Button
                  key={s.spotId}
                  variant="outline"
                  className="min-h-11 min-w-16 px-3"
                  disabled={disabled}
                  accessibilityLabel={t('newBooking.actionSpot', { label: s.label })}
                  onPress={() => onBook(s.spotId)}
                  testID={`availability-${s.spotId}`}
                >
                  <Text className="font-semibold tabular-nums">{s.label}</Text>
                </Button>
              ))}
          </View>
        ) : null}
        {partly.length > 0 ? (
          <Text variant="muted" testID={`availability-partly-${row.row ?? ''}`}>
            {t('availability.partly', {
              spots: partly
                .map((s) =>
                  t('availability.partlySpot', {
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

/**
 * A zone sold as a whole or by quantity: free places for the stay. Booking
 * it stays in the panel (the new booking on the fly books a spot).
 */
function ZoneCard({ zone }: { zone: AvailabilityZone }) {
  const { t } = useTranslation();
  const state =
    zone.available > 0
      ? t('availability.zoneFree', { count: zone.available, capacity: zone.capacity })
      : t('availability.rowFull');
  return (
    <Card role="listitem" className="py-3" testID={`availability-zone-${zone.zoneId}`}>
      <CardContent className="px-4">
        <View className="flex-row items-baseline justify-between gap-3" accessible>
          <View className="flex-1">
            <Text className="font-semibold">{zone.name}</Text>
            <Text variant="muted">{t(`availability.zoneMode.${zone.mode}`)}</Text>
          </View>
          <Text variant="muted" className={cn(zone.available > 0 && 'text-foreground')}>
            {state}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}
