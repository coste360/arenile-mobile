import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { cn } from '@/lib/utils';

import { useDeviceLayout } from './use-device-layout';

/**
 * Scrollable screen body: full width on phones, a centred readable column
 * on tablets. Safe-area bottom inset included (the native header handles the top).
 */
export function Screen({
  children,
  className,
  topInset = false,
}: {
  children: ReactNode;
  className?: string;
  /** Pad the top safe area (screens without a native header). */
  topInset?: boolean;
}) {
  const layout = useDeviceLayout();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={cn('grow pb-safe', topInset && 'pt-safe')}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View
        className={cn(
          'w-full gap-4 px-4 py-6',
          layout === 'tablet' && 'max-w-2xl self-center px-8 py-10',
          className,
        )}
      >
        {children}
      </View>
    </ScrollView>
  );
}
