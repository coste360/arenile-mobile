// Display of API instants (RFC 3339 UTC) in the establishment time zone,
// like calendar dates: a payment at 09:30 in Rome reads 09:30 on every
// device, whatever the phone's own zone.

function safeFormat(options: Intl.DateTimeFormatOptions, locale: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(at);
  } catch {
    // Unknown zone: fall back to UTC, the zone of the API instants.
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(at);
  }
}

/** "25 ott, 09:30" (it) for an instant, in `timeZone` (UTC when unknown). */
export function formatInstant(iso: string, locale: string, timeZone: string | undefined): string {
  return safeFormat(
    {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timeZone || 'UTC',
    },
    locale,
    new Date(iso),
  );
}

/** "09:30" for an instant (or epoch milliseconds), in `timeZone` (UTC when unknown). */
export function formatTime(
  at: string | number,
  locale: string,
  timeZone: string | undefined,
): string {
  return safeFormat(
    { hour: '2-digit', minute: '2-digit', timeZone: timeZone || 'UTC' },
    locale,
    new Date(at),
  );
}

/** "domenica 25 ottobre" (it) for a calendar date "YYYY-MM-DD". */
export function formatLongDay(date: string, locale: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
