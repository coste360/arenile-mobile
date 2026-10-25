import { CircleCheckIcon, CloudUploadIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useOfflineStatus } from '@/features/offline/offline-provider';

export type QueuedOutcome = 'sent' | 'offline';

/**
 * What to tell the user after queueing an operation: sent at once while
 * the instance answers, saved for later otherwise. A later refusal shows in
 * the pending operations (connection indicator), never silently.
 */
export function useQueuedFeedback(): [QueuedOutcome | null, () => void, () => void] {
  const { connection } = useOfflineStatus();
  const [outcome, setOutcome] = useState<QueuedOutcome | null>(null);
  const report = useCallback(
    () => setOutcome(connection === 'online' || connection === 'syncing' ? 'sent' : 'offline'),
    [connection],
  );
  const clear = useCallback(() => setOutcome(null), []);
  return [outcome, report, clear];
}

export function QueuedNotice({ outcome }: { outcome: QueuedOutcome | null }) {
  const { t } = useTranslation();
  if (!outcome) return null;
  return (
    <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite" accessible>
      <Icon
        as={outcome === 'sent' ? CircleCheckIcon : CloudUploadIcon}
        size={16}
        className={outcome === 'sent' ? 'text-success' : 'text-muted-foreground'}
      />
      <Text variant="muted" className="flex-1">
        {t(`operations.queued.${outcome}`)}
      </Text>
    </View>
  );
}
