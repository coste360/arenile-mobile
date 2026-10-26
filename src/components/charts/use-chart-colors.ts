import { useColorScheme } from 'nativewind';

import { THEME } from '@/lib/theme';

/**
 * Theme colours for react-native-svg props (charts of the reports and of
 * "Oggi"): SVG props cannot read the CSS variables, so they come from
 * src/lib/theme.ts, kept equal to src/global.css by its test. Never raw
 * colours in a chart.
 */
export function useChartColors() {
  const { colorScheme } = useColorScheme();
  return THEME[colorScheme === 'dark' ? 'dark' : 'light'];
}

/**
 * Opacity of the previous year's bars: the current year's colour, lighter
 * (legend `bg-primary/60`); 0.6 keeps the bars above 3:1 on the card.
 */
export const PREVIOUS_OPACITY = 0.6;
