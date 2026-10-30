import { router } from 'expo-router';
import {
  CircleAlertIcon,
  CloudOffIcon,
  RefreshCwIcon,
  WifiIcon,
  WifiOffIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useOfflineStatus } from '@/features/offline/offline-provider';
import type { ConnectionState } from '@/features/offline/types';
import { cn } from '@/lib/utils';

const ICONS: Record<ConnectionState, LucideIcon> = {
  online: WifiIcon,
  unreachable: CloudOffIcon,
  offline: WifiOffIcon,
  syncing: RefreshCwIcon,
};

const TONE: Record<ConnectionState, string> = {
  online: 'text-success',
  unreachable: 'text-destructive',
  offline: 'text-destructive',
  syncing: 'text-primary',
};

/**
 * Always-visible connection state (spec 21.2) with the number of pending
 * operations and of those that need the user's attention. State is told by
 * the icon shape and the text, never by colour alone; the whole indicator
 * is one accessible button that opens the pending operations.
 *
 * - `compact` (phone header): the icon alone while all is well, a short
 *   label when not, and the count when operations wait;
 * - `full` (tablet pane): the label and the counts in words;
 * - `rail` (collapsed tablet pane, 48 pt wide): the icon alone, with a badge
 *   of the operations waiting (destructive when some need attention).
 */
export function ConnectionIndicator({
  variant = 'compact',
}: {
  variant?: 'compact' | 'full' | 'rail';
}) {
  const { t } = useTranslation();
  const { connection, pending, conflicts, failed } = useOfflineStatus();
  const attention = conflicts + failed;
  const label = t(`offline.indicator.${connection}`);
  const parts = [label];
  if (pending > 0) parts.push(t('offline.indicator.pending', { count: pending }));
  if (attention > 0) parts.push(t('offline.indicator.attention', { count: attention }));
  const description = parts.join(', ');
  const quiet = connection === 'online' && pending === 0 && attention === 0;

  return (
    <Pressable
      role="button"
      accessibilityLabel={description}
      accessibilityHint={t('offline.indicator.hint')}
      accessibilityLiveRegion="polite"
      onPress={() => router.push('/pending')}
      hitSlop={8}
      className={cn(
        'min-h-11 flex-row items-center gap-2 rounded-md active:bg-accent',
        variant === 'full' ? 'px-3 py-2' : 'min-w-11 justify-center px-2',
      )}
      testID="connection-indicator"
    >
      <Icon
        as={ICONS[connection]}
        size={variant === 'full' ? 18 : 20}
        className={TONE[connection]}
      />
      {variant === 'rail' ? (
        pending + attention > 0 ? (
          <View
            className={cn(
              'absolute -right-1 -top-1 min-w-5 items-center rounded-full px-1',
              attention > 0 ? 'bg-destructive' : 'bg-secondary',
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                attention > 0 ? 'text-destructive-foreground' : 'text-secondary-foreground',
              )}
            >
              {pending + attention}
            </Text>
          </View>
        ) : null
      ) : variant === 'full' ? (
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-medium">{label}</Text>
          {pending > 0 ? (
            <Text variant="muted">{t('offline.indicator.pending', { count: pending })}</Text>
          ) : null}
          {attention > 0 ? (
            <Text className="text-sm text-destructive">
              {t('offline.indicator.attention', { count: attention })}
            </Text>
          ) : null}
        </View>
      ) : quiet ? null : (
        <>
          {connection !== 'online' ? (
            <Text className="text-sm font-medium">
              {t(`offline.indicator.short.${connection}`)}
            </Text>
          ) : null}
          {pending > 0 ? <CountPill count={pending} /> : null}
          {attention > 0 ? (
            <View className="flex-row items-center gap-0.5">
              <Icon as={CircleAlertIcon} size={16} className="text-destructive" />
              <Text className="text-sm font-semibold text-destructive">{attention}</Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function CountPill({ count }: { count: number }) {
  return (
    <View className="min-w-6 items-center rounded-full bg-secondary px-1.5">
      <Text className="text-sm font-semibold text-secondary-foreground">{count}</Text>
    </View>
  );
}
