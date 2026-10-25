import { NetworkError, ProblemError, UnauthorizedError } from '@/api/errors';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { sequentialIds } from '@/test/ids';

import { createOperationQueue, QUEUE_KEY, type OperationQueue } from './queue';
import type { NoteOperation, OfflineOperation, OperationScope } from './types';

const SCOPE: OperationScope = { instanceUrl: 'https://lido.example.it', establishmentId: 'est-1' };
const OTHER: OperationScope = { instanceUrl: 'https://altro.example.it', establishmentId: 'est-9' };

const note = (bookingId: string, text = 'ombrellone in più', scope = SCOPE) =>
  ({ kind: 'note', bookingId, text, label: `A1 · ${bookingId}`, scope }) as const;

const problem = (status: number, type = 'conflict') =>
  new ProblemError(status, { type, title: type, status } as never);

function setup(
  send: (op: OfflineOperation) => Promise<void> = async () => {},
  store = createMemoryKeyValueStore(),
  // Ids are UUIDs in the app: unique across restarts.
  idPrefix = 'k',
) {
  const sent: OfflineOperation[] = [];
  const queue: OperationQueue<OfflineOperation> = createOperationQueue<OfflineOperation>({
    store,
    send: async (op) => {
      sent.push(op);
      await send(op);
    },
    now: () => new Date('2026-07-14T09:00:00Z'),
    newId: sequentialIds(idPrefix),
  });
  return { queue, store, sent };
}

