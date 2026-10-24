import { createMemoryKeyValueStore } from '@/lib/storage';
import { SESSION } from '@/test/fixtures';

import { createSessionStore, parseSession, SESSION_KEY, type Session } from './session';

describe('SessionStore', () => {
  it('saves, loads and clears the session', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createSessionStore(kv);

    expect(await store.load()).toBeNull();
    await store.save(SESSION);
    expect(await store.load()).toEqual(SESSION);
    await store.clear();
    expect(await store.load()).toBeNull();
    expect(kv.snapshot()).toEqual({});
  });

  it('removes a corrupted entry instead of keeping it', async () => {
    const kv = createMemoryKeyValueStore({ [SESSION_KEY]: '{"v":1,"token":' });
    const store = createSessionStore(kv);

    expect(await store.load()).toBeNull();
    expect(kv.snapshot()).toEqual({});
  });
});

describe('parseSession', () => {
  const without = (key: keyof Session) => {
    const copy: Record<string, unknown> = { ...SESSION };
    delete copy[key];
    return JSON.stringify(copy);
  };

  it.each([
    ['null', null],
    ['not JSON', 'nope'],
    ['JSON array', '[]'],
    ['other format version', JSON.stringify({ ...SESSION, v: 2 })],
    ['missing token', without('token')],
    ['empty token', JSON.stringify({ ...SESSION, token: '' })],
    ['missing instance', without('instanceUrl')],
    ['missing establishment', without('establishmentId')],
    ['bad fingerprint', JSON.stringify({ ...SESSION, fingerprint: 3 })],
  ])('rejects %s', (_name, raw) => {
    expect(parseSession(raw)).toBeNull();
  });

  it('accepts a session without the optional fields', () => {
    const raw = without('establishmentName');
    expect(parseSession(raw)).toMatchObject({ token: SESSION.token });
  });
});
