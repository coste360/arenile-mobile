// Concrete colours for React Navigation (headers, backgrounds of native
// screens), which cannot read the CSS variables of src/global.css. Same
// values, HSL triplets included verbatim; src/lib/theme.test.ts fails when
// they drift. The only file allowed raw colours (scripts/style-guard.js).
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

export const THEME = {
  light: {
    background: 'hsl(210 40% 98%)',
    foreground: 'hsl(222.2 47.4% 11.2%)',
    card: 'hsl(0 0% 100%)',
    primary: 'hsl(211.6 71.4% 15.1%)',
    border: 'hsl(214.1 22.1% 86.5%)',
    destructive: 'hsl(0 73.7% 41.8%)',
  },
  dark: {
    background: 'hsl(211.6 73.1% 10.2%)',
    foreground: 'hsl(210 40% 98%)',
    card: 'hsl(211.6 71.4% 15.1%)',
    primary: 'hsl(198.4 93.2% 59.6%)',
    border: 'hsl(211.6 35% 19.2%)',
    destructive: 'hsl(0 95.1% 76.1%)',
  },
} as const;

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
