import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/** Label / value pair inside a card, read as one element by screen readers. */
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View
      className="gap-1"
      accessible
      accessibilityLabel={typeof value === 'string' ? `${label}: ${value}` : undefined}
    >
      <Text variant="muted">{label}</Text>
      {typeof value === 'string' ? <Text selectable>{value}</Text> : value}
    </View>
  );
}
