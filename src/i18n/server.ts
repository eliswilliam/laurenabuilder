import { translate } from "@/i18n/dictionary";
import {
  detectLocaleFromAcceptLanguage,
  type SupportedLocale,
} from "@/i18n/locales";

export function getRequestLocale(request: Request): SupportedLocale {
  // Toujours lire Accept-Language — aucun cookie de langue.
  return detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
}

export function getServerTranslator(request: Request) {
  const locale = getRequestLocale(request);
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
  };
}
