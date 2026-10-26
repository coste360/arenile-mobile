import { Children, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useContentWidth } from '@/components/layout/nav-pane';
import { GUTTER } from '@/components/layout/panes';

import { figureRows } from './figure-rows';

/**
 * The figure cards of "Oggi" in full rows (figure-rows.ts): measured on
 * layout, estimated from the content width (window minus the navigation
 * pane and the gutters of `Screen`) until then.
 */
export function FigureGrid({ children }: { children: ReactNode }) {
  const window = useWindowDimensions();
  const content = useContentWidth();
  const [measured, setMeasured] = useState<number | null>(null);
  const cards = Children.toArray(children);
  // Larger text needs wider cards: the room is counted in unscaled points.
  const width = (measured ?? content - GUTTER * 2) / Math.max(1, window.fontScale);
  const rows = figureRows(cards.length, width);
  const starts = rows.map((_, i) => rows.slice(0, i).reduce((sum, n) => sum + n, 0));
  return (
    <View
      className="gap-3"
      testID="figure-grid"
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
    >
      {rows.map((size, row) => {
        const start = starts[row] ?? 0;
        return (
          <View key={row} className="flex-row gap-3" testID={`figure-row-${size}`}>
            {cards.slice(start, start + size)}
          </View>
        );
      })}
    </View>
  );
}
