import { createPinnedFetch, PinnedFetchError } from './pinned-fetch';
import {
  NATIVE_ERROR_CODES,
  type NativePinnedRequest,
  type NativePinnedResponse,
  type PinnedFetchNativeModule,
} from './PinnedFetch.types';

const FINGERPRINT =
  'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';
const URL = 'https://192.168.1.20:8443/api/admin/v1/meta';

function answer(overrides: Partial<NativePinnedResponse> = {}): NativePinnedResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"product":"arenile","name":"Lido Sirena è"}',
    url: URL,
    ...overrides,
  };
}

/** Mocked native module: records calls and answers with `respond`. */
function mockNative(respond: (request: NativePinnedRequest) => Promise<NativePinnedResponse>) {
  const calls: { id: string; request: NativePinnedRequest }[] = [];
  const cancelled: string[] = [];
  const native: PinnedFetchNativeModule = {
    fetch: jest.fn((id: string, request: NativePinnedRequest) => {
      calls.push({ id, request });
      return respond(request);
    }),
    cancel: jest.fn(async (id: string) => {
      cancelled.push(id);
    }),
  };
  return { native, calls, cancelled };
}

const rejection = (code: string) => Object.assign(new Error(code), { code });

describe('createPinnedFetch', () => {
  it('serialises the request and passes the canonical fingerprint', async () => {
    const { native, calls } = mockNative(async () => answer({ status: 201 }));
    const pinnedFetch = createPinnedFetch(native, { timeoutMs: 5_000 });

    await pinnedFetch(
      new Request(`${URL}?x=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ar_dev_x' },
        body: JSON.stringify({ code: 'ABCD-EFGH' }),
      }),
      FINGERPRINT.toLowerCase(),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.request).toEqual({
      url: `${URL}?x=1`,
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ar_dev_x' },
      body: '{"code":"ABCD-EFGH"}',
      fingerprint: FINGERPRINT,
      timeoutMs: 5_000,
    });
  });

  it('sends no body for GET and gives every request its own id', async () => {
    const { native, calls } = mockNative(async () => answer());
    const pinnedFetch = createPinnedFetch(native);
    await pinnedFetch(new Request(URL), FINGERPRINT);
    await pinnedFetch(new Request(URL), FINGERPRINT);
    expect(calls.map((c) => c.request.body)).toEqual([null, null]);
    expect(new Set(calls.map((c) => c.id)).size).toBe(2);
  });

  it('turns the native answer into a Response (UTF-8 JSON, status, headers)', async () => {
    const { native } = mockNative(async () =>
      answer({
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json', 'x-request-id': 'r1' },
      }),
    );
    const response = await createPinnedFetch(native)(new Request(URL), FINGERPRINT);
    expect(response.status).toBe(404);
    expect(response.ok).toBe(false);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    expect(response.headers.get('x-request-id')).toBe('r1');
    expect(await response.json()).toEqual({ product: 'arenile', name: 'Lido Sirena è' });
  });

  it('drops the body of a 204', async () => {
    const { native } = mockNative(async () => answer({ status: 204, body: '' }));
    const response = await createPinnedFetch(native)(
      new Request(URL, { method: 'DELETE' }),
      FINGERPRINT,
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it.each([
    [NATIVE_ERROR_CODES.certificateMismatch, 'certificate_mismatch'],
    [NATIVE_ERROR_CODES.invalidRequest, 'invalid_request'],
    [NATIVE_ERROR_CODES.cancelled, 'aborted'],
    [NATIVE_ERROR_CODES.network, 'network'],
    ['ERR_SOMETHING_ELSE', 'network'],
  ])('maps the native rejection %s to %s', async (nativeCode, code) => {
    const { native } = mockNative(() => Promise.reject(rejection(nativeCode)));
    const error = await createPinnedFetch(native)(new Request(URL), FINGERPRINT).catch((e) => e);
    expect(error).toBeInstanceOf(PinnedFetchError);
    expect(error.code).toBe(code);
  });

  it.each([
    ['an invalid fingerprint', URL, 'AA:BB'],
    ['a plain http URL', 'http://192.168.1.20:8443/api/admin/v1/meta', FINGERPRINT],
  ])('refuses %s without calling the native module', async (_, url, fingerprint) => {
    const { native, calls } = mockNative(async () => answer());
    const error = await createPinnedFetch(native)(new Request(url), fingerprint).catch((e) => e);
    expect(error).toBeInstanceOf(PinnedFetchError);
    expect(error.code).toBe('invalid_request');
    expect(calls).toHaveLength(0);
  });

  it('cancels the native request when the signal aborts', async () => {
    const { native, calls, cancelled } = mockNative(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = createPinnedFetch(native)(
      new Request(URL, { signal: controller.signal }),
      FINGERPRINT,
    ).catch((e) => e);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    const error = await pending;
    expect(error).toBeInstanceOf(PinnedFetchError);
    expect(error.code).toBe('aborted');
    expect(cancelled).toEqual([calls[0]!.id]);
  });

  it('does not start a request whose signal is already aborted', async () => {
    const { native, calls } = mockNative(async () => answer());
    const controller = new AbortController();
    controller.abort();
    const error = await createPinnedFetch(native)(
      new Request(URL, { signal: controller.signal }),
      FINGERPRINT,
    ).catch((e) => e);
    expect(error.code).toBe('aborted');
    expect(calls).toHaveLength(0);
  });
});
