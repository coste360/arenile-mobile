import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { cn } from '@/lib/utils';

/**
 * Scrollable screen body: full width with the 16 pt gutter of the list
 * headers at every width, so every section of the app has the same edges
 * (wide content goes side by side with `Columns`). Safe-area bottom inset
 * included (the native header handles the top).
 */
export function Screen({
  children,
  className,
  topInset = false,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  className?: string;
  /** Pad the top safe area (screens without a native header). */
  topInset?: boolean;
  /** Pull to refresh: shown only when `onRefresh` is given. */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={cn('grow pb-safe', topInset && 'pt-safe')}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      <View className={cn('w-full gap-4 px-4 pb-6 pt-4', className)}>{children}</View>
    </ScrollView>
  );
}
