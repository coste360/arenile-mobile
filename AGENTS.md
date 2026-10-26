# AGENTS.md

Arenile mobile is the staff app of [Arenile](https://github.com/coste360/arenile), the source-available
management system for beach establishments (stabilimenti balneari) maintained by Coste360 SRL. One app,
published by Coste360 on the App Store and Google Play, that each establishment pairs with **its own**
Arenile instance (VPS, managed hosting, or the desktop edition in LAN mode): it has no default server (the only exception is "Prova la demo", which pairs with Coste360's
demo instance on an explicit tap, ADR 0015).
Expo + React Native + TypeScript, phone and tablet/iPad. The product plan (Italian) lives in
`docs/spec/`; the authoritative specification is the core's `docs/spec/` (section 29.2 for the app,
16 for roles, 21.2 for offline). Decisions are in `docs/adr/`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed.
Before writing code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently SDK 58).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v58.0.0/` (append `.md` to a
   page for Markdown).
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections
   to common LLM misconceptions. Follow its links; never answer from memory.

The same applies to NativeWind (v4, Tailwind 3) and React Native Reusables: check their current docs.

## Commands (always use make)

- `make setup` once, `make dev` to run Metro (development build or Expo Go)
- `make check` after every change (must pass before you say you are done; < 2 min)
- `make check-full` before opening a pull request (adds `expo-doctor` and the iOS/Android bundle export)
- `make gen` after changing the pinned core release; `make api-bump VERSION=vX.Y.Z` to pin a new one
- `make fmt` formats with Prettier; in Claude Code a hook does it
- Focused runs: `make lint` (ESLint, style guard, Prettier check, `tsc --noEmit`), `make test` (Jest),
  `npx jest <path>`
- Add packages only with `npx expo install <package>` (SDK-compatible versions), never `npm install <pkg>`.
- No Xcode or Android SDK is needed: native builds go through EAS Build (see README).

## Map of the repository

- `src/app/` expo-router routes (every file is a screen; no tests or helpers here):
  `connect` (welcome / "Collega"), `scan` (camera), `manual` (address + code), `pair` (pairing and
  its errors, also the target of `arenile://pair?d=…`), `(connected)/` (home, settings, pending
  operations, day map, `today` ("Oggi"), `bookings/` (day list; tablet list + sheet), `bookings/[bookingId]`
  (sheet on phones), `spots` (free / released spots), `operations/` hub, QR scanner, booking and spot
  operations, phase 2 `sale` (daily quick sale), `move/[bookingId]`, `waitlist/` (list; tablet list +
  entry), `waitlist/[entryId]`; phone stack or tablet master/detail)
- `src/api/` the single API client (`client.ts`), transport selection (`transport.ts`), typed errors
  (`errors.ts`), contract type aliases (`types.ts`), TanStack Query keys (`query-keys.ts`);
  `src/api/generated/` generated types
- `src/features/<area>` logic per area: `pairing` (QR decoder, target normalisation, pairing flow,
  manual form schema, in-memory pairing intent), `session` (session store, provider, queries), `instance` (compatibility),
  `preferences` (language, theme), `operations` / `bookings` / `maps` / `auth` (resource hooks of
  phase 1; `bookings/day-list` filters, search and sort, `bookings/detail` sheet rules and customer
  visibility by role, `operations/day-spots` free and released spots), `permissions` (role rules of the panel, `useAbilities`), `offline` (persisted cache,
  operation queue, runtime and hooks), `day-map` (operational map of the day: status, search,
  camera, SVG renderer, spot sheet, `kit/` illustrations of the map kits; ADR 0008, 0013), `check-in` (booking/ticket QR formats, code resolution, gate
  admission), `booking-actions` (booking facts, operation rules, form schemas, queued actions, cash
  desk state), `spot-blocks` (online-only blocks, spot search), `reports` (year comparison, periods,
  formats; phase 3), `widget` (home screen widget snapshot, bridge, `WidgetSync`), phase 2 (ADR 0011):
  `daily-sale` (sale rules, catalogue, quote, sale), `move-booking` (move rules, dry run, booking or
  ticket move), `waitlist` (list, compatibility, offer), `printing` (print route, jobs), `tickets`
  (ticket of a booking). No push notifications in this edition (ADR 0012): data refreshes when the app
  is opened or foregrounded. **Read `docs/data-and-offline.md` before adding a feature.**
