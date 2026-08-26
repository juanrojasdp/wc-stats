// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteNav } from "@/components/SiteNav";
import { LocaleProvider } from "@/lib/i18n-provider";
import { NAV_DESTINATIONS } from "@/lib/nav-destinations";
import { ThemeProvider } from "@/lib/theme-provider";
import { resetTournamentIndexCache } from "@/lib/tournament-index";
import { en } from "@/locales/en";
import { es } from "@/locales/es";

/*
 * ═══════════ THE NAVIGATION MENU, RENDERED — Story 3.10 (AC 1, AC 5) ═════════
 *
 * The harness facts `HeaderSearch.test.tsx` documents apply here verbatim and
 * are not restated: RTL auto-cleanup does NOT run without `globals: true`, so
 * `cleanup()` is explicit; the global environment stays "node" and the pragma
 * above is per-file; Radix Dialog needs jsdom stubs it does not ship; `t` from
 * `@/lib/i18n` is barred inside `src/components/**`, so expected strings come
 * from the dictionaries directly; and jsdom does not navigate, so every
 * assertion here is on a RESOLVED HREF rather than on a location change.
 *
 * 🔴 BOTH PRESENTATIONS ARE IN THE DOM AT ONCE, AND THAT IS RULING 4, NOT A BUG
 * (D3). Which one a reader gets is decided by `hidden` / `xl:` — CSS, never a JS
 * media query — because `SiteHeader` is pre-rendered into 1,406 HTML files and a
 * JS breakpoint would emit the narrow form on the server and hydrate wide.
 * jsdom applies no stylesheet, so BOTH are queryable here and `hidden`'s real
 * effect (removing a subtree from the accessibility tree, so exactly one nav is
 * ever exposed) is invisible to this file. Every assertion below is therefore
 * SCOPED to one presentation by its `data-slot`. A bare `getByRole("link")` in
 * this file would find each destination twice and would be testing nothing.
 *
 * WHAT THIS FILE CANNOT DO, stated rather than papered over: jsdom implements no
 * layout, so it cannot measure the 44 px targets, the reflow, or the `≥xl` fit.
 * It asserts the CLASSES that carry them; the pixels are measured in the browser
 * harness and recorded in the story's Dev Agent Record. A jsdom test that
 * pretended to measure would be worse than this one.
 */

const SRC = path.join(process.cwd(), "src");

/*
 * Scoped by `data-slot`, the house identity attribute (`ui/dialog.tsx`,
 * `header-search-slot`) — NOT `data-testid`, which would ship a test-only
 * affordance into the chrome of 1,406 pre-rendered routes.
 */
function slot(name: string): HTMLElement {
  const found = document.querySelector(`[data-slot="${name}"]`);
  if (found === null) {
    throw new Error(`no [data-slot="${name}"] in the document`);
  }
  return found as HTMLElement;
}

/** The `≥xl` presentation. Both are in the DOM at once — see the note above. */
function inlineNav(): HTMLElement {
  return slot("site-nav-inline");
}

/** The `<xl` presentation's one control. */
function trigger(): HTMLElement {
  return slot("site-nav-trigger");
}

function installDialogStubs(): void {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
}

/*
 * `SiteNav` mounts the header search, which fetches the tournament index on
 * first engagement. A fetch that never settles holds it in `loading` forever,
 * which is exactly what a test about nav structure wants — the alternative is a
 * timing dependency on a payload none of these assertions read.
 */
function stubNeverSettlingFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {}))
  );
}

/**
 * Story 3.5 — `LocaleProvider` detects the locale from `navigator.language`
 * when nothing is persisted, and jsdom's default is "en-US". Every case here
 * states the browser it assumes rather than agreeing with the ambient default
 * by accident.
 */
function pinLanguage(locale: "es" | "en"): void {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(
    locale === "en" ? "en-GB" : "es-CO"
  );
}

/*
 * `usePathname` is NEW TO THIS TREE (D12) — story 3.10 introduces the first use,
 * so there is no house mocking convention to match. The whole module is mocked
 * because `next/navigation`'s client hooks need a Next router context that no
 * render test here provides.
 *
 * 🔴 EVERY VALUE ASSIGNED TO THIS MUST CARRY A TRAILING SLASH (2026-08-26
 * code review), AND THAT IS THE WHOLE LESSON OF THE BUG IT MISSED. A mock is a
 * claim about what the real thing produces. This one claimed `usePathname()`
 * returns `/compare` — it does not, and cannot: `next.config.ts` sets
 * `trailingSlash: true` and Next 16 derives the value from `location.href`
 * without normalising. So the suite asserted `aria-current` against an input the
 * app is incapable of producing, went green, and shipped a nav where the current
 * page was marked on exactly one route out of four. Slash-less literals here are
 * not a shortcut; they are a false premise.
 */
