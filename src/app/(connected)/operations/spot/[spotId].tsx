import { Stack, useLocalSearchParams } from 'expo-router';
import { MapPinOffIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ToSplit, useSplitView } from '@/components/layout/master-detail';
import { Screen } from '@/components/layout/screen';
import { SpotActionsPanel } from '@/components/operations/spot-actions-panel';
import { StateView } from '@/components/state-view';
import { useOperationalDays, useOperationsDay } from '@/features/operations/queries';

/**
 * A spot of today's map with its operations (block / unblock, its booking),
 * on phones; where the split fits it opens the hub with the spot selected.
 */
export default function SpotOperationsScreen() {
  const { spotId } = useLocalSearchParams<{ spotId: string }>();
  const split = useSplitView();
  if (split) return <ToSplit href={{ pathname: '/operations', params: { spot: spotId } }} />;
  return <SpotOperations spotId={spotId} />;
}

function SpotOperations({ spotId }: { spotId: string }) {
  const { t } = useTranslation();
  const { today } = useOperationalDays();
  const day = useOperationsDay(today);
  const spot = day.data?.spots.find((s) => s.spot_id === spotId);

  return (
    <Screen>
      <Stack.Screen
        options={{ title: spot ? t('operations.spot.title', { label: spot.label }) : '' }}
      />
      {spot ? (
        <SpotActionsPanel spot={spot} />
      ) : day.isPending && !day.isError ? (
        <StateView busy title={t('common.loading')} />
      ) : (
        <StateView
          icon={MapPinOffIcon}
          title={t('operations.spot.notFoundTitle')}
          description={t('operations.spot.notFoundDescription')}
        />
      )}
    </Screen>
  );
}
