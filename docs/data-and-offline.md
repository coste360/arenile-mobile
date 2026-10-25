# Data and offline: the APIs features build on

Developer guide to the data layer of phase 1 (decisions in [ADR 0007](adr/0007-offline-cache-e-coda-delle-operazioni.md)).
Every feature screen (Oggi, map, bookings, check-in, cash) uses these building blocks instead of
writing its own fetching, caching or permission logic.

## Query layer

- **Keys** — `src/api/query-keys.ts`. Establishment data lives under
  `['est', establishmentId, area, kind, params?]`; areas: `operations`, `bookings`, `maps`,
  `season-passes`, `payments`. Invalidate a whole area with `estKeys.area(id, area)`. Add new keys
  there, never inline arrays in a screen. Device/instance/session keys stay in
  `features/session/queries.ts`.
- **Resources** — one module per area, each exporting the fetcher, the query options and the hook:
  - `features/operations/queries.ts`: `useOperationsDay(date, slot?)`, `operationsDayQuery`,
    `useOperationalDays()` → `{ today, tomorrow, timeZone }` in the establishment zone (rolls over
    at its midnight, works offline from the cached establishment);
  - `features/bookings/queries.ts`: `useBookingsOfDay(date)` (every page), `useBooking(id)`;
  - `features/maps/queries.ts`: `useMaps()` (display order), `useMapDocument(mapId)`;
  - `features/auth/queries.ts`: `useMe()` (memberships and permissions of the pairing user).
- **Types** — only from `src/api/types.ts` (aliases of the generated contract).
- **Dates** — `src/lib/calendar.ts`: `todayIn(zone, now)`, `addDays`, `daysBetween`,
  `operationalDays`, `stayIncludes`, `formatDayLabel`. Never `new Date()` in logic: use
  `useDependencies().clock`.
- **Money** — `src/lib/money.ts`: amounts are integer cents (`Cents`); `formatCents(cents)` → "12,50 €"
  (Italian by default) only at display time; `parseCents("12,50")` → `1250` for inputs, no floats.

## Permissions

`features/permissions`: `useAbilities()` returns what the paired user may do (`canCheckIn`,
`canReleaseDay`, `canBlockSpot`, `canAddNote`, `canCollectCash`, `canWriteBookings`,
`canSeeTakings`, `canViewBookings`, `has(permission)`, `known`). It mirrors the core matrix
(`internal/domain/auth/roles.go`, spec 16.1): the permissions reported by `/auth/me` win, the matrix
on the device role is the offline fallback, nothing is offered while unknown. **Hide** what the role
cannot do; when the server refuses anyway, `isForbidden(error)` (`src/api/errors.ts`) → show
"non consentito" (`offline.errors.forbidden`).

## Offline cache

Nothing to do in a feature: queries under the allowlisted keys (see `features/offline/persist.ts`)
are saved and restored automatically, and the runtime warms up today's and tomorrow's data while
online (`features/offline/prefetch.ts`). A new resource that must be readable offline needs its key
added to `isPersistable` (with a test in `persist.test.ts`) and, if it must be warm, to the prefetch.
Screens show cached data when a query has `data`, even if it also has an error (offline or
unreachable).

## Operation queue

Low-risk operations go through the queue **whether online or not** (online they are sent at once):

```ts
const enqueue = useEnqueueOperation();
await enqueue({
  kind: 'check_in',
  bookingId,
  ifMatch: `"${booking.version}"`,
  label: `${spot} · ${code}`,
});
await enqueue({ kind: 'cash_payment', bookingId, amount: cents, label });
await enqueue({ kind: 'note', bookingId, text, label });
await enqueue({ kind: 'day_release', bookingId: passBookingId, date, slots, label });
```

- `label` is what the pending list shows: spot label and booking code, never contact details.
- The queue adds the id, the `Idempotency-Key` (stable across replays), order, status and the
  pairing scope; it applies the change optimistically to the cached day and lists.
- Results are not returned to the caller: refused operations appear in the pending list and in the
  indicator counts. Use `useOfflineStatus()` for `{ connection, pending, conflicts, failed, paused }`,
  `useOfflineQueue()` for the list and `retry`/`discard`/`flush`.
- Create/move booking are **online-only**: gate them on `useOnlineOnly().available` and render
  `<OnlineOnlyNotice />` (`src/components/online-only-notice.tsx`); never queue them.
- A new queued kind needs: the type in `features/offline/types.ts`, the request in `senders.ts`
  (with `Idempotency-Key`), its optimistic effect in `optimistic.ts`, i18n labels
  (`offline.pending.kinds`), tests; and it must be low-risk per core spec 21.2.

## Connection indicator

`<ConnectionIndicator />` (`src/components/connection-indicator.tsx`) is already in every phone header
and in the tablet navigation pane; it opens `/pending`. New layouts must keep it visible.
