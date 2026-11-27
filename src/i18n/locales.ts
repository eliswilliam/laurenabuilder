export const SUPPORTED_LOCALES = ["pt-BR", "en", "es", "fr"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "pt-BR";

const LOWERCASE_MAP: Record<string, SupportedLocale> = {
  "pt": "pt-BR",
  "pt-br": "pt-BR",
  "en": "en",
  "en-us": "en",
  "en-gb": "en",
  "es": "es",
  "es-es": "es",
  "es-419": "es",
  "fr": "fr",
  "fr-fr": "fr",
};

function cleanLocaleTag(input: string): string {
  return input.trim().replace("_", "-").toLowerCase();
}

export function normalizeLocale(input?: string | null): SupportedLocale {
  if (!input) return DEFAULT_LOCALE;

  const clean = cleanLocaleTag(input);
  if (LOWERCASE_MAP[clean]) {
    return LOWERCASE_MAP[clean];
  }

  const primary = clean.split("-")[0];
  if (primary && LOWERCASE_MAP[primary]) {
    return LOWERCASE_MAP[primary];
  }

  return DEFAULT_LOCALE;
}

export function detectLocaleFromNavigator(): SupportedLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const clean = cleanLocaleTag(candidate);
    if (LOWERCASE_MAP[clean]) return LOWERCASE_MAP[clean];
    const primary = clean.split("-")[0];
    if (primary && LOWERCASE_MAP[primary]) return LOWERCASE_MAP[primary];
  }

  return DEFAULT_LOCALE;
}

export function detectLocaleFromAcceptLanguage(
  acceptLanguage?: string | null
): SupportedLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const entries = acceptLanguage
    .split(",")
    .map((raw) => {
      const [tagPart, qPart] = raw.trim().split(";");
      const qRaw = qPart?.trim().startsWith("q=")
        ? Number(qPart.trim().slice(2))
        : 1;
      const q = Number.isFinite(qRaw) ? qRaw : 1;

      return { tag: tagPart?.trim(), q };
    })
    .filter((item) => Boolean(item.tag))
    .sort((a, b) => b.q - a.q);

  for (const entry of entries) {
    const clean = cleanLocaleTag(entry.tag ?? "");
    if (LOWERCASE_MAP[clean]) return LOWERCASE_MAP[clean];
    const primary = clean.split("-")[0];
    if (primary && LOWERCASE_MAP[primary]) return LOWERCASE_MAP[primary];
  }

  return DEFAULT_LOCALE;
}
