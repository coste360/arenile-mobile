# pinned-fetch

Local Expo module (Expo Modules API) of the Arenile staff app: the HTTPS transport for the desktop
edition in **LAN mode**, whose server uses a self-signed certificate (ADR 0006). It accepts the server
**only** when the SHA-256 of the leaf certificate (DER) equals the fingerprint saved at pairing,
compared in constant time. It never changes TLS validation for anything else: instances with a public
certificate keep using the platform `fetch`.

| Layer   | File                                | What it does                                                                                          |
| ------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| JS      | `src/pinned-fetch.ts`               | `(Request, fingerprint) → Response` on top of the native module; AbortSignal → native cancel          |
| JS      | `src/fingerprint.ts`                | validation and canonical form (`AA:BB:…`, as the core's `desktop.Fingerprint`)                        |
| iOS     | `ios/PinnedSessionDelegate.swift`   | `URLSession` delegate: `.useCredential` only for the paired host/port and the pinned leaf certificate |
| iOS     | `ios/PinnedSessionRegistry.swift`   | one ephemeral session per host (no cookies, cache or credential storage), no redirects, cancellation  |
| Android | `android/.../PinnedTrustManager.kt` | `X509TrustManager` that trusts exactly the pinned leaf certificate                                    |
| Android | `android/.../PinnedClients.kt`      | dedicated `OkHttpClient` per host (hostname limited to the paired host, no cookies, no redirects)     |

The app reaches it only through `selectTransport()` in `src/api/transport.ts`. In Expo Go and on the web
the native module is missing: `nativePinnedFetch` is `null` and the app refuses LAN instances with a
clear message.

## Tests

- JavaScript (in `make test`): `src/*.test.ts`, with a mocked native module.
- Swift, on any Mac with the Command Line Tools (no Xcode needed):
  `swift test --package-path modules/pinned-fetch/ios/Tests` (fingerprint parsing, SHA-256 of a real
  certificate, constant-time comparison).
- Kotlin (JUnit, needs a JDK and the Android SDK, e.g. in a prebuilt project):
  `./gradlew :pinned-fetch:testDebugUnitTest` from `android/` after `npx expo prebuild`.
- On devices: development build (EAS Build) against the desktop app in LAN mode, with the right
  fingerprint, a wrong one and a renewed certificate (ADR 0006).
