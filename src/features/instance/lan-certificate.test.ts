import { lanRenewal } from './lan-certificate';

const NOW = new Date('2026-10-25T08:00:00Z');
const lan = (renewsAt?: string) => ({
  desktop: { mode: 'lan' as const, lan_cert_renews_at: renewsAt },
});

describe('lanRenewal', () => {
  it.each([
    ['in 10 days', '2026-11-04T08:00:00Z', 'upcoming'],
    ['in exactly 30 days', '2026-11-24T08:00:00Z', 'upcoming'],
    ['already passed', '2026-10-20T08:00:00Z', 'due'],
    ['right now', '2026-10-25T08:00:00Z', 'due'],
  ])('announces a renewal %s', (_, renewsAt, status) => {
    expect(lanRenewal(lan(renewsAt), true, NOW)).toEqual({
      status,
      renewsAt: new Date(renewsAt),
    });
  });

  it.each([
    ['far away (31 days)', lan('2026-11-25T08:00:01Z'), true],
    ['an unpinned session', lan('2026-11-04T08:00:00Z'), false],
    ['no renewal instant', lan(), true],
    ['an unparsable instant', lan('soon'), true],
    ['a local-only desktop', { desktop: { mode: 'local' as const } }, true],
    ['a server instance', {}, true],
    ['meta not loaded yet', undefined, true],
  ])('stays silent for %s', (_, meta, pinned) => {
    expect(lanRenewal(meta, pinned, NOW)).toBeNull();
  });
});
