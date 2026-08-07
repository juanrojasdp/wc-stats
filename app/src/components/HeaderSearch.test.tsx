// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderSearch } from "@/components/HeaderSearch";
import { LocaleProvider } from "@/lib/i18n-provider";
import { ThemeProvider } from "@/lib/theme-provider";
import { resetTournamentIndexCache } from "@/lib/tournament-index";
import { closeOtherOverlays, registerOverlayCloser } from "@/lib/use-glossary-popover";
import { en } from "@/locales/en";
import { es } from "@/locales/es";

/*
 * ═════════ THE REPO'S FIRST RENDER TEST (Story 2.14, ruling 10) ═════════
 *
 * NO REACT COMPONENT HAD EVER BEEN RENDERED IN A TEST HERE. Before this file
 * there was no jsdom, no @testing-library/*, no user-event, no jest-axe and no
 * Playwright: `vitest.config.ts` is `environment: "node"` with no setup file,
 * and all 28 prior test files are pure-model or exported-HTML. `axe-core` is
 * present TRANSITIVELY ONLY, via eslint-plugin-jsx-a11y.
 *
 * AC 4 is irreducibly interactive — arrow keys, Enter, a ONE-press Escape — and
 * the deferred-work ledger names this class "untestable in a node-only harness",
 * routed to "whichever story introduces jsdom or a render-test seam". This story
 * takes that on. It is a HARNESS CHANGE, not a story detail, and prior stories
 * were explicitly forbidden from making it.
 *
 * SCOPED AND PER-FILE. The `// @vitest-environment jsdom` pragma above is the
 * documented vitest 3.2.7 API; the GLOBAL `environment` stays "node", because
 * flipping it would change `storage.test.ts`'s `vi.unstubAllGlobals()` restore
 * target. Everything added is a devDependency — Story 2.2's prohibition is on
 * RUNTIME dependencies, `dependencies` is untouched, and nothing here ships to
 * a browser.
 *
 * ═════════ FOUR HARNESS FACTS THIS FILE OWES ITS READER ═════════
 *
 * 1. RTL AUTO-CLEANUP DOES NOT RUN. `vitest.config.ts` has no `globals: true`,
 *    and @testing-library/react registers `afterEach(cleanup)` only when a
 *    global `afterEach` exists. Without the explicit call below the DOM leaks
 *    forward and the symptom reads as "found multiple elements" — a component
 *    bug that is not one.
 * 2. RADIX DIALOG NEEDS jsdom STUBS: `ResizeObserver`,
 *    `Element.prototype.hasPointerCapture` and `scrollIntoView` are all absent.
 * 3. THIS FILE IS LINTED LIKE ANY OTHER `src/**\/*.tsx` — there is no test
 *    exemption in `eslint.config.mjs` and `--max-warnings 0` is link 1 of the
 *    build. No bare JSX text in the harness. It also sits inside the
 *    `src/components/**` seam, so `t` from `@/lib/i18n` and `@/lib/build-data`
 *    are both barred: expected strings come from `@/locales/es` and
 *    `@/locales/en` directly.
 * 4. jsdom DOES NOT NAVIGATE. Clicking a real anchor logs "Not implemented:
 *    navigation to …". That is expected, not a defect — every assertion here is
 *    on the RESOLVED HREF, never on a location change.
 *
 * WHAT THIS FILE STILL CANNOT DO, carried rather than papered over: there is no
 * live screen reader (the structural pass reads roles, labels and strings back
 * from the DOM, which is not the same thing), no axe (Story 2.19 owns it), and
 * a real Tab key has never been delivered by this project's browser automation.
 */

