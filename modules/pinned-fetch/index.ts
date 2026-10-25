// Local Expo module (ADR 0006): HTTPS transport that accepts the desktop LAN
// server only when the SHA-256 of its leaf certificate matches the
// fingerprint saved at pairing. TLS validation is never relaxed for anything
// else: instances with a public certificate keep using the platform fetch.
import { createPinnedFetch, type PinnedFetch } from './src/pinned-fetch';
import PinnedFetchModule from './src/PinnedFetchModule';

export { normalizeFingerprint } from './src/fingerprint';
export {
  createPinnedFetch,
  PinnedFetchError,
  type PinnedFetch,
  type PinnedFetchErrorCode,
} from './src/pinned-fetch';
export type {
  NativePinnedRequest,
  NativePinnedResponse,
  PinnedFetchNativeModule,
} from './src/PinnedFetch.types';
export { NATIVE_ERROR_CODES } from './src/PinnedFetch.types';

/** The pinned fetch of this build, or null when the native module is missing (Expo Go, web). */
export const nativePinnedFetch: PinnedFetch | null = PinnedFetchModule
  ? createPinnedFetch(PinnedFetchModule)
  : null;
