import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { dictionaries } from "@/i18n/dictionary";

// Efface toute valeur persistée héritée afin que la détection se base
// UNIQUEMENT sur la langue du navigateur à chaque visite.
if (typeof window !== "undefined") {
  localStorage.removeItem("i18nextLng");
  document.cookie = "i18nextLng=; Max-Age=0; path=/";
  document.cookie = "i18next=; Max-Age=0; path=/";
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        "pt-BR": { translation: dictionaries["pt-BR"] },
        pt: { translation: dictionaries["pt-BR"] },
        en: { translation: dictionaries.en },
        "en-US": { translation: dictionaries.en },
        "en-GB": { translation: dictionaries.en },
        es: { translation: dictionaries.es },
        "es-ES": { translation: dictionaries.es },
        "es-419": { translation: dictionaries.es },
        fr: { translation: dictionaries.fr },
        "fr-FR": { translation: dictionaries.fr },
      },
      fallbackLng: "pt-BR",
      supportedLngs: [
        "pt-BR", "pt",
        "en", "en-US", "en-GB",
        "es", "es-ES", "es-419",
        "fr", "fr-FR",
      ],
      nonExplicitSupportedLngs: true,
      // Comme dans le projet React : strip la région (en-AU→en, fr-CA→fr)
      // pour que toute variante non listée resolve correctement.
      load: "languageOnly",
      // Les clés sont plates ("auth.login.redirecting"), le point
      // est littéral — PAS un séparateur de chemin.
      keySeparator: false,
      nsSeparator: false,
      detection: {
        // Détection uniquement via navigator.language — aucune persistance.
        order: ["navigator", "htmlTag"],
        caches: [],
      },
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;
