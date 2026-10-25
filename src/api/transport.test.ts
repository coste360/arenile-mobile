import { CertificateMismatchError, LanTransportUnavailableError } from '@/api/errors';
import { canPinCertificates, PinnedFetchError, selectTransport } from '@/api/transport';
import { fakeFetch, json, LAN_FINGERPRINT } from '@/test/fake-fetch';

const URL = 'https://192.168.1.20:8443/api/admin/v1/meta';

describe('canPinCertificates', () => {
  it('is false without the native module (unit tests, Expo Go, web)', () => {
    expect(canPinCertificates()).toBe(false);
    expect(canPinCertificates(null)).toBe(false);
  });

  it('is true with a pinned transport', () => {
    expect(canPinCertificates(async () => json(200, {}))).toBe(true);
  });
});

describe('selectTransport', () => {
  it('uses the platform fetch for instances without a fingerprint', async () => {
    const f = fakeFetch({ 'GET /api/admin/v1/meta': () => json(200, {}) });
    const pinned = jest.fn();
    await selectTransport({ fetch: f.fetch, pinnedFetch: pinned })(new Request(URL));
    expect(f.calls).toHaveLength(1);
    expect(pinned).not.toHaveBeenCalled();
  });

  it('refuses a fingerprint without a pinned transport', () => {
    expect(() => selectTransport({ fingerprint: LAN_FINGERPRINT, pinnedFetch: null })).toThrow(
      LanTransportUnavailableError,
    );
  });

  it('pins the canonical fingerprint and never uses the platform fetch', async () => {
    const f = fakeFetch({});
    const pinned = jest.fn(async () => json(200, {}));
    const transport = selectTransport({
      fingerprint: LAN_FINGERPRINT.replaceAll(':', '').toLowerCase(),
      fetch: f.fetch,
      pinnedFetch: pinned,
    });
    await transport(new Request(URL));
    expect(pinned).toHaveBeenCalledWith(expect.any(Request), LAN_FINGERPRINT);
    expect(f.calls).toHaveLength(0);
  });

  it('turns a certificate mismatch into CertificateMismatchError', async () => {
    const transport = selectTransport({
      fingerprint: LAN_FINGERPRINT,
      pinnedFetch: () => Promise.reject(new PinnedFetchError('certificate_mismatch')),
    });
    await expect(transport(new Request(URL))).rejects.toBeInstanceOf(CertificateMismatchError);
  });

  it('passes other pinned failures through (the client maps them to unreachable)', async () => {
    const failure = new PinnedFetchError('network');
    const transport = selectTransport({
      fingerprint: LAN_FINGERPRINT,
      pinnedFetch: () => Promise.reject(failure),
    });
    await expect(transport(new Request(URL))).rejects.toBe(failure);
  });

  it('rejects a malformed fingerprint as a programming error', () => {
    expect(() =>
      selectTransport({ fingerprint: 'AA:BB', pinnedFetch: async () => json(200, {}) }),
    ).toThrow(TypeError);
  });
});
