// Localised texts of the API (`I18nText`: language → text, e.g. map and zone
// names configured in the panel). Like the core, a missing language falls
// back to Italian, the source language, then to any text present.

export type I18nText = Readonly<Record<string, string>>;

/** The text in `locale` ("de-AT" uses "de"), else Italian, else the first non-empty one. */
export function localizedText(text: I18nText | undefined, locale: string): string {
  if (!text) return '';
  const base = locale.toLowerCase().split(/[-_]/)[0] ?? '';
  const pick = (k: string) => (text[k]?.trim() ? text[k] : undefined);
  return pick(base) ?? pick('it') ?? Object.values(text).find((v) => v.trim()) ?? '';
}
