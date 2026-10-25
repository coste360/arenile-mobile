import { createApiClient } from '@/api/client';
import { ProblemError } from '@/api/errors';
import { fakeFetch, json, problem } from '@/test/fake-fetch';

import { sendOfflineOperation } from './senders';
import type { OfflineOperation } from './types';

const EST = '/api/admin/v1/establishments/est-1';
const base = {
  id: 'op-1',
  idempotencyKey: 'key-0001-abcd',
  createdAt: '2026-07-14T09:00:00.000Z',
  seq: 1,
  status: 'sending' as const,
  scope: { instanceUrl: 'https://lido.example.it', establishmentId: 'est-1' },
  bookingId: 'b-1',
  label: 'A1 · AR-7K3Q9',
};

async function send(op: OfflineOperation, status = 200) {
  const network = fakeFetch({
    [`POST ${EST}/bookings/b-1/check-in`]: () => json(status, {}),
    [`POST ${EST}/bookings/b-1/notes`]: () => json(status, {}),
    [`POST ${EST}/bookings/b-1/payments`]: () => json(status === 200 ? 201 : status, {}),
    [`POST ${EST}/season-passes/b-1/releases`]: () => json(status === 200 ? 201 : status, {}),
  });
  const client = createApiClient({
    baseUrl: 'https://lido.example.it',
    token: 'ar_dev_x_y',
    fetch: network.fetch,
  });
  await sendOfflineOperation(client, op);
  const request = network.calls[0]!;
  return { request, body: await request.clone().json() };
}

describe('sendOfflineOperation', () => {
  it('sends a check-in with the idempotency key and the cached version', async () => {
    const { request } = await send({ ...base, kind: 'check_in', ifMatch: '"3"' });
    expect(new URL(request.url).pathname).toBe(`${EST}/bookings/b-1/check-in`);
    expect(request.headers.get('Idempotency-Key')).toBe('key-0001-abcd');
    expect(request.headers.get('If-Match')).toBe('"3"');
    expect(request.headers.get('Authorization')).toBe('Bearer ar_dev_x_y');
  });

  it('sends If-Match "*" when the version is not reliable', async () => {
    const { request } = await send({ ...base, kind: 'check_in' });
    expect(request.headers.get('If-Match')).toBe('*');
  });

  it('sends an internal note', async () => {
    const { request, body } = await send({ ...base, kind: 'note', text: 'Lettino in più' });
    expect(request.headers.get('Idempotency-Key')).toBe('key-0001-abcd');
    expect(body).toEqual({ text: 'Lettino in più', visibility: 'internal' });
  });

  it('sends a cash payment in integer cents', async () => {
    const { request, body } = await send({ ...base, kind: 'cash_payment', amount: 1250 });
    expect(request.headers.get('Idempotency-Key')).toBe('key-0001-abcd');
    expect(body).toEqual({ amount: 1250, method: 'cash' });
  });

  it('sends a day release on the season pass', async () => {
    const { request, body } = await send({
      ...base,
      kind: 'day_release',
      date: '2026-07-15',
      slots: 'AM',
    });
    expect(new URL(request.url).pathname).toBe(`${EST}/season-passes/b-1/releases`);
    expect(request.headers.get('Idempotency-Key')).toBe('key-0001-abcd');
    expect(body).toEqual({ dates: ['2026-07-15'], slots: 'AM' });
  });

  it('throws the typed problem on refusal', async () => {
    const network = fakeFetch({
      [`POST ${EST}/bookings/b-1/check-in`]: () => problem(409, 'invalid_transition'),
    });
    const client = createApiClient({ baseUrl: 'https://lido.example.it', fetch: network.fetch });
    await expect(sendOfflineOperation(client, { ...base, kind: 'check_in' })).rejects.toEqual(
      expect.objectContaining({ status: 409, type: 'invalid_transition' }),
    );
    await expect(
      sendOfflineOperation(client, { ...base, kind: 'check_in' }),
    ).rejects.toBeInstanceOf(ProblemError);
  });
});
