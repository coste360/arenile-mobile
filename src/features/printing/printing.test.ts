import { NetworkError, ProblemError } from '@/api/errors';
import type { PrintJobStatus, PrintRouteResolution } from '@/api/types';

import { printErrorKey, printPhase, unreadyReasonKey } from './printing';

const problem = (status: number, type: string) =>
  new ProblemError(status, { type: type as never, title: type, status });

describe('printPhase', () => {
  it.each<[PrintJobStatus, string]>([
    ['queued', 'sending'],
    ['printing', 'sending'],
    ['printed', 'printed'],
    ['failed', 'failed'],
    ['cancelled', 'failed'],
  ])('%s → %s', (status, phase) => {
    expect(printPhase(status)).toBe(phase);
  });
});

describe('unreadyReasonKey', () => {
  const printer = { id: 'p-1', name: 'Cassa' } as PrintRouteResolution['printer'];
  const base = { document_kind: 'daily_ticket', copies: 1, kick_drawer: false } as const;

  it.each<[string, PrintRouteResolution, string | null]>([
    ['a ready printer', { ...base, ready: true, printer }, null],
    [
      'the server edition',
      { ...base, ready: false, reason: 'server_edition' },
      'printing.reason.server_edition',
    ],
    ['no rule', { ...base, ready: false, reason: 'no_route' }, 'printing.reason.no_route'],
    [
      'an unreachable printer',
      { ...base, ready: false, reason: 'printer_unreachable', printer },
      'printing.reason.printer_unreachable',
    ],
    ['ready without a printer', { ...base, ready: true }, 'printing.reason.no_route'],
    ['no reason given', { ...base, ready: false }, 'printing.reason.no_route'],
  ])('%s', (_name, resolution, key) => {
    expect(unreadyReasonKey(resolution)).toBe(key);
  });
});

describe('printErrorKey', () => {
  it.each<[string, unknown, string]>([
    ['offline', new NetworkError('unreachable'), 'printing.errors.offline'],
    ['timeout', new NetworkError('timeout'), 'printing.errors.offline'],
    ['403', problem(403, 'forbidden'), 'printing.errors.forbidden'],
    ['server edition', problem(409, 'printing_unavailable'), 'printing.errors.unavailable'],
    ['no route', problem(409, 'print_route_missing'), 'printing.errors.noRoute'],
    ['no ticket', problem(404, 'not_found'), 'printing.errors.notFound'],
    ['other', problem(500, 'internal_error'), 'printing.errors.default'],
    ['not an API error', new Error('x'), 'printing.errors.default'],
  ])('%s', (_name, error, key) => {
    expect(printErrorKey(error)).toBe(key);
  });
});
