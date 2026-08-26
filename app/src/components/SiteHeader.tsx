"use client";

import Link from "next/link";

import { SiteNav } from "@/components/SiteNav";
import { useT } from "@/lib/i18n-provider";

/*
 * Site header (DESIGN.md / EXPERIENCE.md): slim sticky bar on surface-base with
 * a hairline bottom rule. z-40 for the sticky bar (no ruled z-scale; kept
 * minimal, below the focused skip link's z-50). No accent-colored chrome.
 *
 * ⚠️ "NO PRIMARY NAV" IS SUPERSEDED. UX-DR4 ruled it out; **UX-DR24**
 * (`epics.md:143`, delivered by story 3.7) re-rules it, and story 3.10
 * implements that. The row is now: identity block → `<SiteNav />`.
 *
 * 🔴 `SiteNav` OWNS EVERYTHING AFTER THE IDENTITY BLOCK, AND THAT IS A
 * COMPOSITION RULING, NOT TIDINESS. At `≥xl` it renders the destinations, then
 * the search, then the ES|EN and theme toggles — so the row still reads
 * wordmark → search → ES|EN → theme, with the destinations inserted after the
 * identity block, and DOM order equals visual order equals reading order.
 * Below `xl` it renders ONE trigger, and those same three controls live inside
 * the sheet it opens.
 *
 * The alternative — leaving `<HeaderSearch />` and the toggles here and putting
 * only the nav in `SiteNav` — cannot produce that order with one element, and it
 * would need the toggles defined twice (once here for `≥xl`, once in the sheet).
 * One definition, one owner of the sheet's open state, one reading order.
 */

export function SiteHeader() {
  const t = useT();

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
         * ⚠️ THE ROW NO LONGER WRAPS ON PHONES AT ALL — STORY 3.10 INVERTED
         * IT. The caption (spec-sign-the-project) had widened the identity block
         * 76 -> 127 px in `es` and pushed the wrap threshold to ~341/337, so the
         * row wrapped on EVERY phone. UX-DR24 then replaced three row elements
         * (search + ES|EN + theme) with ONE 44 px trigger below `xl`, and the
         * threshold fell through the floor:
         *
         *   locale   one row (62 px) from   wraps (118 px) at
         *   es       215 px                 <= 214 px
         *   en       211 px                 <= 210 px
         *
         * Re-measured for THIS composition — headless Chromium against the built
         * export, 1 px sweep per locale, on the same basis 3.6 re-ran it. A
         * FIFTH element would have pushed the old threshold to ~406 px; taking
         * three away put it below 320 instead. That inversion is the whole
         * reason UX-DR24 chose a trigger that REPLACES rather than joins.
         *
         * PROVENANCE OF EVERY NUMBER, re-run for the nav:
         *
         *   · 320, 390 and 195 are MATRIX widths (320/390/195 x dark/light x
         *     es/en x 8 routes = 96 cells). Document overflow: 0 of 96 settled.
         *   · The thresholds are a separate 1 px sweep, per locale, 200-420.
         *
         *   width   header height          document scrollWidth
         *   195     118 (wraps)            195, no overflow
         *   320     62  (ONE ROW now)      320, no overflow
         *   390     62  (one row)          390, no overflow
         *   1280    62  (one row, inline)  1280, no overflow
         *
         * THEME IS NOT AN AXIS: dark and light reported identical heights in
         * every cell. The two LOCALES now agree on the VALUES (62/118) and
         * differ only in where they switch — which is why `--header-h` has no
         * locale axis. Do not add one without a value difference to justify it.
         *
         * 🔴 THE HEIGHT IS A SHARED CONTRACT WITH SEVEN CONSUMERS, AND THIS
         * STORY FIXED IT. The 2026-08-26 review counted seven where the comment
         * had said three. All of them now derive from `--spacing-header-h-*`:
         *
         *   · `globals.css`'s `scroll-padding-top`, now
         *     `calc(var(--header-h) + var(--spacing-scroll-clearance))`.
         *   · `CompareChartsSection`'s three offsets, now
         *     `top-[var(--header-h)]`, a token-derived `scroll-mt`, and a
         *     `rootMargin` READ from `getComputedStyle` rather than written.
         *   · `ExpertLayer.tsx`, `HubTable.tsx`, `LeaderboardsSection.tsx` and
         *     `TournamentHub.tsx` carry PROSE only, reasoning from
         *     "`scroll-padding-top` already clears the sticky header" — a
         *     sentence that is true again at every width. Their comments still
         *     name the old `4.5rem` constant; corrected by ledger note rather
         *     than edited here, since they are outside this story's paths.
         *
         * THE SKIP LINK IS FIXED WITH THEM. "Saltar al contenido" used to land
         * `#main-content` 46 px behind this bar at any wrapped width; the
         * reserved space tracks the bar now, so WCAG 2.4.11 (Focus Not
         * Obscured) holds — measured, not assumed. See the Dev Agent Record.
         */}
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-tile-gap px-gutter-mobile md:px-gutter-desktop">
          {/*
           * THE IDENTITY BLOCK: wordmark over authorship caption.
           *
           * THE CAPTION IS A SIBLING OF THE LINK, NEVER ITS CHILD. Inside the
           * anchor it would join the accessible name, so the first focusable
           * element IN THIS BANNER on all 1,406 routes would announce "WC Stats
           * Por Juan Camilo Rojas, link" — and narrowing that back with
           * `aria-label` fails WCAG 2.5.3 (Label in Name), which requires the
           * accessible name to CONTAIN the visible text, not a subset of it.
           * The link's purpose is the home page; authorship is not a link
           * purpose.
           *
           * ("in this banner", not "on the page": the skip link above is the
           * page's first focusable element and sits outside the <header> — see
           * its own comment. Corrected at the 2026-08-26 code review, where the
           * stronger claim appeared in four places and contradicted a comment
           * eight lines up. The 2.5.3 conclusion is unchanged either way: it
           * turns on the anchor's accessible name, not on its ordinal.)
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
           * EVERYTHING AFTER THE IDENTITY BLOCK (Story 3.10, UX-DR24).
           *
           * At `≥xl` `SiteNav` renders the destinations, then the header
           * search, then the ES|EN and theme toggles — so this row still reads
           * wordmark → search → ES|EN → theme, with the destinations inserted
           * after the identity block. Below `xl` it renders ONE trigger and puts
           * those same three controls inside the sheet it opens.
           *
           * The search KEEPS its `data-slot="header-search-slot"` and
           * `min-w-0 flex-1` on its own root, and there is still NO `aria-hidden`
           * anywhere on that path — Story 2.2's review removed it specifically
           * so 2.14 could mount focusable content inside. Do not reintroduce it.
           */}
          <SiteNav />
        </div>
      </header>
    </>
  );
}