- `src/widgets/` home screen widget layouts for expo-widgets (`'widget'` directive: isolated runtime,
  only Expo UI components, data only through props; ADR 0010)
- `src/components/ui/` React Native Reusables components (vendored by their CLI);
  `src/components/` app components (`Screen`, `StateView`, `FormField`, layout helpers,
  `ConnectionIndicator`, `OnlineOnlyNotice`, `FilterChip`, `CachedNotice`); `bookings/` (list, row,
  badges, sheet), `today/` (figure card and grid, slot occupancy, home shortcuts) and `operations/` (the
  embeddable operation panels `BookingActionsPanel`, `SpotActionsPanel`, `CodeResult` and their forms),
  `reports/` (metric cards, week chart) and `charts/` (`useChartColors`: theme colours for
  react-native-svg props, from `src/lib/theme.ts`)
- `src/providers/` composition root (`app-providers.tsx`), injected dependencies, query client
- `src/i18n/` i18next setup and locales (`it` source, `en`, `de`, `fr`)
- `modules/pinned-fetch/` local Expo module (Swift, Kotlin, JS adapter): the certificate-pinning
  transport for desktop LAN instances (ADR 0006); its JS tests run in `make test`
- `src/lib/` shared primitives (version compare, base64url, storage, offline storage, network,
  clock, calendar dates, instants in the establishment zone, localised API texts, money in cents,
  navigation theme, `cn`)
- `src/test/` test helpers (`fake-fetch.ts`, `fixtures.ts`, `operations-fixtures.ts`, `day-routes.ts`,
  `ids.ts`, `render-app.tsx`) and screen tests
- `src/global.css` the only stylesheet (theme tokens); `tailwind.config.js` maps them
- `api/core-version.json` pinned core release + SHA-256; `api/openapi.yaml` its contract (verbatim)
- `scripts/` `gen-api.mjs` (contract download/verify/generate), `gen-map-kits.mjs` (map kits), `style-guard.js`, `agents/` hooks
- `assets/brand/` official Arenile brand assets (not covered by the code licence, see NOTICE.md)
- `assets/map-kits/` beach map kits of the pinned core release, verbatim, with `kits.lock.json`
  (SHA-256) and each kit's `NOTICE.md` (© Coste360, BSL 1.1; ADR 0013)
- `native-locales/` localized native strings (app name, permission prompts)
- `docs/spec/` functional plan of the app, `docs/adr/` decisions, `docs/data-and-offline.md` the
  data, permission and offline APIs features build on

## Generated code (never edit by hand)

- `src/api/generated/schema.d.ts` from `api/openapi.yaml` via openapi-typescript (`make gen`)
- `api/openapi.yaml` is the verbatim `openapi.yaml` asset of the core release in `api/core-version.json`
- `assets/map-kits/` (verbatim kits of that release) and `src/features/day-map/kit/generated/` (their
  art for react-native-svg) via `scripts/gen-map-kits.mjs` (`make gen`)
- `ios/`, `android/` are generated by `expo prebuild` (Continuous Native Generation) and git-ignored
- `make check` fails if the generated code differs from what is committed (`make gen-check`).

## Non-negotiable rules

- The app talks only to the user's instance (the one exception: Coste360's demo instance after an
  explicit "Prova la demo", ADR 0015). No telemetry, no analytics, crash-reporting or ads SDK,
  no `expo-updates`/EAS Update (it would contact Expo servers), no remote config (ADR 0005).
- The app never imports core code. API types come only from the generated contract of a pinned core
  release (ADR 0002); a missing endpoint is a core change first.
- One API client factory (`createApiClient`) and one transport selection (`selectTransport`). Never
  disable or weaken TLS; self-signed desktop LAN instances go only through the pinned transport of
  `modules/pinned-fetch` (exact SHA-256 of the leaf certificate, ADR 0006).