let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function Harness({ children, locale }: { children: ReactNode; locale: "es" | "en" }) {
  // `useT()` THROWS outside both providers, so every render needs both.
  return (
    <ThemeProvider>
      <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
    </ThemeProvider>
  );
}

function renderNav(locale: "es" | "en" = "es") {
  pinLanguage(locale);
  stubNeverSettlingFetch();
  return render(
    <Harness locale={locale}>
      <SiteNav />
    </Harness>
  );
}

beforeEach(() => {
  installDialogStubs();
  resetTournamentIndexCache();
  pathname = "/";
  /*
   * 🔴 CLEAR THE STORED LOCALE, OR THE CASES LEAK INTO EACH OTHER. `setLocale`
   * WRITES the choice (`STORAGE_KEYS.locale`), and story 3.5's precedence reads
   * a stored CHOICE ahead of `navigator.language` and ahead of `initialLocale`.
   * So the case below that switches to English inside the sheet left every LATER
   * case running in English, and they failed looking for Spanish names — a test
   * ordering artefact that reads exactly like a component bug. jsdom gives each
   * FILE a fresh localStorage, never each test.
   */
  window.localStorage.clear();
});

afterEach(() => {
  // Harness fact 1 — without this the DOM leaks into the next test.
  cleanup();
  // These restore DIFFERENT things: the first undoes `vi.stubGlobal`, the
  // second undoes the `navigator.language` spy. Both are needed.
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetTournamentIndexCache();
});

const DICTIONARIES = [
  ["es", es],
  ["en", en],
] as const;

describe("D6 — the trigger's ARIA, and why `aria-controls` is conditional", () => {
  for (const [locale, dictionary] of DICTIONARIES) {
    it(`carries a stable accessible name with the state on aria-expanded — ${locale}`, async () => {
      const user = userEvent.setup({ delay: null });
      renderNav(locale);

      const button = trigger();
      expect(button).toHaveAccessibleName(dictionary.nav.trigger);
      expect(button).toHaveAttribute("aria-expanded", "false");

      await user.click(button);

      /*
       * THE NAME DOES NOT CHANGE ON OPEN. `aria-expanded` carries the state, as
       * the shipped theme toggle already does with `aria-pressed`. Swapping in a
       * "Cerrar menú" would make the same control announce as two different
       * things depending on when it is met.
       */
      expect(button).toHaveAccessibleName(dictionary.nav.trigger);
      expect(button).toHaveAttribute("aria-expanded", "true");
    });
  }

  it("omits aria-controls entirely while closed, and points it at the sheet once open", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    /*
     * 🔴 THE CONDITIONAL FORM IS THE POINT. `DialogContent` portals to
     * `document.body` and is ABSENT while closed, so an unconditional
     * `aria-controls` would be a dangling IDREF — an axe `aria-valid-attr-value`
     * failure on the site header of every one of 1,406 routes. Four of the seven
     * `aria-controls` sites in this tree already take this form for this reason.
     */
    expect(trigger()).not.toHaveAttribute("aria-controls");

    await user.click(trigger());

    const controls = trigger().getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    // It must resolve to a node that is actually in the document.
    expect(document.getElementById(controls ?? "")).not.toBeNull();
    expect(screen.getByRole("dialog")).toHaveAttribute("id", controls);
  });
});

