---
paths:
  - 'src/**/*.{ts,tsx}'
---

- UI = React Native Reusables only (shadcn for React Native, ADR 0004), from `@/components/ui/<name>`;
  no other component library. Missing component: add it with the Reusables CLI (command in
  `src/components/ui/README.md`) and list any local change there. Never
  hand-roll what Reusables has. Never use the native `Alert` (ESLint blocks it): confirmations are
  `AlertDialog`; texts are `Text` from `@/components/ui/text`, inputs `Input`.
- No custom styling: no `StyleSheet`, no `style={…}`, no new stylesheet (the only one is
  `src/global.css`, theme variables). Style with Reusables variants and NativeWind utilities on theme
  tokens (`bg-primary`, `text-muted-foreground`, `border-border`), never raw colours, hex, the default
  Tailwind palette (`bg-red-500`, `text-white`) or arbitrary values (`text-[10px]`, `w-[2px]`). The
  style guard in `npm run lint` (`scripts/style-guard.js`) enforces it; its exemptions are listed in
  the script with their reason. A third-party component without `className` gets
  `cssInterop(Component, { className: 'style' })`, not a style prop.
- Light and dark: check both. Colours change only in `src/global.css` and, for React Navigation,
  `src/lib/theme.ts` (kept equal by `src/lib/theme.test.ts`); they follow the core panel theme.
- Phone and tablet from day one: use `Screen` (`src/components/layout/screen.tsx`) and
  `useDeviceLayout()` (phone = stack, tablet = master/detail split). New screens get a test at both
  widths (`renderApp({ size: 'phone' | 'tablet' })`).
- Accessibility: every control has a role and a label (icon-only buttons need `accessibilityLabel`),
  touch targets at least 44 pt (`size="lg"` buttons, `min-h-11` rows), live regions for status
  messages, dynamic type allowed (never disable font scaling).
- All text through i18next keys (`t('…')`, typed on `src/i18n/locales/it.json`); Italian is the
  source language; add the same key to `en`, `de`, `fr` (a test checks parity and placeholders).
- Server data only through TanStack Query hooks built on the single API client (`useApiClient()`,
  `request()`); forms: react-hook-form + zod, schema next to the form, messages are i18n keys.
- Routes live in `src/app/` (expo-router): every file is a screen, so tests and helpers go elsewhere
  (`src/test/`, `src/features/`). Screens never redirect on session changes by hand: the layouts do.
- Side effects (keychain, clock, fetch, device facts) come from `useDependencies()`; never import
  `expo-secure-store` or call `fetch`/`new Date()` for business logic in components.
