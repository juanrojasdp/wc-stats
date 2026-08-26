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
 * `SiteHeader` mounts `SiteNav`, which mounts `HeaderSearch` AND a second
 * search-index consumer for the sheet (Story 3.10) — both fetch the tournament
 * index on mount. A fetch that never settles keeps the search in its loading state
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
  /*
   * CLEAR STORAGE BETWEEN CASES (code review 2026-08-26). `LocaleProvider`'s
   * mount effect reads `STORAGE_KEYS.locale` and OVERRIDES `initialLocale`
   * when anything is stored (i18n-provider.tsx). Nothing in this file writes a
   * locale today, so every case below currently gets the locale it asked for —
   * but jsdom's storage is per-FILE, not per-case, so the first case that ever
   * clicks the ES|EN toggle would silently re-point every later `en` case at
   * the `es` dictionary. It would fail loudly rather than pass vacuously (the
   * assertions look up the dictionary they asked for), which is why this is
   * hygiene and not a bug fix — but the coupling is real and one line removes
   * it.
   */
  localStorage.clear();
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
       * approximate. The home link is the first focusable element INSIDE THE
       * BANNER on all 1,406 routes (the skip link precedes it and is outside
       * the <header> — SiteHeader.tsx); if the caption were inside it, every
       * route would announce "WC Stats Por Juan Camilo Rojas, link", and an
       * `aria-label` narrowing it back would fail WCAG 2.5.3 (Label in Name)
       * because the accessible name must CONTAIN the visible text, not a
       * subset of it.
       */
      const home = within(header).getByRole("link", { name: dictionary.app.siteName });
      expect(home).toHaveAttribute("href", "/");
      expect(home).toHaveAccessibleName(dictionary.app.siteName);
      /*
       * READ FROM THE DICTIONARY, NOT A LITERAL (code review 2026-08-26). This
       * was `not.toContain("Juan Camilo Rojas")`: rename the person in es.ts /
       * en.ts and it would keep passing while asserting nothing — the precise
       * vacuity class this change congratulates itself for catching in the
       * `/\bunderline\b/` regex. Asserting the WHOLE caption is also what makes
       * this case independent of `toHaveAccessibleName` above rather than a
       * strictly weaker restatement of it: the accessible-name check would
       * still pass if the caption joined the anchor as a visually-hidden node
       * that the name computation skipped.
       */
      expect(home.textContent).not.toContain(dictionary.chrome.signature);
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

      /*
       * THE 1.4.1 GUARD, PORTED HERE (code review 2026-08-26). This file was
       * created because build-gating is gap #1 — and then only the 2.5.3
       * assertion was carried across. The link-in-text-block guard, the one
       * whose predecessor was found VACUOUS (`/\bunderline\b/` matches
       * `hover:no-underline`), stayed behind in `static-output.test.ts` inside
       * `describe.skipIf(!anyBuilt)`. Measured at the review: 36 of that file's
       * 49 cases skip in a fresh worktree with no `out/`. So on any clone or CI
       * job that runs `npm test` without a prior `npm run build`, the guard
       * protecting a shipped axe fix evaluated NOTHING while the suite stayed
       * green — exactly the failure mode this file's header argues against.
       *
       * It also runs in `en` here, which the export can never reach (D17).
       */
      for (const link of [glossary, within(footer).getByRole("link", {
        name: dictionary.chrome.footer.aboutLink,
      })]) {
        for (const token of ["underline", "underline-offset-2", "hover:no-underline"]) {
          expect(
            [...link.classList],
            `"${link.textContent}" lost \`${token}\` — the ruled link-in-text-block treatment (WCAG 1.4.1, Story 2.19 Task 6.8)`
          ).toContain(token);
        }
      }
    });
  }

  /*
   * THE NAME CARRIES NO `lang` MARK, asserted on the rendered tree rather than
   * on the source. WCAG 3.1.2 exempts proper names outright, and Story 2.19
   * Task 6.13's precedent is that a mark must assert a language change that
   * ACTUALLY OCCURS — marking a Spanish-origin name `lang="en"` on an ES page
   * would claim English phonemes for it, which is worse than the unmarked
   * default rather than better.
   *
   * SCOPED TO THE CAPTION, AND RUN IN BOTH LOCALES (code review 2026-08-26).
   * This asserted `region.querySelectorAll("[lang]")` had length 0 across the
   * whole banner and contentinfo, in `es` only. Two defects, both real:
   *
   *   1. It said nothing about THE NAME — it forbade every `lang` attribute
   *      anywhere in the chrome, forever, which is not this story's to rule.
   *      Decision 13 (glossary.ts: "an English loanword inside Spanish copy
   *      ... carries lang='en'") applies to the header's own
   *      `chrome.languageToggle.enFull` ("English"), and story 3-10 is
   *      actively moving the search into a nav sheet inside this banner. A
   *      future CORRECT change would have failed a case whose name promises it
   *      is about the signature.
   *   2. It ran `es` only — inside a describe named "BOTH locales", in a file
   *      whose stated gap #2 is that the `en` render path was verified nowhere.
   *
   * Now: the caption's own element (and its ancestors up to the region) carry
   * no `lang`, in each locale. That is the property WCAG 3.1.2 is about, and it
   * leaves the rest of the chrome free.
   */
  for (const [locale, dictionary] of DICTIONARIES) {
    it(`marks the name with no \`lang\` attribute in either chrome surface — ${locale}`, () => {
      pinLanguage(locale);
      stubNeverSettlingFetch();
      render(
        <Wrapper locale={locale}>
          <div>
            <SiteHeader />
            <AttributionFooter />
          </div>
        </Wrapper>
      );
      for (const role of ["banner", "contentinfo"]) {
        const region = screen.getByRole(role);
        const caption = within(region).getByText(dictionary.chrome.signature);
        for (let node: HTMLElement | null = caption; node !== null; node = node.parentElement) {
          expect(
            node.hasAttribute("lang"),
            `${role}: \`lang\` on <${node.tagName.toLowerCase()}> marks the name (WCAG 3.1.2 exempts proper names)`
          ).toBe(false);
          if (node === region) break;
        }
      }
    });
  }
});

