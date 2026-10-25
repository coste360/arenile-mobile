// What a scanned QR or a typed code means for the check-in (phase 1
// "Operazioni"). Mirrors the core:
//
// - the QR of a booking (confirmation email, public page, printed receipt)
//   encodes "ARENILE:<booking code>" (internal/domain/notify/qr.go QRPayload);
// - the QR of a ticket (entry ticket or daily sale, internal/domain/ticketing)
//   encodes its gate token: 26 upper-case base32 characters (NewGateToken),
//   possibly inside a URL (NormalizeCode keeps the last path segment);
// - typed by the staff: a booking code, or today's ticket number ("37",
//   with or without a leading "#"), accepted by the gate only as a confirmed
//   manual entry.

/** Prefix of the booking QR payload (core notify.QRPayload). */
export const BOOKING_QR_PREFIX = 'ARENILE:';

const GATE_TOKEN = /^[A-Z2-7]{26}$/;
const TICKET_NUMBER = /^#?(\d{1,6})$/;
/** Booking codes are short readable series (core booking.NextCode); bounded like the API's `q`. */
const BOOKING_CODE = /^[A-Z0-9][A-Z0-9-]{1,99}$/;

export type ScannedCode =
  /** A booking QR or a typed booking code. */
  | { kind: 'booking'; code: string }
  /** The gate token of a ticket QR (entry ticket or daily sale). */
  | { kind: 'ticket'; token: string }
  /** Today's ticket number, typed (only a confirmed manual entry admits it). */
  | { kind: 'ticket_number'; number: number }
  /** Not an Arenile code. */
  | { kind: 'unknown' };

/**
 * Core ticketing.NormalizeCode: trims, keeps the last path segment of a URL
 * and upper-cases.
 */
export function normalizeCode(raw: string): string {
  let c = raw.trim();
  const slash = c.lastIndexOf('/');
  if (slash >= 0) c = c.slice(slash + 1);
  return c.trim().toUpperCase();
}

function bookingCodeOf(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase().startsWith(BOOKING_QR_PREFIX)) {
    const code = trimmed.slice(BOOKING_QR_PREFIX.length).trim().toUpperCase();
    return BOOKING_CODE.test(code) ? code : null;
  }
  return null;
}

/**
 * A scanned QR payload. Only the two Arenile formats are accepted: a QR of
 * anything else (a menu, a web page) is `unknown`, never looked up.
 */
export function parseScanned(payload: string): ScannedCode {
  const booking = bookingCodeOf(payload);
  if (booking) return { kind: 'booking', code: booking };
  const token = normalizeCode(payload);
  if (GATE_TOKEN.test(token)) return { kind: 'ticket', token };
  return { kind: 'unknown' };
}

/**
 * A code typed by the staff (QR unreadable, phone without camera): a booking
 * QR payload, a gate token, today's ticket number or a booking code.
 */
export function parseTyped(input: string): ScannedCode {
  const scanned = parseScanned(input);
  if (scanned.kind !== 'unknown') return scanned;
  const code = normalizeCode(input);
  const number = TICKET_NUMBER.exec(code);
  if (number) {
    const n = Number(number[1]);
    return n >= 1 ? { kind: 'ticket_number', number: n } : { kind: 'unknown' };
  }
  if (BOOKING_CODE.test(code)) return { kind: 'booking', code };
  return { kind: 'unknown' };
}
