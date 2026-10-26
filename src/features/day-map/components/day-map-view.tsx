import { CircleAlertIcon, CloudOffIcon, ListIcon, MapIcon } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';

import { ClosedDayNotice } from '@/components/closed-day-notice';
import { SearchField } from '@/components/search-field';
import { ChoiceGroup } from '@/components/segmented-choice';
import { StateView } from '@/components/state-view';
import { useContentWidth } from '@/components/layout/nav-pane';
import { SHEET_PANE } from '@/components/layout/panes';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { isForbidden } from '@/api/errors';
import type { BeachMap, Slots } from '@/api/types';
import { useMapDocument, useMaps } from '@/features/maps/queries';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useEstablishment } from '@/features/session/queries';
import { inOfflineWindow, resolveDay, type DaySelection } from '@/lib/calendar';
import { cn } from '@/lib/utils';

import { contentRect, hitTest, type Point } from '../geometry';
import { mapKitOf } from '../kit/kits';
import { sheetBesideMap } from '../layout';
import {
  buildDaySpots,
  compareLabels,
  countByStatus,
  mapName,
  searchSpots,
  type DaySpot,
} from '../model';
import { DayToolbar } from './day-toolbar';
import { MapCanvas } from './map-canvas';
import { MapViewport, OVERSCAN, type FocusRequest } from './map-viewport';
import { SpotList } from './spot-list';
import { SpotSheet } from './spot-sheet';
import { useMapPalette } from './status-glyph';
import { StatusLegend } from './status-legend';

/** Zoom (relative to the fit) at which a spot chosen from a list is shown. */
const FOCUS_ZOOM = 3;
/**
 * Day map (phase 1 "Mappa del giorno", core spec 11.3): the operational map
 * of today or tomorrow with the panel's status colours, glyphs and labels,
 * pan and pinch zoom, search, and the spot sheet. On tablets the sheet opens
 * beside the map, which stays visible.
 */
export function DayMapView() {
  const { t } = useTranslation();
  const maps = useMaps();
  const [chosenMap, setChosenMap] = useState<string | null>(null);
  // Kept across maps: switching map keeps the day, the slot and the view.
  const [settings, setSettings] = useState<PaneSettings>({
    day: 'today',
    slot: 'FULL',
    view: 'map',
  });

  if (!maps.data) {
    if (maps.isError) {
      return <ErrorState forbidden={isForbidden(maps.error)} onRetry={() => void maps.refetch()} />;
    }
    return <StateView busy title={t('dayMap.states.loading')} />;
  }
  if (maps.data.length === 0) {
    return (
      <StateView
        icon={MapIcon}
        title={t('dayMap.states.noMaps.title')}
        description={t('dayMap.states.noMaps.description')}
      />
    );
  }
  const mapId =
    chosenMap && maps.data.some((m) => m.id === chosenMap) ? chosenMap : maps.data[0]!.id;
  return (
    <MapPane
      key={mapId}
      maps={maps.data}
      mapId={mapId}
      onMap={setChosenMap}
      settings={settings}
      onSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
    />
  );
}

function ErrorState({ forbidden, onRetry }: { forbidden: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <StateView
      icon={CircleAlertIcon}
      tone="destructive"
      title={forbidden ? t('dayMap.states.forbidden.title') : t('dayMap.states.error.title')}
      description={forbidden ? t('offline.errors.forbidden') : t('dayMap.states.error.description')}
    >
      {forbidden ? null : (
        <Button variant="outline" size="lg" onPress={onRetry}>
          <Text>{t('common.retry')}</Text>
        </Button>
      )}
    </StateView>
  );
}

interface PaneSettings {
  day: DaySelection;
  slot: Slots;
  view: 'map' | 'list';
}

