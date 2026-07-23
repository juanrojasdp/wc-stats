"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_LOCALE, t, type DictionaryKey, type Locale } from "@/lib/i18n";

/*
 * Locale state lives in React Context — AD-10 allows Context only for locale
 * and theme. The scaffold provider just holds a settable value; the toggle UI,
 * persistence wiring and pre-paint head script are Story 2.2.
 */
interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context === null) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}

/** Client-side `t()` bound to the active locale from context. */
export function useT(): (key: DictionaryKey) => string {
  const { locale } = useLocale();
  return useMemo(() => (key: DictionaryKey) => t(key, locale), [locale]);
}
