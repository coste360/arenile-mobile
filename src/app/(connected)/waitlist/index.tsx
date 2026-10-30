import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { CloudOffIcon, LockIcon, MousePointerClickIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { WaitlistEntry } from '@/api/types';
import {
  DetailScroll,
  MasterDetail,
  useSplitView,
  type ListState,
} from '@/components/layout/master-detail';
import { StateView } from '@/components/state-view';
import { WaitlistEntryView } from '@/components/waitlist/waitlist-entry';
import { WaitlistList } from '@/components/waitlist/waitlist-list';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import { canViewWaitlist, freedSpotOf } from '@/features/waitlist/waitlist';

/**
 * "Lista d'attesa" (spec 03). Phone: the list, a row opens the entry.
 * Tablet with room for both: list and entry side by side, the selection in `selected`. Opened
 * from the map with `spotId`, `zoneId`, `label` and `date`, it offers that
 * freed spot to the compatible requests. Online only.
 */
export default function WaitlistScreen() {
  const { t } = useTranslation();
  const split = useSplitView();
  const navigation = useNavigation<{ setParams(params: { selected?: string }): void }>();
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
  const [listState, setListState] = useState<ListState>('loading');

  const onSelect = useCallback(
    (e: WaitlistEntry) => {
      if (split) router.setParams({ selected: e.id });
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
    [split, spot],
  );

  // The window got too narrow for the split (rotation, Split View): the open
  // entry goes on as on phones, with the freed spot it was opened for.
  useEffect(() => {
    if (split || !selected) return;
    // On this list's own route: router.setParams would target the screen pushed right after.
    navigation.setParams({ selected: undefined });
    router.push({
      pathname: '/waitlist/[entryId]',
      params: {
        entryId: selected,
        ...(spot
          ? { spotId: spot.spotId, zoneId: spot.zoneId, label: spot.label, date: spot.date }
          : {}),
      },
    });
  }, [split, selected, spot, navigation]);

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
  const list = (
    <WaitlistList
      spot={spot}
      selectedId={split ? selected : undefined}
      onSelect={onSelect}
      onListState={setListState}
    />
  );
  if (!split) return list;

  return (
    <MasterDetail
      list={list}
      listState={listState}
      detailLabel={t('nav.waitlistEntry')}
      detail={
        selected ? (
          <DetailScroll>
            <WaitlistEntryView key={selected} entryId={selected} spot={spot} />
          </DetailScroll>
        ) : null
      }
      placeholder={{
        icon: MousePointerClickIcon,
        title: t('waitlist.selectTitle'),
        description: t('waitlist.selectDescription'),
      }}
    />
  );
}