describe("D4 / D5 — the sheet is a named modal dialog, and NOT a menu", () => {
  for (const [locale, dictionary] of DICTIONARIES) {
    it(`opens a role="dialog" carrying the sheet title as its name — ${locale}`, async () => {
      const user = userEvent.setup({ delay: null });
      renderNav(locale);

      await user.click(trigger());

      const sheet = screen.getByRole("dialog");
      /*
       * Radix sets `aria-labelledby` only when a Title is present; without one
       * the panel is an unnamed role="dialog" — an axe `aria-dialog-name`
       * failure AND a Radix console error, which breaches the zero-console bar
       * on its own. The Title is `asChild` into an sr-only span so it stays out
       * of the route's heading outline.
       */
      expect(sheet).toHaveAccessibleName(dictionary.nav.sheetTitle);
      expect(dictionary.nav.sheetTitle).not.toBe(dictionary.nav.trigger);
    });
  }

  it("holds a <nav> landmark over a list of links — never role=menu", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    await user.click(trigger());
    const sheet = screen.getByRole("dialog");

    /*
     * These are links to pages, not commands. `role="menu"` would impose
     * arrow-key-only navigation and break the reading-order tab model UX-DR15
     * rules, so the sheet is a labelled region holding a landmark and a list.
     */
    expect(within(sheet).queryByRole("menu")).toBeNull();
    expect(within(sheet).queryAllByRole("menuitem")).toHaveLength(0);

    const landmark = within(sheet).getByRole("navigation");
    expect(landmark).toHaveAccessibleName(es.nav.landmark);
    expect(within(landmark).getByRole("list")).toBeInTheDocument();
  });

  it("returns focus to the trigger when Esc closes it", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    await user.click(trigger());
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    // Focus-return is Radix's, taken rather than re-derived (D4) — but if the
    // sheet were ever hand-rolled this is the assertion that would catch it.
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes from its own close control, which is named and not a bare glyph", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    await user.click(trigger());
    const sheet = screen.getByRole("dialog");
    const close = within(sheet).getByRole("button", { name: es.nav.close });

    await user.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("D1 — only available destinations render, in the ruled order", () => {
  const AVAILABLE = NAV_DESTINATIONS.filter((destination) => destination.available);
  const UNAVAILABLE = NAV_DESTINATIONS.filter((destination) => !destination.available);

  for (const [locale, dictionary] of DICTIONARIES) {
    it(`renders the four available destinations inline, in order — ${locale}`, () => {
      renderNav(locale);

      const links = within(inlineNav()).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual(
        AVAILABLE.map((destination) => {
          const key = destination.key as keyof typeof dictionary.nav.destinations;
          return dictionary.nav.destinations[key];
        })
      );
    });
  }

  it("renders the same four in the sheet, in the same order", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    await user.click(trigger());
    const sheet = screen.getByRole("dialog");
    const landmark = within(sheet).getByRole("navigation");

    expect(within(landmark).getAllByRole("link").map((link) => link.textContent)).toEqual(
      AVAILABLE.map((destination) => {
        const key = destination.key as keyof typeof es.nav.destinations;
        return es.nav.destinations[key];
      })
    );
  });

  it("renders NO link to a route story 3.9 has not minted, in EITHER presentation", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();
    await user.click(trigger());

    /*
     * The pre-3.9 ruling, asserted where a reader would actually meet it. Five
     * of the nine destinations have no route on `main`; linking them would ship
     * a 404 into the site chrome of all 1,406 pages. `nav-destinations.test.ts`
     * binds the FLAG to the filesystem; this binds the RENDER to the flag.
     */
    for (const destination of UNAVAILABLE) {
      const key = destination.key as keyof typeof es.nav.destinations;
      expect(
        screen.queryAllByRole("link", { name: es.nav.destinations[key] }),
        `"${es.nav.destinations[key]}" rendered, but ${destination.route} does not exist yet.`
      ).toHaveLength(0);
    }
  });

  it("puts no id on any nav link — 1,406 routes carry both presentations (D3)", () => {
    renderNav();
    for (const link of within(inlineNav()).getAllByRole("link")) {
      expect(
        link.getAttribute("id"),
        "Both presentations are in every route's DOM, so an id here would be a " +
          "duplicate-id defect on 1,406 pages. `aria-current` duplicating is harmless; " +
          "an id is not."
      ).toBeNull();
    }
  });
});

