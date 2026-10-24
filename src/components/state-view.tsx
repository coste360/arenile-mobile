import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Full-screen state (progress, error, empty) with a title, a description and
 * actions. Announced to screen readers as a live region.
 */
export function StateView({
  icon,
  busy = false,
  tone = 'default',
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  busy?: boolean;
  tone?: 'default' | 'destructive';
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <View
      className="flex-1 items-center justify-center gap-4 py-8"
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
        <Text className="text-center text-muted-foreground">{description}</Text>
      ) : null}
      {children ? <View className="mt-2 w-full max-w-sm gap-3">{children}</View> : null}
    </View>
  );
}
