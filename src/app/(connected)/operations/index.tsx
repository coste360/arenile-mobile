import { router } from 'expo-router';
import { ChevronRightIcon, ScanQrCodeIcon, SearchIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { Screen } from '@/components/layout/screen';
import { CodeLookupView } from '@/components/operations/code-result';
import { SpotStatusLabel } from '@/components/operations/spot-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCodeLookup } from '@/features/check-in/hooks';
import { parseTyped } from '@/features/check-in/scan-code';
import { matchSpots, SPOT_RESULTS_MAX } from '@/features/spot-blocks/spot-search';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';
import { useAbilities } from '@/features/permissions/use-abilities';
import { cn } from '@/lib/utils';

/**
 * Operations hub (spec 02 "Operazioni"): check-in by scanning or typing a
 * code, and today's spots for the spot operations (block, pass release).
 * Phones stack the sections; tablets put them side by side.
 */
export default function OperationsScreen() {
  const { t } = useTranslation();
  const layout = useDeviceLayout();
  const abilities = useAbilities();
  const showSpots = abilities.canBlockSpot || abilities.canViewBookings;

  return (
    <Screen className={layout === 'tablet' ? 'max-w-5xl' : undefined}>
      <Text className="text-muted-foreground">{t('operations.hub.description')}</Text>
      <View className={cn('gap-4', layout === 'tablet' && 'flex-row items-start gap-6')}>
        <View className={cn('gap-4', layout === 'tablet' && 'flex-1')}>
          {abilities.canViewBookings ? <CheckInCard /> : null}
        </View>
        {showSpots ? (
          <View className={cn('gap-4', layout === 'tablet' && 'flex-1')}>
            <SpotsCard />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function CheckInCard() {
  const { t } = useTranslation();
  const { state, lookup, reset } = useCodeLookup();
  const [code, setCode] = useState('');
  const [missing, setMissing] = useState(false);

  const search = () => {
    if (!code.trim()) {
      setMissing(true);
      return;
    }
    setMissing(false);
    void lookup(parseTyped(code), { manual: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('operations.hub.checkInTitle')}</CardTitle>
        <CardDescription>{t('operations.hub.scanHint')}</CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
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
                if (state.status !== 'idle') reset();
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
        <CodeLookupView state={state} />
      </CardContent>
    </Card>
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
