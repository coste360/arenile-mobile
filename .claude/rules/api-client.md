---
paths:
  - 'src/api/**'
  - 'src/features/**'
  - 'api/**'
  - 'scripts/gen-api.mjs'
---

- The API contract is the `openapi.yaml` asset of a pinned core release (`api/core-version.json`,
  version + SHA-256, ADR 0002). Never edit `api/openapi.yaml` or `src/api/generated/**`; pin another
  release with `make api-bump VERSION=vX.Y.Z`. A missing endpoint is a change in the core repository
  first (API-first there), then a new core release, then a bump here.
- Import API types from `src/api/types.ts` (aliases of the generated schema), never hand-write a
  type that the contract already defines.
- One place builds clients: `createApiClient()` in `src/api/client.ts` (base URL, bearer device
  token, timeout, no cookies); one place picks the transport: `selectTransport()` in
  `src/api/transport.ts`. Self-signed instances (desktop LAN mode, fingerprint in the QR) are refused
  with `LanTransportUnavailableError` until the pinned native transport of ADR 0006 exists. Never
  disable or weaken TLS validation, never add a "trust all certificates" switch.
- Every call goes through `request()`, which maps failures to typed errors (`NetworkError`,
  `UnexpectedResponseError`, `ProblemError` with the stable problem `type` slug, `UnauthorizedError`).
  Branch on types and slugs, never on `title`/`detail` text.
- A 401 problem+json of type `unauthorized` (`UnauthorizedError`) means the device token is revoked
  or expired: `SessionProvider` signs out and the layouts show "Collega" with the reason. Do not
  handle 401 locally. A 401 without the core's problem body (captive portal, proxy) is a plain
  `ProblemError` and never wipes the token.
- Pairing links from outside the app (`arenile://pair?d=…`) always need the user's confirmation of
  the instance address; in-app targets (scanner, manual form) go through `usePairingIntent()`, never
  through route parameters. A pairing code is single use: never send it twice.
- The device token lives only in the keychain (`createSecureKeyValueStore`, AFTER_FIRST_UNLOCK,
  this device only) via `SessionStore`. Never log it, never put it in a URL, never show it.
- Never log emails, phone numbers, tokens or secrets. `console.warn` messages carry no payloads.
- Unit tests never touch the network: inject `fakeFetch()` (`src/test/fake-fetch.ts`); the global
  `fetch` throws in tests.
- Pairing rules mirror the core (`internal/domain/device/qr.go`, `internal/desktop/remote/pair.go`):
  keep the TS decoder and URL/code normalisation in step and mirror new Go test cases.
