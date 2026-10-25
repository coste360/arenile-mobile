// Tailwind 3 configuration for NativeWind v4 (ADR 0004). Every colour is a
// theme token defined in src/global.css; do not add raw colours here.
const { hairlineWidth } = require('nativewind/theme');

/** @param {string} name */
const token = (name) => `hsl(var(--${name}))`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
          'on-surface': token('primary-on-surface'),
        },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        highlight: { DEFAULT: token('highlight'), foreground: token('highlight-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        success: token('success'),
        warning: token('warning'),
        // Day map (ADR 0008): status colours of the operational map, always paired
        // with a label and a glyph; map surfaces.
        status: Object.fromEntries(
          [
            'free',
            'booked-online',
            'booked-desk',
            'season',
            'season-released',
            'hold',
            'to-collect',
            'present',
            'blocked',
            'renewal-hold',
            'unavailable',
          ].map((s) => [
            s,
            { DEFAULT: token(`status-${s}`), foreground: token(`status-${s}-foreground`) },
          ]),
        ),
        map: {
          sand: token('map-sand'),
          sea: token('map-sea'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require('tailwindcss-animate')],
};
