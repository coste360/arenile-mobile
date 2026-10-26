import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  ChevronRightIcon,
  MousePointerClickIcon,
  ScanQrCodeIcon,
  SearchIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import type { OperationalSpot } from '@/api/types';
import { DetailScroll, MasterDetail, useSplitView } from '@/components/layout/master-detail';
import { Screen } from '@/components/layout/screen';
import { CodeLookupView } from '@/components/operations/code-result';
import { SpotActionsPanel } from '@/components/operations/spot-actions-panel';
import { SpotStatusLabel } from '@/components/operations/spot-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchField } from '@/components/search-field';
import { StateView } from '@/components/state-view';
import { Text } from '@/components/ui/text';
import { useCodeLookup, type CodeLookup } from '@/features/check-in/hooks';
import { parseTyped } from '@/features/check-in/scan-code';
import { matchSpots, SPOT_RESULTS_MAX } from '@/features/spot-blocks/spot-search';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { cn } from '@/lib/utils';

/**
 * Operations hub (spec 02 "Operazioni"): check-in by scanning or typing a
 * code, and today's spots for the spot operations (block, pass release).
 * Phones stack the sections and a spot opens its screen; tablets with room
 * for both keep check-in and spots in the list pane and show the code result
 * or the chosen spot (`spot`) beside it.
 */
export default function OperationsScreen() {
  const split = useSplitView();
  const abilities = useAbilities();
  // A role with neither check-in nor spots has nothing to put in the list pane.
  const anything = abilities.canViewBookings || abilities.canBlockSpot;
  return split && anything ? <OperationsSplit /> : <OperationsStack />;
}

function OperationsStack() {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const showSpots = abilities.canBlockSpot || abilities.canViewBookings;
  const navigation = useNavigation<{ setParams(params: { spot?: string }): void }>();
  const { spot } = useLocalSearchParams<{ spot?: string }>();

  // The window got too narrow for the split (rotation, Split View): the
  // chosen spot goes on as on phones.
  useEffect(() => {
    if (!spot) return;
    navigation.setParams({ spot: undefined });
    router.push({ pathname: '/operations/spot/[spotId]', params: { spotId: spot } });
  }, [spot, navigation]);

  return (
    <Screen>
      <Text className="text-muted-foreground">{t('operations.hub.description')}</Text>
      {abilities.canViewBookings ? <CheckInCard /> : null}
      {showSpots ? <SpotsCard /> : null}
    </Screen>
  );
}

function OperationsSplit() {
  const { t } = useTranslation();
  const abilities = useAbilities();
  const showSpots = abilities.canBlockSpot || abilities.canViewBookings;
  const { spot: selected } = useLocalSearchParams<{ spot?: string }>();
  const { state, lookup, reset } = useCodeLookup();
  const { today } = useOperationalDays();
  const day = useOperationsDay(today);
  const spot = selected ? day.data?.spots.find((s) => s.spot_id === selected) : undefined;

  const detail =
    state.status !== 'idle' ? (
      <DetailScroll>
        <CodeLookupView state={state} />
      </DetailScroll>
    ) : spot ? (
      <DetailScroll>
        <SpotActionsPanel key={spot.spot_id} spot={spot} />
      </DetailScroll>
    ) : null;

  return (
    <MasterDetail
      listState="items"
      detailLabel={t('operations.hub.detailLabel')}
      detail={detail}
      placeholder={{
        icon: MousePointerClickIcon,
        title: t('operations.hub.selectTitle'),
        description: t('operations.hub.selectDescription'),
      }}
      list={
        <View className="flex-1 bg-background">
          {abilities.canViewBookings ? (
            <View className="gap-3 border-b border-border px-4 pb-3 pt-4">
              <Text role="heading" className="font-semibold">
                {t('operations.hub.checkInTitle')}
              </Text>
              <CheckInEntry
                state={state}
                onLookup={(code) => {
                  router.setParams({ spot: undefined });
                  void lookup(code, { manual: true });
                }}
                onReset={reset}
              />
            </View>
          ) : null}
          {showSpots ? (
            <SpotList
              selectedId={state.status === 'idle' ? selected : undefined}
              onSelect={(s) => {
                reset();
                router.setParams({ spot: s.spot_id });
              }}
            />
          ) : null}
        </View>
      }
    />
  );
}

function CheckInCard() {
  const { t } = useTranslation();
  const { state, lookup, reset } = useCodeLookup();

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('operations.hub.checkInTitle')}</CardTitle>
        <CardDescription>{t('operations.hub.scanHint')}</CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        <CheckInEntry
          state={state}
          onLookup={(code) => void lookup(code, { manual: true })}
          onReset={reset}
        />
        <CodeLookupView state={state} />
      </CardContent>
    </Card>
  );
}

