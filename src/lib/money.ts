// Money, like the core's internal/money: integer cents of euro (the API's
// `Money` schema, int64). Logic only ever adds and compares integers; the
// conversion to a decimal happens here, at display time, through Intl.

/** An amount in integer cents of euro. */
export type Cents = number;

export const DEFAULT_MONEY_LOCALE = 'it-IT';
export const DEFAULT_CURRENCY = 'EUR';

/** True for a safe integer amount of cents. */
export function isCents(v: unknown): v is Cents {
  return typeof v === 'number' && Number.isSafeInteger(v);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, f);
  }
  return f;
}

/**
 * Formats integer cents for display: 1250 → "12,50 €" in Italian (the
 * source language of the amounts, spec 02 "Scheda prenotazione").
 * Throws on a non-integer amount: a float in money logic is a bug.
 */
export function formatCents(
  cents: Cents,
  { locale = DEFAULT_MONEY_LOCALE, currency = DEFAULT_CURRENCY } = {},
): string {
  if (!isCents(cents)) throw new TypeError('formatCents: amount must be integer cents');
  return formatter(locale, currency).format(cents / 100);
}

const AMOUNT = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;

/**
 * Parses an amount typed by the user ("12", "12,5", "12.50", "€ 12,50") into
 * integer cents, without going through a float. Thousands separators are not
 * accepted (ambiguous between "1.250" and "1,250"); null when invalid.
 */
export function parseCents(input: string): Cents | null {
  const s = input.replace(/€/g, '').replace(/\s/g, '');
  const m = AMOUNT.exec(s);
  if (!m) return null;
  const units = Number(m[1]);
  const fraction = (m[2] ?? '').padEnd(2, '0');
  return units * 100 + Number(fraction);
}