describe('operation queue', () => {
  it('sends in enqueue order, each with its own stable idempotency key', async () => {
    const { queue, sent } = setup();
    const a = await queue.enqueue(note('b1'));
    const b = await queue.enqueue(note('b2'));
    const c = await queue.enqueue(note('b3'));

    expect(new Set([a.idempotencyKey, b.idempotencyKey, c.idempotencyKey]).size).toBe(3);
    expect(a.idempotencyKey).not.toBe(a.id);
    expect(a.createdAt).toBe('2026-07-14T09:00:00.000Z');

    const result = await queue.flush(SCOPE);

    expect(sent.map((o) => o.bookingId)).toEqual(['b1', 'b2', 'b3']);
    expect(sent.map((o) => o.idempotencyKey)).toEqual([
      a.idempotencyKey,
      b.idempotencyKey,
      c.idempotencyKey,
    ]);
    expect(result).toMatchObject({ sent: 3, conflicts: 0, failed: 0, blocked: false });
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('stops on a network error, keeps the order and reuses the same key on the next flush', async () => {
    let down = true;
    const { queue, sent } = setup(async () => {
      if (down) throw new NetworkError('unreachable');
    });
    const a = await queue.enqueue(note('b1'));
    await queue.enqueue(note('b2'));

    const first = await queue.flush(SCOPE);
    expect(first).toMatchObject({ sent: 0, blocked: true });
    expect(sent.map((o) => o.bookingId)).toEqual(['b1']);
    expect(queue.getSnapshot().map((o) => [o.bookingId, o.status])).toEqual([
      ['b1', 'pending'],
      ['b2', 'pending'],
    ]);

    down = false;
    const second = await queue.flush(SCOPE);
    expect(second).toMatchObject({ sent: 2, blocked: false });
    expect(sent.map((o) => o.bookingId)).toEqual(['b1', 'b1', 'b2']);
    // The replay of b1 carries the same key: applied once on the server.
    expect(sent[0]!.idempotencyKey).toBe(a.idempotencyKey);
    expect(sent[1]!.idempotencyKey).toBe(a.idempotencyKey);
  });

  it.each([
    [409, 'invalid_transition', 'conflict'],
    [412, 'version_conflict', 'conflict'],
    [422, 'idempotency_key_reused', 'conflict'],
    [403, 'forbidden', 'failed'],
    [404, 'not_found', 'failed'],
    [501, 'not_implemented', 'failed'],
  ] as const)(
    'keeps a %d %s as %s for the user and goes on with the next',
    async (status, type, outcome) => {
      const { queue, sent } = setup(async (op) => {
        if (op.bookingId === 'b1') throw problem(status, type);
      });
      await queue.enqueue(note('b1'));
      await queue.enqueue(note('b2'));

      const result = await queue.flush(SCOPE);

      expect(sent.map((o) => o.bookingId)).toEqual(['b1', 'b2']);
      expect(result.sent).toBe(1);
      expect(outcome === 'conflict' ? result.conflicts : result.failed).toBe(1);
      expect(queue.getSnapshot()).toEqual([
        expect.objectContaining({ bookingId: 'b1', status: outcome, error: { status, type } }),
      ]);
    },
  );

  it.each([
    ['a 5xx', () => problem(503, 'internal_error')],
    ['a 429', () => problem(429, 'rate_limited')],
    ['a 401 without the core problem (captive portal)', () => new ProblemError(401, null)],
  ])('treats %s as transient', async (_name, error) => {
    const { queue } = setup(async () => {
      throw error();
    });
    await queue.enqueue(note('b1'));
    const result = await queue.flush(SCOPE);
    expect(result).toMatchObject({ blocked: true, unauthorized: false });
    expect(queue.getSnapshot()[0]).toMatchObject({ status: 'pending' });
    expect(queue.isPaused()).toBe(false);
  });

  it('pauses on a revoked token until resumed', async () => {
    let revoked = true;
    const { queue, sent } = setup(async () => {
      if (revoked) {
        throw new UnauthorizedError(401, { type: 'unauthorized', title: 'x', status: 401 });
      }
    });
    await queue.enqueue(note('b1'));
    await queue.enqueue(note('b2'));

    expect(await queue.flush(SCOPE)).toMatchObject({ blocked: true, unauthorized: true });
    expect(queue.isPaused()).toBe(true);
    expect(await queue.flush(SCOPE)).toMatchObject({ sent: 0, blocked: true });
    expect(sent).toHaveLength(1);

    revoked = false;
    queue.resume();
    expect(await queue.flush(SCOPE)).toMatchObject({ sent: 2 });
  });

  it('retries a refused operation at the end of the queue with a new key', async () => {
    let refuse = true;
    const { queue, sent } = setup(async (op) => {
      if (refuse && op.bookingId === 'b1') throw problem(409);
    });
    const a = await queue.enqueue(note('b1'));
    await queue.flush(SCOPE);
    await queue.enqueue(note('b2'));

    await queue.retry(a.id);
    const retried = queue.getSnapshot().find((o) => o.id === a.id)!;
    expect(retried.status).toBe('pending');
    expect(retried.error).toBeUndefined();
    expect(retried.idempotencyKey).not.toBe(a.idempotencyKey);

    refuse = false;
    sent.length = 0;
    await queue.flush(SCOPE);
    expect(sent.map((o) => o.bookingId)).toEqual(['b2', 'b1']);
  });

  it('discards an operation only when asked', async () => {
    const { queue } = setup(async () => {
      throw problem(409);
    });
    const a = await queue.enqueue(note('b1'));
    await queue.flush(SCOPE);
    expect(queue.getSnapshot()).toHaveLength(1);
    await queue.discard(a.id);
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('survives a restart: the queue is reloaded in order and an interrupted send is replayed with the same key', async () => {
    const store = createMemoryKeyValueStore();
    let hang: () => void = () => {};
    const first = setup(
      () =>
        new Promise<void>((resolve) => {
          hang = resolve;
        }),
      store,
    );
    const a = await first.queue.enqueue(note('b1'));
    const b = await first.queue.enqueue(note('b2'));
    // The app is killed while b1 is being sent.
    void first.queue.flush(SCOPE);
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(store.snapshot()[QUEUE_KEY]!)[0]).toMatchObject({ status: 'sending' });

    const second = setup(async () => {}, store, 'after-restart');
    await second.queue.init();
    expect(second.queue.getSnapshot().map((o) => [o.id, o.status])).toEqual([
      [a.id, 'pending'],
      [b.id, 'pending'],
    ]);
    const c = await second.queue.enqueue(note('b3'));
    expect(c.seq).toBeGreaterThan(b.seq);

    await second.queue.flush(SCOPE);
    expect(second.sent.map((o) => o.idempotencyKey)).toEqual([
      a.idempotencyKey,
      b.idempotencyKey,
      c.idempotencyKey,
    ]);
    hang();
  });

  it('keeps conflicts across a restart', async () => {
    const store = createMemoryKeyValueStore();
    const first = setup(async () => {
      throw problem(409, 'cash_session_closed');
    }, store);
    await first.queue.enqueue(note('b1'));
    await first.queue.flush(SCOPE);

    const second = setup(async () => {}, store);
    await second.queue.init();
    expect(second.queue.getSnapshot()).toEqual([
      expect.objectContaining({
        status: 'conflict',
        error: { status: 409, type: 'cash_session_closed' },
      }),
    ]);
    // A conflict is not replayed by a flush: only by the user's retry.
    await second.queue.flush(SCOPE);
    expect(second.sent).toEqual([]);
  });

  it('sends only the operations of the paired establishment and flags the others', async () => {
    const { queue, sent } = setup();
    await queue.enqueue(note('b1', 'x', OTHER));
    await queue.enqueue(note('b2'));

    await queue.quarantine(SCOPE);
    await queue.flush(SCOPE);

    expect(sent.map((o) => o.bookingId)).toEqual(['b2']);
    expect(queue.getSnapshot()).toEqual([
      expect.objectContaining({
        bookingId: 'b1',
        status: 'failed',
        error: { type: 'other_establishment' },
      }),
    ]);
  });

  it('shares one flush between concurrent calls', async () => {
    const { queue, sent } = setup();
    await queue.enqueue(note('b1'));
    const [r1, r2] = await Promise.all([queue.flush(SCOPE), queue.flush(SCOPE)]);
    expect(r1).toBe(r2);
    expect(sent).toHaveLength(1);
  });

  it('notifies subscribers and keeps a stable snapshot between changes', async () => {
    const { queue } = setup();
    const listener = jest.fn();
    queue.subscribe(listener);
    await queue.enqueue(note('b1'));
    expect(listener).toHaveBeenCalled();
    expect(queue.getSnapshot()).toBe(queue.getSnapshot());
  });

  it('clears everything', async () => {
    const { queue, store } = setup();
    await queue.enqueue(note('b1'));
    await queue.clear();
    expect(queue.getSnapshot()).toEqual([]);
    expect(JSON.parse(store.snapshot()[QUEUE_KEY]!)).toEqual([]);
  });

  it('ignores a corrupted stored queue', async () => {
    const store = createMemoryKeyValueStore({ [QUEUE_KEY]: '{not json' });
    const { queue } = setup(async () => {}, store);
    await queue.init();
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('keeps the note text and the label only, never more than the feature gave', async () => {
    const { queue } = setup();
    const op = (await queue.enqueue(note('b1'))) as NoteOperation;
    expect(Object.keys(op).sort()).toEqual(
      [
        'bookingId',
        'createdAt',
        'id',
        'idempotencyKey',
        'kind',
        'label',
        'scope',
        'seq',
        'status',
        'text',
      ].sort(),
    );
  });
});
