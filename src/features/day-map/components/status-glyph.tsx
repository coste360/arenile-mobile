import { useColorScheme } from 'nativewind';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { GLYPH_PATHS, glyphStrokeWidth, STATUS_GLYPHS } from '../glyphs';
import { MAP_PALETTE } from '../palette';
import type { SpotStatus } from '../status';

/** Colour scheme of the map palette (NativeWind follows the user's preference). */
export function useMapPalette() {
  const { colorScheme } = useColorScheme();
  return MAP_PALETTE[colorScheme === 'dark' ? 'dark' : 'light'];
}

/**
 * Swatch of a status as on the map: the status colour with its glyph, so the
 * legend, the list and the sheet match the map. Decorative: the label next
 * to it carries the meaning for screen readers.
 */
export function StatusGlyph({ status, size = 20 }: { status: SpotStatus; size?: number }) {
  const palette = useMapPalette();
  const colours = palette.status[status];
  const glyph = STATUS_GLYPHS[status];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={12} cy={12} r={11} fill={colours.fill} />
      {glyph ? (
        <G>
          <Path
            d={GLYPH_PATHS[glyph]}
            stroke={colours.foreground}
            strokeWidth={glyphStrokeWidth(glyph)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={glyph === 'star' ? colours.foreground : 'none'}
          />
        </G>
      ) : null}
    </Svg>
  );
}
