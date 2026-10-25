import { router, useLocalSearchParams } from 'expo-router';
import { CloudOffIcon, LockIcon, MousePointerClickIcon } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import type { WaitlistEntry } from '@/api/types';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { StateView } from '@/components/state-view';
import { WaitlistEntryView } from '@/components/waitlist/waitlist-entry';
import { WaitlistList } from '@/components/waitlist/waitlist-list';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import { canViewWaitlist, freedSpotOf } from '@/features/waitlist/waitlist';

/**
 * "Lista d'attesa" (spec 03). Phone: the list, a row opens the entry.
 * Tablet: list and entry side by side, the selection in `selected`. Opened
 * from the map with `spotId`, `zoneId`, `label` and `date`, it offers that
 * freed spot to the compatible requests. Online only.
 */
export default function WaitlistScreen() {
  const { t } = useTranslation();
  const layout = useDeviceLayout();
  const abilities = useAbilities();
  const { available: online } = useOnlineOnly();
  const params = useLocalSearchParams<{
    selected?: string;
    spotId?: string;
    zoneId?: string;
    label?: string;
    date?: string;
  }>();
  const { spotId, zoneId, label, date } = params;
  const spot = useMemo(
    () => freedSpotOf({ spotId, zoneId, label, date }),
    [spotId, zoneId, label, date],
  );
  const selected = typeof params.selected === 'string' ? params.selected : undefined;
  const tablet = layout === 'tablet';

  const onSelect = useCallback(
    (e: WaitlistEntry) => {
      if (tablet) router.setParams({ selected: e.id });
      else
        router.push({
          pathname: '/waitlist/[entryId]',
          params: {
            entryId: e.id,
            ...(spot
              ? { spotId: spot.spotId, zoneId: spot.zoneId, label: spot.label, date: spot.date }
              : {}),
          },
        });
    },
    [tablet, spot],
  );

  if (abilities.known && !canViewWaitlist(abilities)) {
    return <StateView icon={LockIcon} title={t('offline.errors.forbidden')} />;
  }
  if (!online) {
    return (
      <StateView
        icon={CloudOffIcon}
        title={t('waitlist.offlineTitle')}
        description={t('waitlist.onlineOnly')}
      />
    );
  }
  if (!tablet) return <WaitlistList spot={spot} onSelect={onSelect} />;

  return (
    <View className="flex-1 flex-row bg-background">
      <View className="w-80 border-r border-border xl:w-96">
        <WaitlistList spot={spot} selectedId={selected} onSelect={onSelect} />
      </View>
      <View className="flex-1" role="region" accessibilityLabel={t('nav.waitlistEntry')}>
        {selected ? (
          <ScrollView className="flex-1" contentContainerClassName="gap-4 px-8 py-8 pb-safe">
            <View className="w-full max-w-2xl gap-4 self-center">
              <WaitlistEntryView key={selected} entryId={selected} spot={spot} />
            </View>
          </ScrollView>
        ) : (
          <StateView
            icon={MousePointerClickIcon}
            title={t('waitlist.selectTitle')}
            description={t('waitlist.selectDescription')}
          />
        )}
      </View>
    </View>
  );
}
