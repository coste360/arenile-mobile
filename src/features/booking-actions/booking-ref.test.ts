import { QueryClient } from '@tanstack/react-query';

import { estKeys } from '@/api/query-keys';
import {
  bookingDetail,
  bookingSummary,
  EST_ID,
  operationalBooking,
  operationsDay,
  spot,
} from '@/test/operations-fixtures';

import { findCachedBooking, refFromDetail, sameCode } from './booking-ref';

const byCode = (code: string) => (b: { code: string }) => sameCode(b.code, code);

describe('refFromDetail', () => {
  it('collects the spot labels of the lines once', () => {
    const line = bookingDetail().lines[0]!;
    const ref = refFromDetail(
      bookingDetail({
        lines: [line, { ...line, id: 'l-2' }, { ...line, id: 'l-3', spot_label: 'A2' }],
        notes_internal: 'Cliente abituale',
      }),
    );
    expect(ref).toMatchObject({
      id: 'b-1',
      code: 'AR-7K3Q9',
      spotLabels: ['A1', 'A2'],
      customerName: 'Rossi Mario',
      notesInternal: 'Cliente abituale',
      version: 3,
    });
  });
});

describe('findCachedBooking', () => {
  it('finds a booking of a cached day list by code, ignoring case', () => {
    const qc = new QueryClient();
    qc.setQueryData(estKeys.bookingsOfDay(EST_ID, '2026-10-25'), [
      bookingSummary({ id: 'b-2', code: 'AR-2M8X1', spot_labels: ['B4'] }),
    ]);
    expect(findCachedBooking(qc, EST_ID, byCode('ar-2m8x1'))).toMatchObject({
      id: 'b-2',
      spotLabels: ['B4'],
    });
  });

  it('falls back to the operations day, with every spot of the booking', () => {
    const qc = new QueryClient();
    const b = operationalBooking();
    qc.setQueryData(
      estKeys.operationsDay(EST_ID, '2026-10-25'),
      operationsDay({
        spots: [
          spot({ booking: b }),
          spot({ spot_id: 's-2', label: 'A2', booking: b }),
          spot({ spot_id: 's-3', label: 'A3', status: 'free' }),
        ],
      }),
    );
    expect(findCachedBooking(qc, EST_ID, byCode('AR-7K3Q9'))).toMatchObject({
      id: 'b-1',
      spotLabels: ['A1', 'A2'],
      balance_due: 2000,
    });
  });

  it('hides the name of an anonymized customer', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      estKeys.operationsDay(EST_ID, '2026-10-25'),
      operationsDay({
        spots: [spot({ booking: operationalBooking({ customer_anonymized: true }) })],
      }),
    );
    expect(findCachedBooking(qc, EST_ID, byCode('AR-7K3Q9'))?.customerName).toBe('');
  });

  it('never reads another establishment', () => {
    const qc = new QueryClient();
    qc.setQueryData(estKeys.bookingsOfDay('other', '2026-10-25'), [bookingSummary()]);
    qc.setQueryData(estKeys.operationsDay('other', '2026-10-25'), operationsDay());
    expect(findCachedBooking(qc, EST_ID, byCode('AR-7K3Q9'))).toBeUndefined();
  });
});