/*
 * ⚠️ THIS FILE NEEDS MORE THAN THE 5 s DEFAULT, and the reason is the harness
 * rather than the component.
 *
 * A jsdom render plus `user-event` is an order of magnitude slower than the pure
 * model tests this repo was built on: every `type()` dispatches a real
 * keydown/keypress/input/keyup quartet PER CHARACTER and yields to the event
 * loop between each, and this file also mounts Radix's Dialog. Run alone the
 * whole file takes ~6 s; run alongside thirty other files on seven workers, one
 * individual test tipped past 5 s and failed as a timeout — a harness-contention
 * failure that reads exactly like a component defect.
 *
 * `vi.setConfig` is FILE-SCOPED, so the global default is untouched — the same
 * discipline as the per-file `@vitest-environment` pragma above, and for the
 * same reason: this file's costs are this file's to declare.
 */
vi.setConfig({ testTimeout: 20_000 });

const FIXTURE = readFileSync(
  path.join(process.cwd(), "..", "data", "fixtures", "index", "tournament.json"),
  "utf8"
);

/**
 * `delay: null` removes user-event's artificial inter-keystroke scheduling.
 *
 * IT STILL DISPATCHES REAL KEY EVENTS — which is exactly what AC 4 requires and
 * what the ledger meant by "verify with real key events rather than by reading
 * the handler". What it drops is the setTimeout BETWEEN them, which is a
 * simulation of human typing speed that no assertion here depends on and which
 * dominated this file's runtime.
 */
function setupUser() {
  return userEvent.setup({ delay: null });
}

/** jsdom is missing three APIs Radix Dialog calls unconditionally. */
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

function stubIndexFetch(body: string = FIXTURE, ok = true): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 503,
    json: async () => JSON.parse(body) as unknown,
  }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

function Harness({ children }: { children: ReactNode }) {
  // `useT()` THROWS outside these two providers, so every render needs both.
  return (
    <ThemeProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </ThemeProvider>
  );
}

function renderSearch() {
  return render(
    <Harness>
      <HeaderSearch />
    </Harness>
  );
}

/** The desktop combobox — the sheet's is not mounted until the sheet opens. */
function combobox(): HTMLInputElement {
  return screen.getByRole("combobox") as HTMLInputElement;
}

/**
 * ⚠️ A HARNESS LIMIT, MEASURED AND NAMED so nobody "fixes" the model to match it.
 *
 * `trailingSlash: true` lives in `next.config.ts`, and vitest never loads that
 * config — so `<Link href="/teams/mexico/">` renders `href="/teams/mexico"` HERE
 * and `href="/teams/mexico/"` in the real export. The built HTML is the proof:
 * `static-output.test.ts` pins `href="/players/son-heungmin-kor/"` green today,
 * and `out/index.html` carries `href="/teams/mexico/"`.
 *
 * So the slash is asserted in the two places that can see it — `search-model.
 * test.ts` on the href the model emits, and the static-output suites on the
 * exported markup — and this file asserts only the SHAPE.
 */
const HREF_IN_HARNESS = /^\/(teams|players|matches)\/[a-z0-9-]+\/?$/;

/**
 * Focus the input, WAIT FOR THE CORPUS TO ACTUALLY LAND, then type.
 *
 * 🔴 THE OLD WAIT WAS A NO-OP AND EVERY KEYBOARD TEST RESTED ON IT (code review
 * 2026-08-07). It was `waitFor(() => expect(input).toHaveAttribute(
 * "aria-expanded", "false"))` — a condition that is ALREADY TRUE on the first
 * render, before the fetch is even issued, so it resolved on its first tick and
 * synchronized nothing. Nothing in the helper touched the corpus. Every test
 * built on it was relying on `user.type`'s incidental event-loop yields to let
 * the promise resolve, which is precisely the shape of flake this file's own
 * 20 s timeout block was written to apologize for.
 *
 * The honest wait is for the loading COPY to leave the panel, which only happens
 * once `status` has moved off "loading". It needs a query in the box to render
 * at all, so a single probe character goes in first and is then removed —
 * `user.clear` leaves the field genuinely empty, which closes the panel and puts
 * the caller back at the resting state it expects.
 */
async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = combobox();
  await user.click(input);
  await user.type(input, "a");
  await waitFor(() => {
    expect(screen.queryByText(es.search.loading)).not.toBeInTheDocument();
  });
  await user.clear(input);
  await user.type(input, query);
  return input;
}

