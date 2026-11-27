import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: { translation: {} },
  "pt-BR": { translation: {} },
  fr: { translation: {} },
  es: { translation: {} },
};

const browserLang = navigator.language;
const lang = browserLang.startsWith("pt")
  ? "pt-BR"
  : browserLang.startsWith("fr")
  ? "fr"
  : browserLang.startsWith("es")
  ? "es"
  : "en";

i18n.use(initReactI18next).init({
  resources,
  lng: lang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
