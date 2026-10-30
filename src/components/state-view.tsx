import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * State (progress, error, empty) with a title, a description and actions.
 * `center` for a whole empty screen; `top` under a header (lists, panes), so
 * every list puts its state in the same place. Announced to screen readers
 * as a live region.
 */
export function StateView({
  icon,
  busy = false,
  tone = 'default',
  align = 'center',
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  busy?: boolean;
  tone?: 'default' | 'destructive';
  align?: 'center' | 'top';
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <View
      className={cn(
        'flex-1 items-center gap-4 px-6',
        align === 'top' ? 'justify-start pb-8 pt-12' : 'justify-center py-8',
      )}
      accessibilityLiveRegion="polite"
    >
      {busy ? (
        <ActivityIndicator size="large" className="text-primary" accessibilityElementsHidden />
      ) : icon ? (
        <Icon
          as={icon}
          size={48}
          className={cn(tone === 'destructive' ? 'text-destructive' : 'text-primary')}
        />
      ) : null}
      <Text variant="h3" className="text-center" role="heading">
        {title}
      </Text>
      {description ? (
        <Text className="max-w-md text-center text-muted-foreground">{description}</Text>
      ) : null}
      {children ? <View className="mt-2 w-full max-w-sm gap-3">{children}</View> : null}
    </View>
  );
}