beforeEach(() => {
  installDialogStubs();
  stubIndexFetch();
  resetTournamentIndexCache();
});

afterEach(() => {
  // See harness fact 1 — without this the DOM leaks into the next test.
  cleanup();
  vi.unstubAllGlobals();
  resetTournamentIndexCache();
});

describe("HeaderSearch — combobox semantics (AC 2, AC 4)", () => {
  it("exposes the combobox roles, and aria-controls ONLY while open", async () => {
    const user = setupUser();
    renderSearch();
    const input = combobox();

    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-expanded", "false");
    // Pointing at an id that is not in the document is an axe
    // aria-valid-attr-value failure, so the attribute is conditional.
    expect(input).not.toHaveAttribute("aria-controls");

    await user.click(input);
    await user.type(input, "mex");

    await waitFor(() => {
      expect(input).toHaveAttribute("aria-expanded", "true");
    });
    const listbox = await screen.findByRole("listbox");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(listbox).toHaveAccessibleName(es.search.listLabel);
  });

  it("NEVER opens on focus — the single line AC 4's one-press Escape rests on", async () => {
    /*
     * Ruling 3, clause 1. Story 2.8's multi-press Escape came from an `onFocus`
     * opener plus a focus-restoring dismissal; never opening on focus defeats
     * both mechanisms at the root, so no suppression flag is needed here at all.
     */
    const user = setupUser();
    renderSearch();
    const input = combobox();

    await user.click(input);
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens on ArrowDown from closed, once there is something to show", async () => {
    const user = setupUser();
    renderSearch();
    const input = await search(user, "mex");
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("moves aria-activedescendant with ArrowDown/ArrowUp and never moves FOCUS", async () => {
    const user = setupUser();
    renderSearch();
    const input = await search(user, "mex");
    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);

    // Resting state: nothing is auto-selected, so Enter cannot navigate a
    // reader to a row they never chose.
    expect(input).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    expect(options[0]).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);

    // THE POINT OF aria-activedescendant: DOM focus never leaves the input, so
    // the reader can keep typing. A citable divergence from PitchPanel's roving
    // tabIndex, and the correct model for a combobox.
    expect(input).toHaveFocus();
  });

  it("jumps to the first and last option with Home and End", async () => {
    const user = setupUser();
    renderSearch();
    const input = await search(user, "mex");
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");

    await user.keyboard("{ArrowDown}{End}");
    expect(input).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);
    await user.keyboard("{Home}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("navigates on Enter by activating the ACTIVE option's own anchor", async () => {
    /*
     * Clicking the anchor ref keeps the <Link> load-bearing, so prefetch={false}
     * still applies and Enter behaves exactly like a mouse click. jsdom does not
     * navigate (harness fact 4), so the assertion is on the resolved href.
     */
    const user = setupUser();
    renderSearch();
    const input = await search(user, "mexico");
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");

    await user.keyboard("{ArrowDown}");
    const target = within(options[0]).getByRole("link", { hidden: true });
    const href = target.getAttribute("href");
    expect(href).toMatch(HREF_IN_HARNESS);

    /*
     * LISTENING FOR THE EVENT, NOT SPYING ON `.click()` (code review
     * 2026-08-07). The handler now dispatches a MouseEvent carrying the
     * modifier flags, because `HTMLElement.click()` hard-codes them all false
     * and flattened Ctrl/Cmd+Enter into a same-tab navigation. Asserting on the
     * received event is also the better test: it checks what the anchor
     * actually gets rather than which method was used to send it.
     */
    const received: MouseEvent[] = [];
    target.addEventListener("click", (event) => {
      event.preventDefault();
      received.push(event as MouseEvent);
    });
    await user.keyboard("{Enter}");
    expect(received).toHaveLength(1);
    expect(received[0].bubbles).toBe(true);
    expect(input).toHaveFocus();
  });

  it("carries the modifier keys through, so Ctrl+Enter can open a new tab", async () => {
    /*
     * Ruling 8 made these rows REAL links so they behave like links, and
     * "open in a new tab" is the gesture that costs the most when it silently
     * degrades — the reader loses their place instead of gaining a tab.
     */
    const user = setupUser();
    renderSearch();
    await search(user, "mexico");
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");

    await user.keyboard("{ArrowDown}");
    const target = within(options[0]).getByRole("link", { hidden: true });
    const received: MouseEvent[] = [];
    target.addEventListener("click", (event) => {
      event.preventDefault();
      received.push(event as MouseEvent);
    });

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(received).toHaveLength(1);
    expect(received[0].ctrlKey).toBe(true);
  });

  it("does nothing on Enter while no option is active", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "mex");
    await screen.findByRole("listbox");
    // Manual selection: no auto-highlight means no accidental navigation.
    await user.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes on ONE Escape, with focus still in the input", async () => {
    const user = setupUser();
    renderSearch();
    const input = await search(user, "mex");
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");

    // ONE press. Story 2.8 shipped a two-to-three-press Escape as a disclosed
    // deviation; this is the same control class, fixed rather than repeated.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
  });

  it("closes when the query is emptied, rather than hanging an empty panel", async () => {
    const user = setupUser();
    renderSearch();
    const input = await search(user, "mex");
    await screen.findByRole("listbox");
    await user.clear(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("HeaderSearch — results (AC 1, AC 3, AC 8)", () => {
  it("finds all three entity kinds and labels each with the REUSED column head", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "mexico");
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");

    const text = options.map((option) => option.textContent ?? "").join("|");
    // The fixture's one team is Mexico, and its matches reference it too.
    expect(text).toContain(es.viz.table.team);
    expect(text).toContain(es.hub.results.column.match);
  });

  /*
   * THE PLAYER LABEL, ON ITS OWN QUERY (code review 2026-08-07). The test above
   * is titled "all three entity kinds" and asserts two: the fixture's two
   * players are Mexican but neither is NAMED "mexico", so `viz.table.player`
   * never appeared in that listbox and the third kind went unchecked. A player
   * surname is the only needle that reaches it.
   */
  it("labels a PLAYER row with the reused viz.table.player head — the third kind", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "quinones");
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");

    const text = options.map((option) => option.textContent ?? "").join("|");
    expect(text).toContain(es.viz.table.player);
  });

  it("marks the matched substring, case-insensitively, in the ORIGINAL casing", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "mex");
    const listbox = await screen.findByRole("listbox");

    const marks = listbox.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    // "mex" typed lowercase must mark "Mex" as the name actually spells it —
    // the three-slice render never rewrites the copy it marks.
    expect([...marks].some((mark) => mark.textContent === "Mex")).toBe(true);
  });

  /*
   * RETITLED, BECAUSE THE BODY NEVER CHECKED PREFETCH (code review 2026-08-07).
   * `prefetch` leaves NO DOM trace — next/link consumes it and renders a plain
   * `<a>` — so no assertion reachable from this harness can see it, and the old
   * title claimed coverage for the one property ruling 8 calls mandatory and
   * that Story 2.13 measured a real regression for (48 → 75 resource entries).
   * The DOM half keeps its own test; the prefetch half is asserted at the source
   * below, which is where it is actually observable.
   */
  it("makes every row a REAL link with a well-formed href (ruling 8)", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "mexico");
    const links = within(await screen.findByRole("listbox")).getAllByRole("link", {
      hidden: true,
    });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      // Shape only — see HREF_IN_HARNESS for why the trailing slash cannot be
      // asserted from this harness, and where it IS asserted instead.
      expect(link.getAttribute("href")).toMatch(HREF_IN_HARNESS);
    }
  });

  it("passes prefetch={false} on every Link it renders (ruling 8)", () => {
    /*
     * A SOURCE ASSERTION, deliberately, and the same technique
     * `src/app/static-output.test.ts` already uses to police what the module
     * graph reaches: the property is invisible at runtime, so the only place it
     * can be checked is where it is written. Every `<Link` in this component
     * must carry it — the row anchors AND the empty state's link to `/`, since a
     * typeahead re-renders its whole link list on every keystroke and that is
     * the worst possible shape for Next's default prefetch.
     */
    const source = readFileSync(
      path.join(process.cwd(), "src", "components", "HeaderSearch.tsx"),
      "utf8"
    );
    /*
     * COMMENTS ARE STRIPPED FIRST, and that is not fussiness — this file
     * discusses `<Link>` and `prefetch={false}` in prose several times, and
     * counting those made the two totals disagree for reasons that had nothing
     * to do with the code. Same lesson as `classAttrCount`: count the real
     * thing, never a string that merely looks like it.
     */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const linkOpenings = code.match(/<Link\b/g) ?? [];
    const prefetchOff = code.match(/prefetch=\{false\}/g) ?? [];
    expect(linkOpenings.length).toBeGreaterThan(0);
    expect(prefetchOff.length).toBe(linkOpenings.length);
  });

  /*
   * PER ROW, NOT PER LISTBOX (code review 2026-08-07). This asserted a
   * disjunction over the CONCATENATED text of the whole listbox, so one matching
   * row anywhere passed and "every row" was never tested — and
   * `es.search.playerRowLink`, the only string this story mints, was not in the
   * disjunction at all. Both are fixed: every option must carry one of the three
   * prefixes, and the minted player form gets its own query below.
   */
  it("gives EVERY row an sr-only prefix, so an option is not a bare noun", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "mexico");
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);

    // Reused from hub.*; only the player form is minted by this story.
    const prefixes = [
      es.search.playerRowLink,
      es.hub.standings.rowLink,
      es.hub.results.rowLink,
    ];
    for (const option of options) {
      const text = option.textContent ?? "";
      expect(
        prefixes.some((prefix) => text.includes(prefix)),
        text
      ).toBe(true);
    }
  });

  it("uses the MINTED player prefix on a player row (search.playerRowLink)", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "quinones");
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");

    const text = options.map((option) => option.textContent ?? "").join("|");
    expect(text).toContain(es.search.playerRowLink);
  });

  it("renders the AC's composed empty state and a link to /", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "zzzznotathing");

    // Composed at the call site: t() has no interpolation, and the guillemets
    // cannot be JSX text under react/jsx-no-literals.
    const sentence = `${es.search.noResultsBefore}zzzznotathing${es.search.noResultsAfter}`;
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    const home = screen.getByRole("link", { name: es.notFound.homeLink });
    expect(home).toHaveAttribute("href", "/");
    // "Zero matches" is not "no corpus": neither error nor invalid copy shows.
    expect(screen.queryByText(es.search.error)).not.toBeInTheDocument();
    expect(screen.queryByText(es.search.invalid)).not.toBeInTheDocument();
  });

  it("follows a mid-session locale toggle", async () => {
    const user = setupUser();
    render(
      <Harness>
        <HeaderSearch />
      </Harness>
    );
    expect(combobox()).toHaveAccessibleName(es.search.label);
    cleanup();

    render(
      <ThemeProvider>
        <LocaleProvider initialLocale="en">
          <HeaderSearch />
        </LocaleProvider>
      </ThemeProvider>
    );
    expect(combobox()).toHaveAccessibleName(en.search.label);
    await user.click(combobox());
  });
});

