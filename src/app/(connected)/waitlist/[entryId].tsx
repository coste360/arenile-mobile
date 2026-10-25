import { Redirect, useLocalSearchParams } from 'expo-router';
import { CloudOffIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { StateView } from '@/components/state-view';
import { WaitlistEntryView } from '@/components/waitlist/waitlist-entry';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { freedSpotOf } from '@/features/waitlist/waitlist';

/** A waitlist entry on phones; on tablets it opens the split with it selected. */
export default function WaitlistEntryScreen() {
  const { t } = useTranslation();
  const layout = useDeviceLayout();
  const { available: online } = useOnlineOnly();
  const params = useLocalSearchParams<{
    entryId: string;
    spotId?: string;
    zoneId?: string;
    label?: string;
    date?: string;
  }>();

  const spot = freedSpotOf(params);

  if (layout === 'tablet') {
    return <Redirect href={{ pathname: '/waitlist', params: { selected: params.entryId } }} />;
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
