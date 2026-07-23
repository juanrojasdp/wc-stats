"use client";

import Link from "next/link";

import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale, useT } from "@/lib/i18n-provider";
import { useTheme } from "@/lib/theme-provider";

/*
 * Site header (DESIGN.md / EXPERIENCE.md): slim sticky bar on surface-base
 * with a hairline bottom rule — wordmark → header-search slot → ES|EN
 * language toggle → theme toggle, in that order. No primary nav, no
 * accent-colored chrome. z-40 for the sticky bar (no ruled z-scale; kept
 * minimal, below the focused skip link's z-50).
 */

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
    </svg>
  );
}

export function SiteHeader() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <>
      {/* Skip link: first focusable element on every page (Accessibility Floor). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-3 focus:type-body focus:text-ink-primary"
      >
        {t("chrome.skipLink")}
      </a>
      <header className="sticky top-0 z-40 border-b border-hairline bg-surface-base">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-tile-gap px-gutter-mobile md:px-gutter-desktop">
          <Link href="/" className="flex min-h-11 items-center type-title text-ink-primary">
            {t("app.siteName")}
          </Link>
          {/*
           * Header-search slot — placement only; Story 2.14 owns all search
           * behavior (input, typeahead, <md icon-button collapse live here).
           */}
          <div data-slot="header-search-slot" className="min-w-0 flex-1" />
          <ToggleGroup
            type="single"
            value={locale}
            onValueChange={(value) => {
              // Radix reports "" when the active segment is re-clicked; the
              // active language cannot be deselected.
              if (value === "es" || value === "en") {
                setLocale(value);
              }
            }}
            aria-label={t("chrome.languageToggle.label")}
            className="rounded-full border border-hairline p-0.5"
          >
            <ToggleGroupItem
              value="es"
              aria-label={t("chrome.languageToggle.esFull")}
              className="min-h-11 min-w-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
            >
              {t("chrome.languageToggle.es")}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="en"
              aria-label={t("chrome.languageToggle.enFull")}
              className="min-h-11 min-w-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
            >
              {t("chrome.languageToggle.en")}
            </ToggleGroupItem>
          </ToggleGroup>
          {/*
           * Stable accessible name + aria-pressed (2.2 review decision): the
           * name never changes; pressed says whether the light theme is
           * active. The on-state accent fill is muted — quiet chrome, and a
           * permanently highlighted button would misread as "active tool".
           */}
          <Toggle
            pressed={!isDark}
            onPressedChange={(pressed) => setTheme(pressed ? "light" : "dark")}
            aria-label={t("chrome.themeToggle.label")}
            className="min-h-11 min-w-11 text-ink-secondary data-[state=on]:bg-transparent data-[state=on]:text-ink-secondary"
          >
            {isDark ? <MoonIcon /> : <SunIcon />}
          </Toggle>
        </div>
      </header>
    </>
  );
}
