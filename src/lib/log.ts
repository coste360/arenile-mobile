// Logging helpers. Logs never carry payloads: no tokens, emails, phone
// numbers or server answers, only a fixed message and the kind of error.

/** The kind of a caught value ("TypeError", "string"...), safe to log. */
export function errorKind(e: unknown): string {
  return e instanceof Error ? e.name : typeof e;
}