describe("HeaderSearch — the six render states (Task 7.8)", () => {
  it("says it is still loading the corpus rather than showing zero matches", async () => {
    // A fetch that never settles: the first keystroke can land before the
    // artifact does on the four routes where nothing else fetches it.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const user = setupUser();
    renderSearch();
    const input = combobox();
    await user.click(input);
    await user.type(input, "mex");
    expect(await screen.findByText(es.search.loading)).toBeInTheDocument();
    // Silence here would read as "no matches", which is a different and false
    // fact — and the AC's empty state must NOT be what shows.
    expect(screen.queryByText(new RegExp(es.search.noResultsBefore))).not.toBeInTheDocument();
  });

  it("distinguishes a FAILED fetch from zero matches", async () => {
    stubIndexFetch(FIXTURE, false);
    const user = setupUser();
    renderSearch();
    const input = combobox();
    await user.click(input);
    await user.type(input, "mex");
    expect(await screen.findByText(es.search.error)).toBeInTheDocument();
  });

  it("distinguishes an INVALID payload from a failed fetch", async () => {
    // It arrived intact and failed the schemaVersion gate — a data-integrity
    // problem, not a network one. The header validates for itself because no
    // region validates this artifact on four of the five routes it covers.
    const wrongVersion = JSON.stringify({
      ...(JSON.parse(FIXTURE) as Record<string, unknown>),
      schemaVersion: 999,
    });
    stubIndexFetch(wrongVersion);
    const user = setupUser();
    renderSearch();
    const input = combobox();
    await user.click(input);
    await user.type(input, "mex");
    expect(await screen.findByText(es.search.invalid)).toBeInTheDocument();
    expect(screen.queryByText(es.search.error)).not.toBeInTheDocument();
  });
});

