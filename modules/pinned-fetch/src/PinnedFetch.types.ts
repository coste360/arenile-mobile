// Contract between the JavaScript adapter and the native module (Swift and
// Kotlin implement exactly this shape).

/** One HTTP request, already serialised by the adapter. */
export interface NativePinnedRequest {
  /** Absolute https URL; its host and port are the only ones the request may reach. */
  url: string;
  method: string;
  headers: Record<string, string>;
  /** UTF-8 text body, or null. The API sends JSON only. */
  body: string | null;
  /** Expected SHA-256 of the leaf certificate (canonical `AA:BB:…` form). */
  fingerprint: string;
  /** Native safety timeout; the API client aborts earlier with its own timer. */
  timeoutMs: number;
}

export interface NativePinnedResponse {
  status: number;
  statusText: string;
  /** Lower-case header names; repeated headers joined with ", ". */
  headers: Record<string, string>;
  /** Body decoded as UTF-8 (the API answers JSON or problem+json). */
  body: string;
  url: string;
}

/** Codes of the native rejections (`error.code`). */
export const NATIVE_ERROR_CODES = {
  certificateMismatch: 'ERR_PINNED_CERTIFICATE_MISMATCH',
  invalidRequest: 'ERR_PINNED_INVALID_REQUEST',
  cancelled: 'ERR_PINNED_CANCELLED',
  network: 'ERR_PINNED_NETWORK',
} as const;

export interface PinnedFetchNativeModule {
  /** Runs one request; `id` lets cancel() abort it. Rejects with one of NATIVE_ERROR_CODES. */
  fetch(id: string, request: NativePinnedRequest): Promise<NativePinnedResponse>;
  /** Cancels a running request (no-op when it already finished). */
  cancel(id: string): Promise<void>;
}
