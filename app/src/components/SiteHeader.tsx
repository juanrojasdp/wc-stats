"use client";

import Link from "next/link";

import { HeaderSearch } from "@/components/HeaderSearch";
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
        {/*
         * `flex-wrap` + `min-h-14`, NOT `h-14` — Story 2.19 Task 6.2 (R2/D8).
         *
         * MEASURED: this row's min-content is 237 CSS px (wordmark + search +
         * the ES|EN pair at 44 px each + the theme toggle at 44 + three gaps +
         * two gutters), so at a 195 px layout viewport — a 390 px device at
         * 200% zoom — it made the WHOLE DOCUMENT scroll sideways on all eight
         * routes, including /about, /glossary and /404, which have nothing else
         * in them. It is the universal floor the reflow matrix found.
         *
         * WRAPPING IS THE HONEST FIX AND THE ALTERNATIVES WERE MEASURED TOO.
         * Tightening the gap to 0.25rem buys 24 px and shrinking the gutter
         * another 8, which still leaves 205 > 195 and only reaches 195 by
         * truncating the site name. WCAG 1.4.10 asks content to REFLOW into
         * more rows, not to shrink: every touch target keeps its 44 px
         * (MIN_HIT_PX), the wordmark keeps its full text, and the row becomes
         * two rows only at widths where one row cannot fit.
         *
         * `min-h-14` rather than `h-14` so the height is unchanged at every
         * width that does not wrap.
         *
         * ⚠️ THE ROW NOW WRAPS ON SMALL PHONES TOO, NOT ONLY AT 195
         * (spec-sign-the-project). The authorship caption below widens the
         * identity block from 76 to 127 CSS px in `es` (122 in `en`) — flexbox
         * breaks lines on each item's MAX-CONTENT, so that extra width is spent
         * before any shrinking happens, and neither `min-w-0` nor letting the
         * caption wrap can buy it back.
         *
         * PROVENANCE OF EVERY NUMBER BELOW, because an earlier draft of this
         * comment attributed all of them to the 96-cell matrix and only three
         * widths are in it:
         *
         *   · 320, 390 and 195 are MATRIX widths (320/390/195 × dark/light ×
         *     es/en × 8 routes = 96 cells). Document overflow: 0 of 96.
         *   · The thresholds are a separate 1 px sweep, per locale.
         *   · 412 / 768 / 1440 / 1920 are separate spot measurements.
         *
         *   width          header before -> after     document scrollWidth
         *   195            107 -> 124 (already wrapped)  195, no overflow
         *   320            57  -> 118 (WRAPS)            320, no overflow
         *   412/768/1440/1920  57 -> 62 (one row)        no overflow
         *
         * THE THRESHOLD IS LOCALE-DEPENDENT and the two differ, because `Por`
         * is wider than `By`:
         *
         *   es  wraps at ≤ 341 px, one row from 342
         *   en  wraps at ≤ 337 px, one row from 338
         *
         * Do not collapse these to one number — the 96-cell run caught `/404`
         * in `en` sitting one row while `es` sat two at the same width, which
         * is exactly this gap.
         *
         * DOCUMENT OVERFLOW IS 0/96 AT EVERY MATRIX WIDTH, so WCAG 1.4.10 — the
         * thing R2/D8 actually fixed — is untouched. What changed is HEIGHT, and
         * it was a deliberate call: the signature stays visible at every width
         * rather than being hidden on small phones.
         *
         * 🔴 THE HEIGHT IS A SHARED CONTRACT, AND IT NOW HAS THREE CONSUMERS
         * THAT ENCODE 56 px. `globals.css`'s `scroll-padding-top: 4.5rem` says
         * in its own comment "change h-14 and this must follow", and
         * `CompareChartsSection` pins `sticky top-14`, `max-md:scroll-mt-28`
         * and a `rootMargin` of -104px to a 56 px bar. See `deferred-work.md`
         * — this is filed with measurements, not left to be re-found.
         */}
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-tile-gap px-gutter-mobile md:px-gutter-desktop">
          {/*
           * THE IDENTITY BLOCK: wordmark over authorship caption.
           *
           * THE CAPTION IS A SIBLING OF THE LINK, NEVER ITS CHILD. Inside the
           * anchor it would join the accessible name, so the FIRST focusable
           * element on all 1,406 routes would announce "WC Stats Por Juan
           * Camilo Rojas, link" — and narrowing that back with `aria-label`
           * fails WCAG 2.5.3 (Label in Name), which requires the accessible
           * name to CONTAIN the visible text, not a subset of it. The link's
           * purpose is the home page; authorship is not a link purpose.
           *
           * The `<Link>` KEEPS `min-h-11`. It is a header touch target and the
           * row comment above commits to every one of them holding 44 px
           * (MIN_HIT_PX, UX-DR15) through the wrap. Measured: the link's hit
           * box is 44 px tall at every width, and the caption sits flush under
           * the title (gap 0) at 12 px in ink-secondary. Its WIDTH tracks the
           * caption and is locale-dependent — 127 px in `es`, 122 in `en`.
           *
           * NO `lang` MARK on the name (WCAG 3.1.2 proper-name exemption; see
           * the `chrome.signature` note in es.ts for the full ruling).
           *
           * NO `justify-center` (review): this is a shrink-to-fit column whose
           * height is its content, so there is never free main-axis space to
           * distribute and the class was inert. `min-w-0` stays and is honest
           * about what it does — it does NOT prevent the wrap and never could,
           * because flex line breaking uses the hypothetical main size
           * (max-content), which `min-w-0` does not reduce. It governs how the
           * block yields once a line is already chosen.
           */}
          <div className="flex min-w-0 flex-col">
            <Link href="/" className="flex min-h-11 items-center type-title text-ink-primary">
              {t("app.siteName")}
            </Link>
            <span className="type-caption text-ink-secondary">{t("chrome.signature")}</span>
          </div>
          {/*
           * Header search (Story 2.14). It KEEPS this slot's `data-slot` and
           * `min-w-0 flex-1` on its own root — `min-w-0` is what lets the input
           * shrink inside this flex row, and without it the toggles are pushed
           * off a 320 px viewport.
           *
           * NO `aria-hidden` HERE. Story 2.2's review removed it specifically
           * for this story: "2.14 mounting search inside it would create
           * focusable-content-inside-aria-hidden". Do not reintroduce it.
           *
           * Element order is AC 1's and is unchanged: wordmark → search →
           * ES|EN → theme.
           */}
          <HeaderSearch />
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