describe("D12 — the current route, marked exactly once and never inferred", () => {
  it("marks the destination whose route the reader is on", () => {
    pathname = "/glossary/";
    renderNav();

    const marked = within(inlineNav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent(es.nav.destinations.glossary);
  });

  it("marks it in the sheet too, so the two presentations agree", async () => {
    const user = userEvent.setup({ delay: null });
    pathname = "/compare/";
    renderNav();

    await user.click(trigger());
    const landmark = within(screen.getByRole("dialog")).getByRole("navigation");
    const marked = within(landmark)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent(es.nav.destinations.compare);
  });

  it("marks NOTHING on a profile route — a profile is not its index", () => {
    /*
     * 🔴 EXACT MATCH ONLY. `/players/ramirez-julian-mex` must not mark
     * *Jugadores*, and once 3.9 mints `/players` it still must not: telling a
     * screen reader the reader is on the players index when they are on one
     * player's profile is a false statement about where they are.
     */
    pathname = "/players/ramirez-julian-mex/";
    renderNav();

    const marked = within(inlineNav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(marked).toHaveLength(0);
  });

  it("marks the home link on `/` and not on a match route", () => {
    pathname = "/";
    const { unmount } = renderNav();
    expect(
      within(inlineNav())
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page")
    ).toHaveLength(1);
    unmount();
    cleanup();

    pathname = "/matches/arg-mex-2026-06-11/";
    renderNav();
    expect(
      within(inlineNav())
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page")
    ).toHaveLength(0);
  });

  it("does not mark the current route by colour alone (1.4.1)", () => {
    pathname = "/glossary/";
    renderNav();

    const marked = within(inlineNav())
      .getAllByRole("link")
      .find((link) => link.getAttribute("aria-current") === "page");
    /*
     * Inline: underlined. The sheet uses a lime marker PLUS font-semibold.
     *
     * 🔴 CLASS MEMBERSHIP, NOT `/\bunderline\b/` (2026-08-26 code review). A
     * hyphen is a non-word character, so that regex matched
     * `underline-offset-[5px]` on its own — deleting the actual `underline`
     * class while keeping the offset left this 1.4.1 assertion GREEN, which is
     * precisely the state it exists to forbid. Split on whitespace and look for
     * the class itself.
     */
    expect(marked?.className.split(/\s+/)).toContain("underline");
  });
});

describe("AC 5 — the chrome the sheet absorbed still works, and is reachable", () => {
  it("puts the language and theme controls inside the sheet", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    await user.click(trigger());
    const sheet = screen.getByRole("dialog");

    expect(
      within(sheet).getByRole("radiogroup", { name: es.chrome.languageToggle.label })
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: es.chrome.themeToggle.label })
    ).toBeInTheDocument();
  });

  it("switches the language from inside the sheet", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav("es");

    await user.click(trigger());
    const sheet = screen.getByRole("dialog");

    await user.click(within(sheet).getByRole("radio", { name: es.chrome.languageToggle.enFull }));

    // The sheet's own title is re-read from the dictionary, so the switch
    // reaching the DOM is observable without leaving the panel.
    expect(screen.getByRole("dialog")).toHaveAccessibleName(en.nav.sheetTitle);
  });

  it("toggles the theme from inside the sheet", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    await user.click(trigger());
    const themeToggle = within(screen.getByRole("dialog")).getByRole("button", {
      name: es.chrome.themeToggle.label,
    });
    const before = themeToggle.getAttribute("aria-pressed");

    await user.click(themeToggle);

    expect(
      within(screen.getByRole("dialog"))
        .getByRole("button", { name: es.chrome.themeToggle.label })
        .getAttribute("aria-pressed")
    ).not.toBe(before);
  });

  it("puts the search field at the top of the sheet, as its first combobox", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    await user.click(trigger());
    const sheet = screen.getByRole("dialog");

    // UX-DR24 absorbs the header search INTO the sheet; below xl this is the
    // only search there is, so it must actually be here.
    expect(within(sheet).getByRole("combobox")).toBeInTheDocument();
  });
});

describe("AC 5 — every target holds 44 px (UX-DR15, MIN_HIT_PX)", () => {
  it("sizes the trigger and every inline link", () => {
    renderNav();

    /*
     * jsdom has no layout, so this asserts the CLASSES that carry the 44 px
     * rather than pretending to measure it. The pixels are measured in the
     * browser harness (Task 9) and recorded in the Dev Agent Record.
     */
    expect(trigger().className).toMatch(/\bmin-h-11\b/);
    expect(trigger().className).toMatch(/\bmin-w-11\b/);

    for (const link of within(inlineNav()).getAllByRole("link")) {
      expect(link.className).toMatch(/\bmin-h-11\b/);
    }
  });

  it("sizes every control inside the sheet", async () => {
    const user = userEvent.setup({ delay: null });
    renderNav();

    await user.click(trigger());
    const sheet = screen.getByRole("dialog");
    const landmark = within(sheet).getByRole("navigation");

    for (const link of within(landmark).getAllByRole("link")) {
      expect(link.className).toMatch(/\bmin-h-11\b/);
    }

    const close = within(sheet).getByRole("button", { name: es.nav.close });
    expect(close.className).toMatch(/\bmin-h-11\b/);
    expect(close.className).toMatch(/\bmin-w-11\b/);
  });
});