describe("HeaderSearch — AC 7's lazy fetch, measured in the harness", () => {
  it("fetches NOTHING on mount — the header does not pay for search on load", async () => {
    const spy = stubIndexFetch();
    renderSearch();
    // Ruling 1: four of the five routes ship no code that fetches this artifact
    // at all today, and the header is on all five. Nothing until engagement.
    await waitFor(() => {
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("fetches exactly ONCE on engagement, and never again while typing", async () => {
    const spy = stubIndexFetch();
    const user = setupUser();
    renderSearch();
    const input = combobox();

    await user.click(input);
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });

    await user.type(input, "mexico");
    await screen.findByRole("listbox");
    // Every keystroke after the first fetch is client-side over the held
    // payload — the AC's "no network beyond the already-loaded index".
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("HeaderSearch — the page-wide overlay registry (Task 7.7, UX-DR15)", () => {
  it("closes any OTHER registered overlay when the sheet opens", async () => {
    /*
     * The registry in `use-glossary-popover.ts` was module-PRIVATE, so
     * "page-wide single open" meant "every glossary popover" and nothing else.
     * Glossary popovers ship on /glossary, on match routes and on the Hub — the
     * same routes this header covers — so opening one and then opening search
     * produced exactly the 2-deep stack UX-DR15 forbids. A stand-in closer
     * stands for the popover here; the mechanism is the same Set.
     */
    const user = setupUser();
    const otherOverlayCloser = vi.fn();
    const unregister = registerOverlayCloser(otherOverlayCloser);
    try {
      renderSearch();
      await user.click(screen.getByRole("button", { name: es.search.open }));
      await screen.findByRole("dialog");
      expect(otherOverlayCloser).toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  /*
   * ⚠️ REGRESSION — FOUND IN THE BROWSER (Task 11.3), NOT HERE.
   *
   * The first implementation registered only the SHEET, so the mechanism looked
   * done while the presentation that is actually visible at desktop width stayed
   * outside it: with results showing, hovering a glossary term opened its
   * popover and the listbox remained open — measured overlay depth 2, the exact
   * stack UX-DR15 bans. Both directions are pinned below, because each fails
   * independently.
   */
  it("CLOSES the inline listbox when another overlay opens (depth stays 1)", async () => {
    const user = setupUser();
    renderSearch();
    await search(user, "mex");
    await screen.findByRole("listbox");

    // Stand in for a glossary popover opening: that is exactly what its hook
    // does on its own open path.
    closeOtherOverlays(null);

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
  });

  it("CLOSES another overlay when the inline listbox opens", async () => {
    const user = setupUser();
    const otherOverlayCloser = vi.fn();
    const unregister = registerOverlayCloser(otherOverlayCloser);
    try {
      renderSearch();
      await search(user, "mex");
      await screen.findByRole("listbox");
      expect(otherOverlayCloser).toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it("does NOT let the sheet's own listbox close the sheet around it", async () => {
    /*
     * The subtlety the fix turns on: the sheet's field lives INSIDE an overlay
     * that already holds the depth-1 slot, so it must neither register nor
     * claim. A field that closed "every other overlay" on opening its list
     * would close the very dialog the reader is typing in.
     */
    const user = setupUser();
    renderSearch();
    await user.click(screen.getByRole("button", { name: es.search.open }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("combobox"), "mex");
    await within(dialog).findByRole("listbox");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("HeaderSearch — the <md sheet (AC 6, Task 10.3)", () => {
  it("opens from the icon button and carries the SAME combobox semantics", async () => {
    const user = setupUser();
    renderSearch();
    const trigger = screen.getByRole("button", { name: es.search.open });

    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(es.search.sheetTitle);

    /*
     * EXACTLY ONE COMBOBOX IS EXPOSED, even here — and for a SECOND reason
     * beyond ruling 4's.
     *
     * Ruling 4's mechanism is CSS: Tailwind's `hidden` is `display:none`, which
     * removes the desktop branch from the accessibility tree below md. jsdom
     * applies no stylesheet, so that mechanism is invisible here and BOTH inputs
     * are in the DOM. The count is still one, because Radix's modal Dialog marks
     * the rest of the document inert/`aria-hidden` — and RTL's `getAllByRole`
     * honours that. Two independent mechanisms, same guarantee.
     */
    const inputs = screen.getAllByRole("combobox");
    expect(inputs).toHaveLength(1);
    const sheetInput = within(dialog).getByRole("combobox");
    expect(sheetInput).toBe(inputs[0]);
    expect(sheetInput).toHaveAttribute("aria-autocomplete", "list");
    expect(sheetInput).toHaveAccessibleName(es.search.label);
  });

  it("autofocuses the sheet's input, so the reader can type immediately", async () => {
    const user = setupUser();
    renderSearch();
    await user.click(screen.getByRole("button", { name: es.search.open }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByRole("combobox")).toHaveFocus();
    });
  });

  it("searches inside the sheet with the same model and the same highlight", async () => {
    const user = setupUser();
    renderSearch();
    await user.click(screen.getByRole("button", { name: es.search.open }));
    const dialog = await screen.findByRole("dialog");
    const sheetInput = within(dialog).getByRole("combobox");

    await user.type(sheetInput, "mex");
    const listbox = await within(dialog).findByRole("listbox");
    expect(within(listbox).getAllByRole("option").length).toBeGreaterThan(0);
    expect(listbox.querySelectorAll("mark").length).toBeGreaterThan(0);
  });

  it("closes the WHOLE sheet on ONE Escape, listbox included (ruling 3)", async () => {
    /*
     * A deliberate divergence from ARIA APG's two-stage combobox Escape, taken
     * because UX-DR15 ("modal stacks >1 deep" are banned) and the Story 2.8
     * evidence point the same way. The field lets Escape through to Radix rather
     * than claiming press #1 for the listbox.
     */
    const user = setupUser();
    renderSearch();
    const trigger = screen.getByRole("button", { name: es.search.open });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("combobox"), "mex");
    await within(dialog).findByRole("listbox");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("returns focus to the ICON BUTTON on close — a disclosed UX-doc departure", async () => {
    /*
     * EXPERIENCE.md says Esc "returns focus to the input". In the sheet the
     * input is UNMOUNTED by the close, so there is nothing to return to; Radix
     * returns focus to the trigger, which is the only correct destination. Filed
     * in deferred-work.md rather than papered over.
     */
    const user = setupUser();
    renderSearch();
    const trigger = screen.getByRole("button", { name: es.search.open });
    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("closes from its own close button too", async () => {
    const user = setupUser();
    renderSearch();
    await user.click(screen.getByRole("button", { name: es.search.open }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: es.search.close }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
