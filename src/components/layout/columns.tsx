import { Children, type ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

import { useContentWidth } from './nav-pane';
import { columnsFor } from './panes';

/**
 * Cards side by side when each keeps at least MIN_COLUMN (tablets), stacked
 * otherwise (phones, narrow Split View). A card with `grow` fills the height
 * of its row.
 */
export function Columns({ children, className }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children);
  const content = useContentWidth();
  const columns = columnsFor(content, items.length);
  if (columns === 1) return <View className={cn('gap-4', className)}>{items}</View>;
  return (
    <View className={cn('flex-row gap-4', className)}>
      {items.map((item, i) => (
        <View key={i} className="flex-1">
          {item}
        </View>
      ))}
    </View>
  );
}