function MapPane({
  maps,
  mapId,
  onMap,
  settings,
  onSettings,
}: {
  maps: readonly BeachMap[];
  mapId: string;
  onMap: (id: string) => void;
  settings: PaneSettings;
  onSettings: (patch: Partial<PaneSettings>) => void;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const layout = useDeviceLayout();
  const tablet = layout === 'tablet';
  const window = useWindowDimensions();
  const palette = useMapPalette();
  const paneWidth = useContentWidth();
  const establishment = useEstablishment();
  const kit = mapKitOf(establishment.data?.theme);
  const abilities = useAbilities();
  const { today, tomorrow, timeZone } = useOperationalDays();
  const { day: dayChoice, slot, view } = settings;
  const setDayChoice = (day: DaySelection) => onSettings({ day });
  const setSlot = (value: Slots) => onSettings({ slot: value });
  const setView = (value: 'map' | 'list') => onSettings({ view: value });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusRequest | undefined>();
  const nonce = useRef(0);
  const date = resolveDay(dayChoice, { today, tomorrow });
  const { available: online } = useOnlineOnly();

  const doc = useMapDocument(mapId);
  // The whole day (FULL) is what the offline cache keeps: the half-day
  // statuses come with it (am_status / pm_status), so AM and PM work offline.
  const day = useOperationsDay(date);

  const spots = useMemo(
    () =>
      doc.data
        ? buildDaySpots({
            document: doc.data,
            day: day.data,
            slot,
            canSeeCustomers: abilities.canViewBookings,
            texts: {
              anonymous: t('dayMap.occupant.anonymous'),
              anonymousShort: t('dayMap.occupant.anonymousShort'),
            },
          })
        : [],
    [doc.data, day.data, slot, abilities.canViewBookings, t],
  );
  const counts = useMemo(() => countByStatus(spots), [spots]);
  const results = useMemo(() => searchSpots(spots, query), [spots, query]);
  const matches = useMemo(
    () => (query.trim() ? new Set(results.map((s) => s.id)) : undefined),
    [results, query],
  );
  const sorted = useMemo(() => [...spots].sort((a, b) => compareLabels(a.label, b.label)), [spots]);
  const selected = spots.find((s) => s.id === selectedId);
  const content = useMemo(() => (doc.data ? contentRect(doc.data.map) : null), [doc.data]);

  const select = useCallback((spot: DaySpot) => {
    setSelectedId(spot.id);
    nonce.current += 1;
    setFocus({ point: { x: spot.x, y: spot.y }, minZoom: FOCUS_ZOOM, nonce: nonce.current });
  }, []);

  const onTap = useCallback(
    (point: Point, k: number) => {
      const hit = hitTest(spots, point, k);
      setSelectedId(hit?.id ?? null);
    },
    [spots],
  );

  if (!doc.data || !content) {
    if (doc.isError) {
      return <ErrorState forbidden={isForbidden(doc.error)} onRetry={() => void doc.refetch()} />;
    }
    return <StateView busy title={t('dayMap.states.loading')} />;
  }

  const name = mapName(doc.data.map, locale, t('dayMap.mapFallback'));
  const beside = sheetBesideMap(tablet, paneWidth);
  const initialSize = tablet
    ? {
        width: Math.max(320, paneWidth - (selected && beside ? SHEET_PANE : 0)),
        height: Math.max(320, (window.height - 260) * (selected && !beside ? 0.5 : 1)),
      }
    : { width: window.width, height: Math.max(240, window.height * (selected ? 0.3 : 0.55)) };

  const toolbar = (
    <View className="gap-3 px-4 pt-3">
      <View className="flex-row items-center gap-2">
        <SearchField
          className="flex-1"
          value={query}
          onChangeText={setQuery}
          label={t('dayMap.search.label')}
          placeholder={
            abilities.canViewBookings
              ? t('dayMap.search.placeholder')
              : t('dayMap.search.placeholderNoCustomers')
          }
        />
        <ChoiceGroup<'map' | 'list'>
          segmented
          label={t('dayMap.view.label')}
          value={view}
          onChange={setView}
          choices={[
            { value: 'map', label: t('dayMap.view.map'), icon: MapIcon },
            { value: 'list', label: t('dayMap.view.list'), icon: ListIcon },
          ]}
        />
      </View>
      <DayToolbar
        day={dayChoice}
        onDay={setDayChoice}
        dates={{ today, tomorrow }}
        slot={slot}
        onSlot={setSlot}
        locale={locale}
      />
      {maps.length > 1 ? (
        <View>
          <ChoiceGroup
            label={t('dayMap.maps')}
            value={mapId}
            onChange={(id) => {
              setSelectedId(null);
              onMap(id);
            }}
            scroll
            choices={maps.map((m) => ({
              value: m.id,
              label: mapName(m, locale, t('dayMap.mapFallback')),
            }))}
          />
        </View>
      ) : null}
    </View>
  );

  const banners = (
    <View className="gap-2 px-4">
      {day.data?.closed ? (
        <ClosedDayNotice date={date} days={{ today, tomorrow }} locale={locale} />
      ) : null}
      {!day.data && !online && !inOfflineWindow(date, { today, tomorrow }) ? (
        <Alert icon={CloudOffIcon} accessibilityLiveRegion="polite">
          <AlertTitle>{t('closedDay.offlineTitle')}</AlertTitle>
          <AlertDescription>{t('closedDay.offlineDescription')}</AlertDescription>
        </Alert>
      ) : !day.data && day.isError ? (
        <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="polite">
          <AlertDescription>
            {isForbidden(day.error) ? t('offline.errors.forbidden') : t('dayMap.states.dayError')}
          </AlertDescription>
        </Alert>
      ) : null}
      {!day.data && day.isLoading ? (
        <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
          <ActivityIndicator className="text-muted-foreground" />
          <Text variant="muted">{t('dayMap.states.dayLoading')}</Text>
        </View>
      ) : null}
    </View>
  );

  const searchResults = query.trim() ? (
    <View className={cn('border-y border-border', tablet ? 'max-h-72' : 'max-h-48')}>
      <Text variant="muted" className="px-4 py-2" accessibilityLiveRegion="polite">
        {results.length > 0
          ? t('dayMap.search.results', { count: results.length })
          : t('dayMap.search.none')}
      </Text>
      <SpotList
        spots={results}
        selectedId={selectedId ?? undefined}
        onSelect={(spot) => {
          // The result is chosen: give the room of the list back to the map.
          setQuery('');
          select(spot);
        }}
        testID="day-map-results"
      />
    </View>
  ) : null;

  const surface =
    view === 'list' ? (
      <SpotList
        spots={sorted}
        selectedId={selectedId ?? undefined}
        onSelect={select}
        className="flex-1"
        testID="day-map-list"
      />
    ) : (
      <MapViewport
        content={content}
        initialSize={initialSize}
        accessibilityLabel={t('dayMap.a11y.map', { name, count: spots.length })}
        onTap={onTap}
        focus={focus}
      >
        {(camera, viewport) => (
          <MapCanvas
            document={doc.data}
            spots={spots}
            camera={camera}
            viewport={viewport}
            overscan={OVERSCAN}
            palette={palette}
            kit={kit}
            locale={locale}
            seaLabel={t('dayMap.seaLabel')}
            selectedId={selectedId ?? undefined}
            matches={matches}
          />
        )}
      </MapViewport>
    );

  const sheet = selected ? (
    <SpotSheet
      spot={selected}
      date={date}
      today={today}
      slot={slot}
      locale={locale}
      timeZone={timeZone}
      onClose={() => setSelectedId(null)}
      className={beside ? 'w-96 border-l border-border' : 'flex-1 border-t border-border'}
    />
  ) : null;

  if (tablet) {
    return (
      <View className="flex-1 flex-row bg-background">
        <View className="pb-safe flex-1 gap-3">
          {toolbar}
          <StatusLegend counts={counts} />
          {banners}
          {searchResults}
          <View className="flex-1">{surface}</View>
          {/* The column already pads the bottom safe area. */}
          {sheet && !beside ? <View className="h-2/5">{sheet}</View> : null}
        </View>
        {beside ? sheet : null}
      </View>
    );
  }

  return (
    <View className="flex-1 gap-3 bg-background">
      {toolbar}
      <StatusLegend counts={counts} />
      {banners}
      {searchResults}
      <View className="flex-1">{surface}</View>
      {sheet ? <View className="pb-safe h-2/5">{sheet}</View> : null}
    </View>
  );
}