describe("D11 / D13 — the source-level rulings the render cannot show", () => {
  const source = readFileSync(path.join(SRC, "components/SiteNav.tsx"), "utf8");

  it("styles the trigger with flex, never an implicit-track grid", () => {
    /*
     * The mockup draws the trigger as `display:grid; place-items:center`.
     * Translating that literally would fail `reflow-guards.test.ts`'s repo-wide
     * implicit-grid scan: `min-h-11 min-w-11` are not the FIXED `h-`/`w-` pair
     * its exemption requires, so `grid … place-items-center` is an offender.
     * The shipped `HeaderSearch` trigger form is copied instead.
     */
    expect(source).toContain("flex min-h-11 min-w-11 items-center justify-center rounded-md");
  });

  it("adds no component-level reduced-motion handling (D13)", () => {
    /*
     * `globals.css` kills every animation and transition under
     * `prefers-reduced-motion: reduce`, product-wide. Motion here is
     * decorative-only, so the sheet opens and closes instantly and nothing is
     * lost. A `motion-reduce:` variant here would be a second mechanism that
     * can drift from the global one.
     */
    expect(source).not.toContain("motion-reduce:");
    expect(source).not.toContain("prefers-reduced-motion");
  });

  it("imports nothing from story 3.8's deep-link plumbing (D2, AC 2)", () => {
    /*
     * IMPORTS AND LISTENERS, not mentions. An earlier draft asserted the source
     * did not CONTAIN "match-anchors" at all, and failed on this file's own D2
     * comment — which names those modules precisely in order to explain why it
     * does not import them. A guard that forbids naming the thing it rules on
     * makes the ruling undocumentable, so it matches the import statement and
     * the listener registration instead.
     */
    expect(source).not.toMatch(/from\s+"@\/lib\/match-anchors"/);
    expect(source).not.toMatch(/from\s+"@\/lib\/use-anchor-nonce"/);
    expect(source).not.toMatch(/addEventListener\(\s*"hashchange"/);
  });
});

describe("code review 2026-08-26 — the three defects Task 9 could not see", () => {
  /*
   * 🔴 A DESTINATION CLOSES THE SHEET.
   *
   * `SiteHeader` is mounted in the ROOT LAYOUT, so a client navigation does not
   * unmount `SiteNav`; the `<Link>` click is INSIDE the dialog, so Radix's
   * outside-pointer-down dismissal never fires; and Radix has no notion of a
   * route. Shipped, that meant tapping *Glosario* changed the route BEHIND a
   * still-open modal that Radix keeps inert and body-scroll-locked — the reader
   * saw the menu, not the page they chose, on every viewport below `xl`.
   *
   * Driven by the pathname rather than by the click, because Back/Forward must
   * close it too. Re-rendering with a new `pathname` is what a real navigation
   * does to this component: the layout persists and the hook returns a new value.
   */
  it("closes the sheet when the route changes under it", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderNav();

    await user.click(trigger());
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    pathname = "/glossary/";
    view.rerender(
      <Harness locale="es">
        <SiteNav />
      </Harness>
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  /*
   * 🔴 THERE IS A NAVIGATION LANDMARK BELOW `xl`, WITH THE SHEET CLOSED.
   *
   * The inline `<nav>` is `hidden xl:flex` — `display:none` at every width this
   * branch renders at — and the sheet's `<nav>` exists only while the sheet is
   * OPEN. So a screen-reader reader rotoring by landmark on a phone found a
   * `banner` and a `main` and NO `navigation`, on all 1,406 routes. Ruled at
   * review: below `xl` the trigger IS the navigation, so it lives inside one.
   *
   * jsdom applies no stylesheet, so `hidden` cannot be observed here — this
   * asserts the STRUCTURE (the trigger has a `<nav>` ancestor carrying the
   * landmark's name), which is the half that was missing.
   */
  it("wraps the `<xl` trigger in a named navigation landmark", () => {
    renderNav();

    const landmark = trigger().closest("nav");
    expect(landmark).not.toBeNull();
    expect(landmark).toHaveAttribute("aria-label", es.nav.landmark);
    expect(landmark).not.toBe(inlineNav());
  });

  /*
   * 🔴 THE TRIGGER'S WRAPPER TAKES THE FREE SPACE ITSELF.
   *
   * The header row is a plain `flex flex-wrap items-center` with no
   * `justify-between`, and its only growing child was the search slot — which
   * this story made `hidden … xl:flex`, so below `xl` it is `display:none`, is
   * not laid out, and distributes nothing. That left the wrapper's `justify-end`
   * with no free main-axis space to act on: it was inert, and the trigger packed
   * flush against the wordmark with the rest of the bar empty, on every phone.
   *
   * `ml-auto` does not depend on a sibling, which is the property that makes it
   * the fix. Pinned as a class because jsdom computes no layout — the browser
   * pass in the Dev Agent Record is what measures the resulting x-position.
   */
  it("gives the trigger's wrapper `ml-auto`, which does not depend on a sibling", () => {
    renderNav();

    const landmark = trigger().closest("nav");
    expect(landmark?.className.split(/\s+/)).toContain("ml-auto");
  });
});
