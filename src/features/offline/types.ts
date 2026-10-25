// Contract of the offline mode (phase 1 spec "Offline", core spec 21.2),
// shared by the cache, the operation queue and the features that enqueue.
// The rules and their reasons are in docs/data-and-offline.md.
import type { ProblemType, Slots } from '@/api/types';
import type { CalendarDate } from '@/lib/calendar';
import type { Cents } from '@/lib/money';

/** Low-risk operations that may be queued offline (spec 21.2 + phase 1 "rilasci"). */
export type OfflineOperationKind = 'check_in' | 'day_release' | 'note' | 'cash_payment';

export const OFFLINE_OPERATION_KINDS: readonly OfflineOperationKind[] = [
  'check_in',
  'day_release',
  'note',
  'cash_payment',
];

/**
 * Operations that need the server's availability guarantees (spec 21.2):
 * never queued, offered only while the instance is reachable.
 */
export type OnlineOnlyOperation = 'create_booking' | 'move_booking';

export const ONLINE_ONLY_OPERATIONS: readonly OnlineOnlyOperation[] = [
  'create_booking',
  'move_booking',
];

export type QueuedStatus = 'pending' | 'sending' | 'conflict' | 'failed';

/**
 * Why an operation was refused or held. `type` is the core's stable problem
 * slug (never the title/detail text), or a local reason:
 * - `unknown`: an error answer without a problem body;
 * - `other_establishment`: queued under another pairing (instance or
 *   establishment), it cannot be sent with this token.
 */
export interface OperationError {
  status?: number;
  type: ProblemType | 'unknown' | 'other_establishment';
}

/** The pairing an operation belongs to: only that token may send it. */
export interface OperationScope {
  instanceUrl: string;
  establishmentId: string;
}

/** Fields managed by the queue; features provide the rest. */
export interface QueuedFields {
  /** Local id. */
  id: string;
  /** Sent as Idempotency-Key; generated once at enqueue time, stable across replays. */
  idempotencyKey: string;
  /** RFC 3339 instant of the enqueue (from the injected clock). */
  createdAt: string;
  /** Monotonic sequence number: the send order. */
  seq: number;
  status: QueuedStatus;
  /** Last failure (status conflict or failed; or the last transient error while pending). */
  error?: OperationError;
}

interface OperationBase extends QueuedFields {
  scope: OperationScope;
  /** Booking concerned (for a season pass, its booking id is the pass id). */
  bookingId: string;
  /**
   * What the user sees in the pending list: spot label and booking code.
   * Never contact details.
   */
  label: string;
}

/** POST bookings/{id}/check-in, If-Match with the cached version when it is reliable. */
export interface CheckInOperation extends OperationBase {
  kind: 'check_in';
  ifMatch?: string;
}

/** POST season-passes/{bookingId}/releases for one day. */
export interface DayReleaseOperation extends OperationBase {
  kind: 'day_release';
  date: CalendarDate;
  slots?: Slots;
}

/** POST bookings/{id}/notes (internal note). */
export interface NoteOperation extends OperationBase {
  kind: 'note';
  text: string;
}

/** POST bookings/{id}/payments with method cash (needs an open cash session on the server). */
export interface CashPaymentOperation extends OperationBase {
  kind: 'cash_payment';
  amount: Cents;
  note?: string;
}

export type OfflineOperation =
  CheckInOperation | DayReleaseOperation | NoteOperation | CashPaymentOperation;

type ManagedKey = keyof QueuedFields | 'scope';

/** Input of enqueue: the feature fields; the queue adds ids, key, order, status and scope. */
export type NewOfflineOperation = OfflineOperation extends infer Op
  ? Op extends OfflineOperation
    ? Omit<Op, ManagedKey>
    : never
  : never;

/**
 * Connection state shown by the indicator:
 * - `online`: the device has a network and the instance answers;
 * - `unreachable`: the device has a network but the instance does not answer;
 * - `offline`: the device has no network;
 * - `syncing`: queued operations are being sent.
 */
export type ConnectionState = 'online' | 'unreachable' | 'offline' | 'syncing';
