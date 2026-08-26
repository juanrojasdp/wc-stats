// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttributionFooter } from "@/components/AttributionFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LocaleProvider } from "@/lib/i18n-provider";
import { ThemeProvider } from "@/lib/theme-provider";
import { en } from "@/locales/en";
import { es } from "@/locales/es";

/*
 * ══════════ THE AUTHORSHIP CAPTION, RENDERED (spec-sign-the-project) ══════════
 *
 * WHY THIS FILE EXISTS AND `static-output.test.ts` IS NOT ENOUGH. Two gaps, both
 * raised at the adversarial review, and both real:
 *
 *   1. THE EXPORTED-HTML GUARD IS BUILD-GATED. Its whole describe sits behind
 *      `describe.skipIf(!anyBuilt)`, so on a clean clone or any CI job that runs
 *      `npm test` without a prior `npm run build`, the WCAG 2.5.3 sibling ruling
 *      — the single most load-bearing decision in this change — is enforced by
 *      NOTHING and the suite is still green. "0 skipped" was a property of one
 *      machine's state, not of the guard. This file has no such gate.
 *   2. THE `en` RENDER PATH WAS UNVERIFIED ANYWHERE. `output: "export"` emits
 *      Spanish only (D17), so the exported HTML can never see English. English
 *      is reached exclusively through the client locale toggle, and
 *      `i18n.test.ts` pins the STRING, not that it reaches the DOM. A
 *      conditional, a memoised `t`, or a hydration branch that dropped the
 *      caption in `en` only would have been invisible to the entire suite.
 *
 * The harness facts `HeaderSearch.test.tsx` documents apply here verbatim: RTL
 * auto-cleanup does NOT run without `globals: true`, so `cleanup()` is explicit;
 * the global environment stays "node" and the pragma above is per-file; and `t`
 * from `@/lib/i18n` is barred inside `src/components/**`, so expected strings
 * come from the dictionaries directly.
 */

/*
 * `SiteHeader` mounts `HeaderSearch`, which fetches the tournament index on
 * mount. A fetch that never settles keeps the search in its loading state
 * forever, which is exactly what these assertions want: the caption is not
 * downstream of search data, and letting a real payload resolve would add a
 * timing dependency to a test about a static string.
 */
function stubNeverSettlingFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {}))
  );
}

/**
 * Story 3.5 — `LocaleProvider` now detects the locale from
 * `navigator.language` when nothing is persisted, and jsdom's default is
 * "en-US". These cases are generated from `DICTIONARIES`, so the pin has to be
 * per-locale rather than file-wide: each `it` states the browser it assumes,
 * including the Spanish ones that used to agree with the ambient default only
 * by accident.
 */
function pinLanguage(locale: "es" | "en"): void {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(
    locale === "en" ? "en-GB" : "es-CO"
  );
}

function Wrapper({ children, locale }: { children: ReactNode; locale: "es" | "en" }) {
  return (
    <ThemeProvider>
      <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
    </ThemeProvider>
  );
}

const DICTIONARIES = [
  ["es", es],
  ["en", en],
] as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the authorship caption renders in BOTH locales", () => {
  for (const [locale, dictionary] of DICTIONARIES) {
    it(`puts it under the wordmark as a SIBLING of the home link — ${locale}`, () => {
      pinLanguage(locale);
      stubNeverSettlingFetch();
      render(
        <Wrapper locale={locale}>
          <SiteHeader />
        </Wrapper>
      );

      const header = screen.getByRole("banner");
      expect(within(header).getByText(dictionary.chrome.signature)).toBeInTheDocument();

      /*
       * THE 2.5.3 RULING, ASSERTED ON THE ACCESSIBLE NAME ITSELF rather than on
       * markup shape — this is what the exported-HTML adjacency regex can only
       * approximate. The home link is the first focusable element on all 1,406
       * routes; if the caption were inside it, every route would announce
       * "WC Stats Por Juan Camilo Rojas, link", and an `aria-label` narrowing it
       * back would fail WCAG 2.5.3 (Label in Name) because the accessible name
       * must CONTAIN the visible text, not a subset of it.
       */
      const home = within(header).getByRole("link", { name: dictionary.app.siteName });
      expect(home).toHaveAttribute("href", "/");
      expect(home).toHaveAccessibleName(dictionary.app.siteName);
      expect(home.textContent).not.toContain("Juan Camilo Rojas");
    });

    it(`renders it once in the footer, below the attribution — ${locale}`, () => {
      pinLanguage(locale);
      render(
        <Wrapper locale={locale}>
          <AttributionFooter />
        </Wrapper>
      );

      const footer = screen.getByRole("contentinfo");
      expect(within(footer).getAllByText(dictionary.chrome.signature)).toHaveLength(1);

      /*
       * ORDER IS THE POINT. The ruled attribution and its two links must come
       * FIRST — the sign-off reads last, and nothing may come between those
       * links and the running text they sit in (Story 2.19 Task 6.8).
       */
      const signature = within(footer).getByText(dictionary.chrome.signature);
      const glossary = within(footer).getByRole("link", {
        name: dictionary.chrome.footer.glossaryLink,
      });
      expect(
        glossary.compareDocumentPosition(signature) & Node.DOCUMENT_POSITION_FOLLOWING,
        "the signature must follow the footer links, not split them from their paragraph"
      ).toBeTruthy();
    });
  }

  /*
   * THE NAME CARRIES NO `lang` MARK, asserted on the rendered tree rather than
   * on the source. WCAG 3.1.2 exempts proper names outright, and Story 2.19
   * Task 6.13's precedent is that a mark must assert a language change that
   * ACTUALLY OCCURS — marking a Spanish-origin name `lang="en"` on an ES page
   * would claim English phonemes for it, which is worse than the unmarked
   * default rather than better.
   */
  it("marks the name with no `lang` attribute in either chrome surface", () => {
    pinLanguage("es");
    stubNeverSettlingFetch();
    render(
      <Wrapper locale="es">
        <div>
          <SiteHeader />
          <AttributionFooter />
        </div>
      </Wrapper>
    );
    for (const role of ["banner", "contentinfo"]) {
      const region = screen.getByRole(role);
      expect(region.querySelectorAll("[lang]"), `${role} must carry no lang marks`).toHaveLength(0);
    }
  });
});
