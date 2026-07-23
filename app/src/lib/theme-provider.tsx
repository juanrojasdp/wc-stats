"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Theme } from "@/lib/bootstrap";
import { STORAGE_KEYS, writeStorage } from "@/lib/storage";

/*
 * Theme state lives in React Context — AD-10 allows Context only for locale
 * and theme; this and LocaleProvider are the only two. A plain two-state
 * toggle persisting the explicit choice is the ruled minimum: reverting to
 * the system preference is not required by the ACs.
 */
interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initial state matches the server-rendered canonical markup (dark). The
  // pre-paint script's verdict is synced from the <html> class on mount —
  // never re-derived from storage with second-guessed logic.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    // Post-hydration sync with the script's verdict: state cannot be
    // initialized from the DOM during render (SSG hydration mismatch), so
    // the one setState-in-effect is deliberate — same pattern as the AD-12
    // locale swap in i18n-provider.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(next);
    writeStorage(STORAGE_KEYS.theme, next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
