// Essential reports (spec 04, phase 3): the core's year comparison for a day
// or a week. One request gives takings, occupancy and bookings of the period
// and of the previous year, with the same date bases as the panel's summary
// (stay for occupancy and bookings, business date for takings).
//
// Online only: report keys are not in the offline allowlist
// (features/offline/persist.ts), since reports are not operational data
// (core spec 21.2) and would only grow the saved cache.
import { useQuery } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { UnexpectedResponseError } from '@/api/errors';
import { estKeys } from '@/api/query-keys';
import type { ComparisonAlign, YearComparisonReport } from '@/api/types';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';

import type { ReportPeriod } from './period';

/** Reports move slowly compared with the desk: refetched after five minutes. */
export const REPORT_STALE_MS = 5 * 60_000;

export interface ComparisonParams extends ReportPeriod {
  align: ComparisonAlign;
}

/**
 * GET reports/comparison with a daily series, against the previous year
 * (the server default for compare_year). Permission reports.read.
 */
export async function fetchYearComparison(
  client: ApiClient,
  establishmentId: string,
  { from, to, align }: ComparisonParams,
): Promise<YearComparisonReport> {
  // The contract also lists the CSV and XLSX exports of the same operation;
  // the app asks for JSON only, anything else is an unexpected answer.
  const report = await request(() =>
    client.GET('/api/admin/v1/establishments/{establishmentId}/reports/comparison', {
      params: {
        path: { establishmentId },
        query: { from, to, granularity: 'day', align, format: 'json' },
      },
    }),
  );
  if (typeof report !== 'object' || report === null) throw new UnexpectedResponseError(200);
  return report;
}

export const yearComparisonQuery = (
  client: ApiClient,
  establishmentId: string,
  params: ComparisonParams,
) => ({
  queryKey: estKeys.reportComparison(establishmentId, params),
  queryFn: () => fetchYearComparison(client, establishmentId, params),
  staleTime: REPORT_STALE_MS,
});

/** The year comparison of a period; pass enabled=false when the role cannot read reports. */
export function useYearComparison(params: ComparisonParams, { enabled = true } = {}) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery({ ...yearComparisonQuery(client, establishmentId, params), enabled });
}
