"use client";

import React, { createContext, useContext, useMemo } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "@/i18n/config"; // side-effect : initialise i18next
import type { SupportedLocale } from "@/i18n/locales";

type TranslateParams = Record<string, string | number>;

type I18nContextValue = {
  locale: SupportedLocale;
  t: (key: string, params?: TranslateParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

// Composant interne qui lit la langue depuis i18next (après détection navigateur).
function InnerProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: SupportedLocale;
}) {
  const { t, i18n: instance } = useTranslation();

  // Synchronise l'attribut lang du document avec la langue courante.
  React.useEffect(() => {
    document.documentElement.lang = instance.language;
  }, [instance.language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale: (instance.language as SupportedLocale) ?? initialLocale,
      t: (key: string, params?: TranslateParams) =>
        t(key, params as Record<string, unknown>) as string,
    }),
    [t, instance.language, initialLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: SupportedLocale;
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <InnerProvider initialLocale={initialLocale}>{children}</InnerProvider>
    </I18nextProvider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