/** Scan button and typed code of the check-in; the result is shown by the caller. */
function CheckInEntry({
  state,
  onLookup,
  onReset,
}: {
  state: CodeLookup;
  onLookup: (code: ReturnType<typeof parseTyped>) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [missing, setMissing] = useState(false);

  const search = () => {
    if (!code.trim()) {
      setMissing(true);
      return;
    }
    setMissing(false);
    onLookup(parseTyped(code));
  };

  return (
    <>
      <Button size="lg" onPress={() => router.push('/operations/scan')}>
        <Icon as={ScanQrCodeIcon} size={18} />
        <Text>{t('operations.hub.scan')}</Text>
      </Button>
      <View className="gap-2">
        <Label nativeID="code-search">{t('operations.hub.codeLabel')}</Label>
        <View className="flex-row gap-2">
          <Input
            className={cn('flex-1', missing && 'border-destructive')}
            value={code}
            onChangeText={(v) => {
              setCode(v);
              if (state.status !== 'idle') onReset();
            }}
            placeholder={t('operations.hub.codePlaceholder')}
            accessibilityLabel={t('operations.hub.codeLabel')}
            accessibilityLabelledBy="code-search"
            aria-invalid={missing}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={search}
          />
          <Button
            variant="outline"
            onPress={search}
            accessibilityLabel={t('operations.hub.codeSubmit')}
          >
            <Icon as={SearchIcon} size={16} />
            <Text>{t('operations.hub.codeSubmit')}</Text>
          </Button>
        </View>
        {missing ? (
          <Text variant="small" className="text-destructive" accessibilityLiveRegion="polite">
            {t('operations.hub.codeRequired')}
          </Text>
        ) : null}
      </View>
    </>
  );
}

function SpotsCard() {
  const { t } = useTranslation();
  const { today } = useOperationalDays();
  const day = useOperationsDay(today);
  const [query, setQuery] = useState('');
  const { spots, more } = matchSpots(day.data?.spots ?? [], query);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('operations.hub.spotsTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        {!day.data ? (
          <Text variant="muted">
            {day.isPending && !day.isError
              ? t('common.loading')
              : t('operations.hub.spotsUnavailable')}
          </Text>
        ) : (
          <>
            <View className="gap-2">
              <Label nativeID="spot-search">{t('operations.hub.spotsSearch')}</Label>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder={t('operations.hub.spotsSearchPlaceholder')}
                accessibilityLabel={t('operations.hub.spotsSearch')}
                accessibilityLabelledBy="spot-search"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            {spots.length === 0 ? (
              <Text variant="muted">{t('operations.hub.spotsEmpty')}</Text>
            ) : (
              <View role="list">
                {spots.map((spot) => (
                  <Pressable
                    key={spot.spot_id}
                    role="link"
                    accessibilityLabel={`${spot.label}, ${t(`operations.spotStatus.${spot.status}`)}`}
                    onPress={() =>
                      router.push({
                        pathname: '/operations/spot/[spotId]',
                        params: { spotId: spot.spot_id },
                      })
                    }
                    className="min-h-12 flex-row items-center gap-3 border-b border-border px-1 active:bg-accent"
                  >
                    <Text className="w-16 font-semibold">{spot.label}</Text>
                    <View className="flex-1">
                      <SpotStatusLabel status={spot.status} />
                    </View>
                    <Icon as={ChevronRightIcon} size={16} className="text-muted-foreground" />
                  </Pressable>
                ))}
              </View>
            )}
            {more ? (
              <Text variant="muted">
                {t('operations.hub.spotsMore', { max: SPOT_RESULTS_MAX })}
              </Text>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Today's spots in the list pane of the split: search, count and the rows
 * (virtualised, all of them: the pane scrolls on its own).
 */
function SpotList({
  selectedId,
  onSelect,
}: {
  selectedId: string | undefined;
  onSelect: (spot: OperationalSpot) => void;
}) {
  const { t } = useTranslation();
  const { today } = useOperationalDays();
  const day = useOperationsDay(today);
  const [query, setQuery] = useState('');
  const spots = matchSpots(day.data?.spots ?? [], query, Infinity).spots;

  return (
    <View className="flex-1">
      <View className="gap-3 border-b border-border px-4 pb-3 pt-4">
        <Text role="heading" className="font-semibold">
          {t('operations.hub.spotsTitle')}
        </Text>
        <SearchField
          value={query}
          onChangeText={setQuery}
          label={t('operations.hub.spotsSearch')}
          placeholder={t('operations.hub.spotsSearchPlaceholder')}
        />
        {day.data ? (
          <Text variant="muted">{t('operations.hub.spotsCount', { count: spots.length })}</Text>
        ) : null}
      </View>
      {!day.data ? (
        <StateView
          align="top"
          busy={day.isPending && !day.isError}
          title={
            day.isPending && !day.isError
              ? t('common.loading')
              : t('operations.hub.spotsUnavailable')
          }
        />
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(s) => s.spot_id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="pb-safe"
          ListEmptyComponent={<StateView align="top" title={t('operations.hub.spotsEmpty')} />}
          renderItem={({ item }) => {
            const selected = item.spot_id === selectedId;
            return (
              <Pressable
                role="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.label}, ${t(`operations.spotStatus.${item.status}`)}`}
                onPress={() => onSelect(item)}
                className={cn(
                  'min-h-12 flex-row items-center gap-3 border-b border-border px-4 active:bg-accent',
                  selected && 'bg-accent',
                )}
              >
                <Text className="w-16 font-semibold">{item.label}</Text>
                <View className="flex-1">
                  <SpotStatusLabel status={item.status} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
