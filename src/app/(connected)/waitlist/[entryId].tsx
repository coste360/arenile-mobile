import { useLocalSearchParams } from 'expo-router';
import { CloudOffIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { ToSplit, useSplitView } from '@/components/layout/master-detail';
import { StateView } from '@/components/state-view';
import { WaitlistEntryView } from '@/components/waitlist/waitlist-entry';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { freedSpotOf } from '@/features/waitlist/waitlist';

/** A waitlist entry on phones; where the split fits it opens the split with it selected. */
export default function WaitlistEntryScreen() {
  const { t } = useTranslation();
  const split = useSplitView();
  const { available: online } = useOnlineOnly();
  const params = useLocalSearchParams<{
    entryId: string;
    spotId?: string;
    zoneId?: string;
    label?: string;
    date?: string;
  }>();

  const spot = freedSpotOf(params);

  if (split) {
    // The freed spot the entry was opened for stays with it.
    const { entryId, spotId, zoneId, label, date } = params;
    const context = spot ? { spotId, zoneId, label, date } : {};
    return <ToSplit href={{ pathname: '/waitlist', params: { ...context, selected: entryId } }} />;
  }
  return (
    <Screen>
      {online ? (
        <WaitlistEntryView entryId={params.entryId} spot={spot} />
      ) : (
        <StateView
          icon={CloudOffIcon}
          title={t('waitlist.offlineTitle')}
          description={t('waitlist.onlineOnly')}
        />
      )}
    </Screen>
  );
}