- The device token lives only in the keychain through `SessionStore` (ADR 0003): never logged,
  never in a URL, never shown. A 401 problem+json `unauthorized` is handled only by `SessionProvider`
  (sign-out + explanation). External pairing links need the user's confirmation; a code is single use.
- Never log emails, phone numbers, tokens or secrets.
- UI = React Native Reusables + NativeWind theme tokens only (ADR 0004): no `StyleSheet`, no
  `style={}`, no raw colours, no default Tailwind palette, no arbitrary values, no native `Alert`.
  `npm run lint` (`scripts/style-guard.js` + ESLint) enforces it; exemptions live in the script with
  their reason (the day map's SVG palette and gesture viewport, ADR 0008).
- Phone and tablet/iPad from day one: responsive layout helpers, tests at both widths.
- User-facing strings go through i18n keys; Italian is the source language; `en`, `de`, `fr` kept in
  parity (tested). Native strings (permission prompts) in `native-locales/`.
- Side effects (keychain, clock, fetch, device facts, app version) are injected (`Dependencies`):
  screens and logic never call native modules, `fetch` or `new Date()` directly.
- Pairing rules mirror the core (`internal/domain/device/qr.go`, `internal/desktop/remote/pair.go`):
  QR v1, http only on loopback, Crockford pairing codes, semver compatibility both ways.
- Money is integer cents (`src/lib/money.ts`), formatted only at display time with `Intl`;
  calendar dates are `YYYY-MM-DD` in the establishment timezone (`src/lib/calendar.ts`), instants
  RFC 3339 UTC (as the API).
- Offline (ADR 0007): check-in, day release, note and cash payment go through the operation queue
  (`useEnqueueOperation`, stable `Idempotency-Key`), refusals stay visible until the user decides;
  create/move booking, spot blocks and gate admission are online-only (ADR 0009). Only allowlisted
  queries are persisted; the cache is removed on every sign-out. Hide actions with `useAbilities()`;
  a 403 is "non consentito".
- Phase 2 (ADR 0011): daily sale, move, waitlist offers and ticket printing are online-only, never
  queued, with a stable `Idempotency-Key` per request on creations.
- No push notifications in the public app (ADR 0012): no `expo-notifications`, no APNs/FCM token, no
  notification entitlements or permissions; data refreshes on open/foreground and on reconnect.
- Home screen widget (ADR 0010): it shows only props the app publishes from data already cached
  (counts, never names or amounts) and never fetches; the widget is cleared on sign-out.
- No new runtime dependency without explaining why in the PR; licences must be compatible with both
  BSL 1.1 and AGPL-3.0 (MIT, BSD, Apache-2.0...).
- Code comments and identifiers in English.
- Licence: pending a Coste360 decision (core spec 29.2: BSL 1.1 like the core unless decided
  otherwise). Do not add a `LICENSE` file until Coste360 decides; never call the project "open source" (use "source available").

## Tests

- `make test` runs Jest (jest-expo + Testing Library): unit tests must not need network or devices;
  the global `fetch` throws in tests, inject `fakeFetch()`.
- Pure logic: table-driven `it.each`, test file next to the module; mirror the core's Go cases where
  the logic is shared.
- Screens: `renderApp()` renders the real routes and providers with fake dependencies; await every
  `fireEvent` and `findBy…`; one render per test; phone and tablet where layout matters.
- No end-to-end device tests yet (no simulator in CI); `make export-check` proves both bundles build.

## Definition of done

- `make check` passes; `make check-full` passes before a PR
- New behaviour has tests; bug fixes include a test that fails without the fix
- Docs updated when behaviour, configuration or decisions change (`docs/`, `CHANGELOG.md` entry,
  README for commands); a changed decision needs a new ADR
- The PR description lists what changed, how it was tested and any open question

## Working style

- Keep changes small and scoped to the task; do not refactor unrelated code.
- Read the relevant `docs/spec/` and `docs/adr/` (and the core spec sections) before writing code.
- If the task is ambiguous or conflicts with a rule here, stop and ask in the issue or PR.
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `build:`, `ci:`).
