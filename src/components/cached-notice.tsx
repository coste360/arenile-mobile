import { CloudOffIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useEstablishment } from '@/features/session/queries';
import { formatTime } from '@/lib/datetime';

/**
 * True when a query shows data saved on the device rather than a fresh
 * answer: the last refresh failed, or it waits for the network.
 */
export function servedFromCache(q: { data: unknown; isError: boolean; isPaused: boolean }) {
  return q.data !== undefined && (q.isError || q.isPaused);
}

/**
 * Says that the screen shows data saved on the device (the instance did not
 * answer, or there is no network) and when it was last updated. Renders nothing
 * while the data is fresh.
 */
export function CachedNotice({ stale, updatedAt }: { stale: boolean; updatedAt: number }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const timeZone = useEstablishment().data?.timezone;
  if (!stale || !updatedAt) return null;
  return (
    <View
      className="flex-row items-center gap-2 rounded-md border border-border bg-muted px-3 py-2"
      accessible
      accessibilityLiveRegion="polite"
    >
      <Icon as={CloudOffIcon} size={16} className="text-muted-foreground" />
      <Text variant="muted" className="flex-1">
        {t('today.cachedAt', { time: formatTime(updatedAt, locale, timeZone) })}
      </Text>
    </View>
  );
}
