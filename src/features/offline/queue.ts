// Persistent FIFO of the operations recorded while offline (spec 21.2),
// ported from the panel's queue (core web/shared/src/offline/queue.ts).
//
//   enqueue ──► pending ──flush──► sending ──2xx──► (removed)
//                  ▲                  │
//                  │  network / 5xx / 429 → pending, flush stops (order kept)
//                  │  401 unauthorized    → pending, queue paused until resume()
//                  │  409 / 412 / 422     → conflict (shown to the user), flush goes on
//                  │  other 4xx           → failed   (shown to the user), flush goes on
//                  └──── retry(id): conflict|failed → pending, last, with a NEW key
//
// Replays are safe: each operation carries the Idempotency-Key generated at
// enqueue time, so a request whose answer was lost (app killed while
// "sending", timeout after the server applied it) is applied once. An
// operation left "sending" by a killed app is reset to "pending" at init.
// retry() regenerates the key on purpose: the previous attempt was refused
// (not applied), and the server would otherwise replay the stored refusal.
// Nothing is ever dropped without the user: conflicts and failures stay
// until retried or discarded.
//
// The whole queue is one JSON value in the offline store, written after
// every change (a few operations, never large); writes are serialised.
import type { KeyValueStore } from '@/lib/storage';
import { errorKind } from '@/lib/log';

import { classifyFailure, type ClassifiedFailure } from './classify';
import type { OperationError, OperationScope, QueuedFields } from './types';

export const QUEUE_KEY = 'arenile.offline.queue.v1';

interface Scoped extends QueuedFields {
  scope: OperationScope;
}

export interface FlushResult {
  sent: number;
  conflicts: number;
  failed: number;
  /** True when the flush stopped on a transient error or a 401. */
  blocked: boolean;
  /** Set when the flush stopped on a 401. */
  unauthorized: boolean;
}

export interface OperationQueueOptions<Op extends Scoped> {
  store: KeyValueStore;
  /** Performs the request; resolves on 2xx, throws a typed API error otherwise. */
  send: (op: Op) => Promise<void>;
  classify?: (err: unknown) => ClassifiedFailure;
  now: () => Date;
  newId: () => string;
  /** Called after an operation was applied by the server. */
  onSent?: (op: Op) => void;
  /** Called when an operation became `conflict` or `failed`. */
  onRejected?: (op: Op) => void;
  key?: string;
}

/** Input of enqueue: everything but the fields the queue manages. */
export type EnqueueInput<Op extends Scoped> = Op extends unknown
  ? Omit<Op, keyof QueuedFields>
  : never;

export interface OperationQueue<Op extends Scoped> {
  /** Loads the persisted operations (idempotent; awaited by every method). */
  init(): Promise<void>;
  enqueue(input: EnqueueInput<Op>): Promise<Op>;
  /** Operations in send order (stable reference between changes). */
  getSnapshot(): readonly Op[];
  subscribe(listener: () => void): () => void;
  /**
   * Sends the pending operations of `scope` in order, one at a time;
   * resolves when drained or blocked. Concurrent calls share one flush.
   */
  flush(scope: OperationScope): Promise<FlushResult>;
  /** Puts a conflict/failed operation back at the end of the queue with a new key. */
  retry(id: string): Promise<void>;
  /** Removes one operation (the user decided). */
  discard(id: string): Promise<void>;
  /** Marks pending operations of another pairing as failed `other_establishment`. */
  quarantine(scope: OperationScope): Promise<void>;
  /** Removes every operation (voluntary unpair, after the user was warned). */
  clear(): Promise<void>;
  /** True after a 401, until resume(). */
  isPaused(): boolean;
  resume(): void;
  isFlushing(): boolean;
}

const bySeq = (a: { seq: number }, b: { seq: number }) => a.seq - b.seq;

export const sameScope = (a: OperationScope, b: OperationScope) =>
  a.instanceUrl === b.instanceUrl && a.establishmentId === b.establishmentId;

function parse<Op>(raw: string | null): Op[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as Op[]) : [];
  } catch {
    return [];
  }
}

