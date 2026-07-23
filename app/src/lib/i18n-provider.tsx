"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { localeClass, resolveLocale } from "@/lib/bootstrap";
import { DEFAULT_LOCALE, t, type DictionaryKey, type Locale } from "@/lib/i18n";
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage";

/*
 * Locale state lives in React Context — AD-10 allows Context only for locale
 * and theme. State initializes to `es` (matching the server markup) and is
 * corrected from storage in a mount effect: the single post-hydration string
 * swap (AD-12). Storage is never read during render.
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
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    // Restoring a persisted preference is not a user action: no announcement,
    // no re-persist. This is the AD-12 single post-hydration swap: state
    // cannot be initialized from storage during render (SSG hydration
    // mismatch), so the one setState-in-effect is deliberate. Nothing stored
    // means nothing to restore — initialLocale stands.
    const stored = readStorage(STORAGE_KEYS.locale);
    if (stored === null) {
      return;
    }
    const next = resolveLocale(stored);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(next);
    // Normally a no-op re-assertion of the pre-paint script's verdict; it
    // matters when the script did not run (e.g. blocked by a future CSP), so
    // <html lang> can never disagree with the rendered strings.
    const root = document.documentElement;
    root.lang = next;
    root.classList.remove(localeClass("es"), localeClass("en"));
    root.classList.add(localeClass(next));
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStorage(STORAGE_KEYS.locale, next);
    const root = document.documentElement;
    root.lang = next;
    root.classList.remove(localeClass("es"), localeClass("en"));
    root.classList.add(localeClass(next));
    // Announced in the TARGET language (WCAG 4.1.3): the string comes from
    // the dictionary being switched to.
    setAnnouncement(t("a11y.localeAnnouncement", next));
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <LocaleContext.Provider value={value}>
      {children}
      {/* Persistent polite live region for the language-toggle announcement. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </LocaleContext.Provider>
  );
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
