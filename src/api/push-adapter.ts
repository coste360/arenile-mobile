// REGENERATE AFTER THE CORE RELEASE ------------------------------------------
// Thin typed adapter for the device push endpoints of core ADR 0027
// (GET/PUT/DELETE /api/device/v1/push, problem type `push_unavailable`).
// They are NOT in the pinned core contract (api/core-version.json, v1.0.1):
// the types below are copied by hand from the core's api/openapi.yaml on the
// feat/m7-server branch. When a core release with them is pinned
// (`make api-bump`), delete this file, alias the generated schemas in
// src/api/types.ts (PushRegistrationStatus, PushRegistrationInput,
// PushTopic, PushEnvironment, PushLocale) and call `client.GET('/api/device/v1/push')`
// directly. The generated code is never edited (ADR 0002).
//
// The calls go through the one API client (same base URL, device token,
// timeout and transport): only its path typing is widened here.
import type { Client } from 'openapi-fetch';

import { request, type ApiClient } from './client';
import { ProblemError } from './errors';

/** Topic of a push: a key of the relay's closed catalogue (ADR 0027 §7). */
export type PushTopic = 'booking_new_online' | 'booking_approval_requested' | 'payment_failed';

export const PUSH_TOPICS: readonly PushTopic[] = [
  'booking_new_online',
  'booking_approval_requested',
  'payment_failed',
];

/** APNs environment of the token: `sandbox` only for iOS development builds. */
export type PushEnvironment = 'production' | 'sandbox';

/** Language of the relay's generic text. */
export type PushLocale = 'it' | 'en' | 'de' | 'fr';

/** Body of PUT /api/device/v1/push (PushRegistrationInput). */
export interface PushRegistrationInput {
  /** Native APNs or FCM token (16–4096 printable ASCII characters). Never returned. */
  token: string;
  environment?: PushEnvironment;
  locale: PushLocale;
  /** Chosen by the user among `allowed_topics` (at most 3, unique). */
  topics: PushTopic[];
}

/** GET/PUT /api/device/v1/push (PushRegistrationStatus). */
export interface PushRegistrationStatus {
  /** Usable now: relay key on the instance and push turned on by the manager. */
  available: boolean;
  relay_configured: boolean;
  establishment_enabled: boolean;
  /** This device has a registered token. */
  registered: boolean;
  environment?: PushEnvironment;
  locale?: PushLocale;
  /** Registered topics (empty when not registered). */
  topics: PushTopic[];
  /** Topics the user's role allows and the manager turned on. */
  allowed_topics: PushTopic[];
  updated_at?: string;
}

type NoParams = { query?: never; header?: never; path?: never; cookie?: never };
type Json<T> = { headers: Record<string, unknown>; content: { 'application/json': T } };
type Problem = {
  headers: Record<string, unknown>;
  content: { 'application/problem+json': unknown };
};

/** The paths fragment of the core contract, in openapi-typescript's shape. */
interface PushPaths {
  '/api/device/v1/push': {
    parameters: NoParams;
    get: {
      parameters: NoParams;
      requestBody?: never;
      responses: { 200: Json<PushRegistrationStatus>; 401: Problem; 501: Problem };
    };
    put: {
      parameters: NoParams;
      requestBody: { content: { 'application/json': PushRegistrationInput } };
      responses: {
        200: Json<PushRegistrationStatus>;
        400: Problem;
        401: Problem;
        409: Problem;
        501: Problem;
      };
    };
    delete: {
      parameters: NoParams;
      requestBody?: never;
      responses: {
        204: { headers: Record<string, unknown>; content?: never };
        401: Problem;
        501: Problem;
      };
    };
    post?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}

const PATH = '/api/device/v1/push' as const;

function pushClient(client: ApiClient): Client<PushPaths> {
  return client as unknown as Client<PushPaths>;
}

export function getPushStatus(client: ApiClient): Promise<PushRegistrationStatus> {
  return request(() => pushClient(client).GET(PATH));
}

export function registerPush(
  client: ApiClient,
  body: PushRegistrationInput,
): Promise<PushRegistrationStatus> {
  return request(() => pushClient(client).PUT(PATH, { body }));
}

export async function unregisterPush(client: ApiClient): Promise<void> {
  await request(() => pushClient(client).DELETE(PATH));
}

/**
 * 409 push_unavailable: the instance has no relay key or the manager has
 * not turned push on. The slug is not in the pinned ProblemType union yet.
 */
export function isPushUnavailable(e: unknown): boolean {
  return e instanceof ProblemError && (e.type as string) === 'push_unavailable';
}