/*
 * ══════ THE COMPOSITION CHANGED UNDER THIS FILE — Task 8.4, discharged ══════
 *
 * (2026-08-26 code review.) Task 8.4 asked for two things: that the sibling
 * assertions still pass, and that the file be EXTENDED for the new composition.
 * Story 3.10's File List reasoned "nothing was weakened because nothing was
 * touched" — true of the first half, and not an answer to the second. The
 * subject changed underneath the file:
 *
 *   · `SiteHeader` no longer mounts `HeaderSearch` directly. It mounts
 *     `SiteNav`, which mounts `HeaderSearch` AND a second search index consumer
 *     of its own. The harness comment above still described the old shape.
 *
 *   · `SiteNav` calls `usePathname()`, and this file mounts it with NO
 *     `next/navigation` mock — so the hook resolves through a real
 *     `PathnameContext` that has no provider here and returns `null`. That is
 *     fed straight into `currentDestinationKey(pathname: string)`, a non-string
 *     against a typed parameter. It does not throw only because `.find()`
 *     misses. That is luck, not design, and it is worth pinning as the ambient
 *     condition these caption assertions actually run under.
 *
 * These cases exist so that a future change to either — a `usePathname()` that
 * starts throwing outside a router, or a nav that renders the caption's
 * neighbours differently — fails HERE, next to the WCAG 2.5.3 ruling it could
 * break, rather than somewhere downstream.
 */
describe("the header's new composition, as this file actually mounts it", () => {
  it("survives usePathname() returning null outside a router context", () => {
    pinLanguage("es");
    stubNeverSettlingFetch();

    // The assertion is that this renders at all: no provider, no mock, no throw.
    expect(() =>
      render(
        <Wrapper locale="es">
          <SiteHeader />
        </Wrapper>
      )
    ).not.toThrow();

    // And with no pathname there is no current route, in either presentation.
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("still puts the caption beside the wordmark, with the nav mounted (AC 6)", () => {
    pinLanguage("es");
    stubNeverSettlingFetch();
    render(
      <Wrapper locale="es">
        <SiteHeader />
      </Wrapper>
    );

    const caption = screen.getByText(es.chrome.signature);
    const wordmark = screen.getByRole("link", { name: es.app.siteName });

    /*
     * THE RULING, RESTATED AGAINST THE NEW NEIGHBOURS: the caption is a SIBLING
     * of the wordmark link, never its descendant. Inside the anchor it would
     * join the accessible name and fail WCAG 2.5.3. `SiteNav` now renders links
     * into this same header, so "the caption is not inside A link" is no longer
     * the same claim as "the caption is not inside THE wordmark link".
     */
    expect(wordmark).not.toContainElement(caption);
    expect(caption.closest("a")).toBeNull();
    expect(caption.parentElement).toBe(wordmark.parentElement);
  });

  it("mounts the nav's trigger inside the banner, not beside it", () => {
    pinLanguage("es");
    stubNeverSettlingFetch();
    render(
      <Wrapper locale="es">
        <SiteHeader />
      </Wrapper>
    );

    const trigger = screen.getByRole("button", { name: es.nav.trigger });
    expect(trigger.closest("header")).not.toBeNull();
  });
});
