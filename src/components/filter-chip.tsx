import { CheckIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * One choice of a filter row. The selected chip is filled and shows a check
 * mark (never colour alone) and is announced as selected.
 */
export function FilterChip({
  label,
  count,
  accessibilityLabel,
  selected,
  onPress,
}: {
  label: string;
  /** Optional figure shown next to the label. */
  count?: number;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      className={cn(
        'min-h-11 flex-row items-center gap-1.5 rounded-full border px-3',
        selected ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent',
      )}
    >
      {selected ? <Icon as={CheckIcon} size={14} className="text-primary-foreground" /> : null}
      <Text
        className={cn(
          'text-sm font-medium',
          selected ? 'text-primary-foreground' : 'text-foreground',
        )}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          className={cn('text-sm', selected ? 'text-primary-foreground' : 'text-muted-foreground')}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * A labelled row of chips; scrolls sideways when it does not fit. `bleed`
 * (list headers, whose parent pads `px-4`) lets the scroll reach the pane
 * edges with the first chip still on the 16 pt gutter.
 */
export function ChipRow({
  label,
  children,
  scroll = true,
  bleed = false,
}: {
  label: string;
  children: ReactNode;
  scroll?: boolean;
  bleed?: boolean;
}) {
  const content = <View className="flex-row flex-wrap gap-2">{children}</View>;
  return (
    <View className="gap-1.5" accessibilityLabel={label} role="group">
      <Text variant="muted">{label}</Text>
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className={bleed ? '-mx-4' : undefined}
          contentContainerClassName={bleed ? 'gap-2 px-4' : 'gap-2 pr-4'}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}
