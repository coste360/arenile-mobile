import type { LucideIcon } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** Extra text for screen readers (e.g. the full date). */
  hint?: string;
  /** Shown instead of the label (which stays the accessible name). */
  icon?: LucideIcon;
  /** What pressing it does, when that is more than selecting it (e.g. opens a calendar). */
  actionHint?: string;
}

/**
 * Mutually exclusive buttons (radio group): day, slot, view, map. `segmented`
 * draws them joined in one compact control, the selected one filled.
 */
export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
  scroll = false,
  segmented = false,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
  segmented?: boolean;
}) {
  const buttons = choices.map((c) => {
    const selected = c.value === value;
    return (
      <Button
        key={c.value}
        size="sm"
        variant={selected ? 'default' : segmented ? 'ghost' : 'outline'}
        className={cn('min-h-11', c.icon ? 'w-11 px-0' : 'px-3')}
        role="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={c.hint ? `${c.label}, ${c.hint}` : c.label}
        accessibilityHint={c.actionHint}
        onPress={() => onChange(c.value)}
      >
        {c.icon ? (
          <Icon
            as={c.icon}
            size={18}
            className={selected ? 'text-primary-foreground' : 'text-foreground'}
          />
        ) : (
          <Text>{c.label}</Text>
        )}
      </Button>
    );
  });
  if (segmented) {
    return (
      <View
        role="radiogroup"
        accessibilityLabel={label}
        className="flex-row self-start rounded-md border border-border bg-muted"
      >
        {buttons}
      </View>
    );
  }
  return (
    <View role="radiogroup" accessibilityLabel={label}>
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {buttons}
        </ScrollView>
      ) : (
        <View className="flex-row flex-wrap gap-2">{buttons}</View>
      )}
    </View>
  );
}