export function createOperationQueue<Op extends Scoped>(
  options: OperationQueueOptions<Op>,
): OperationQueue<Op> {
  const { store, send, now, newId } = options;
  const key = options.key ?? QUEUE_KEY;
  const classify = options.classify ?? classifyFailure;
  const listeners = new Set<() => void>();

  let ops: Op[] = [];
  let snapshot: readonly Op[] = [];
  let nextSeq = 1;
  let paused = false;
  let loaded: Promise<void> | null = null;
  let flushing: Promise<FlushResult> | null = null;
  let writing: Promise<void> = Promise.resolve();

  const emit = () => {
    snapshot = [...ops].sort(bySeq);
    for (const l of [...listeners]) l();
  };

  /** Applies a change in memory and persists the whole queue (serialised). */
  const commit = (next: Op[]) => {
    ops = next;
    emit();
    const value = JSON.stringify(ops);
    writing = writing.then(() =>
      store.setItem(key, value).catch((e: unknown) => {
        // Kept in memory; the next change writes again.
        console.warn('offline queue: write failed', errorKind(e));
      }),
    );
    return writing;
  };

  const init = () => {
    loaded ??= (async () => {
      const stored = parse<Op>(await store.getItem(key));
      // Killed mid-request: replay it (the idempotency key makes it safe).
      const fixed = stored.map((o) =>
        o.status === 'sending' ? ({ ...o, status: 'pending' } as Op) : o,
      );
      nextSeq = Math.max(nextSeq, ...fixed.map((o) => o.seq + 1), 1);
      // Operations enqueued before the load finished keep their place after.
      const merged = [...fixed, ...ops.filter((o) => !fixed.some((f) => f.id === o.id))];
      await commit(merged);
    })().catch((e: unknown) => {
      loaded = null;
      throw e;
    });
    return loaded;
  };

  const replace = (op: Op) => commit(ops.map((o) => (o.id === op.id ? op : o)));

  const drain = async (scope: OperationScope): Promise<FlushResult> => {
    const result: FlushResult = {
      sent: 0,
      conflicts: 0,
      failed: 0,
      blocked: false,
      unauthorized: false,
    };
    for (;;) {
      const pending = ops
        .filter((o) => o.status === 'pending' && sameScope(o.scope, scope))
        .sort(bySeq);
      if (paused) {
        result.blocked = pending.length > 0;
        break;
      }
      const next = pending[0];
      if (!next) break;
      const sending = { ...next, status: 'sending' } as Op;
      await replace(sending);
      try {
        await send(sending);
        await commit(ops.filter((o) => o.id !== sending.id));
        result.sent++;
        options.onSent?.(sending);
      } catch (err) {
        const { outcome, error } = classify(err);
        if (outcome === 'retry' || outcome === 'auth') {
          const back = { ...sending, status: 'pending' } as Op;
          if (error) back.error = error;
          else delete back.error;
          await replace(back);
          if (outcome === 'auth') {
            paused = true;
            result.unauthorized = true;
          }
          result.blocked = true;
          break;
        }
        const rejected = {
          ...sending,
          status: outcome,
          error: error ?? { type: 'unknown' },
        } as Op;
        await replace(rejected);
        if (outcome === 'conflict') result.conflicts++;
        else result.failed++;
        options.onRejected?.(rejected);
      }
    }
    return result;
  };

  return {
    init,
    async enqueue(input) {
      await init();
      const op = {
        ...input,
        id: newId(),
        idempotencyKey: newId(),
        createdAt: now().toISOString(),
        seq: nextSeq++,
        status: 'pending',
      } as unknown as Op;
      await commit([...ops, op]);
      return op;
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    flush(scope) {
      flushing ??= init()
        .then(() => drain(scope))
        .finally(() => {
          flushing = null;
          emit();
        });
      return flushing;
    },
    async retry(id) {
      await init();
      const op = ops.find((o) => o.id === id);
      if (!op || (op.status !== 'conflict' && op.status !== 'failed')) return;
      const again = { ...op, status: 'pending', idempotencyKey: newId(), seq: nextSeq++ } as Op;
      delete again.error;
      await replace(again);
    },
    async discard(id) {
      await init();
      await commit(ops.filter((o) => o.id !== id));
    },
    async quarantine(scope) {
      await init();
      const error: OperationError = { type: 'other_establishment' };
      if (!ops.some((o) => o.status === 'pending' && !sameScope(o.scope, scope))) return;
      await commit(
        ops.map((o) =>
          o.status === 'pending' && !sameScope(o.scope, scope)
            ? ({ ...o, status: 'failed', error } as Op)
            : o,
        ),
      );
    },
    async clear() {
      await init().catch(() => undefined);
      paused = false;
      await commit([]);
    },
    isPaused: () => paused,
    resume() {
      paused = false;
      emit();
    },
    isFlushing: () => flushing !== null,
  };
}
