import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { es } from "@/locales/es";

const SRC_DIR = fileURLToPath(new URL("../../", import.meta.url));

/*
 * Verifies the EXPORTED `/compare` HTML, not live components (node env, no
 * jsdom). `npm run build` precedes `npm test`, so `out/` exists.
 *
 * ═══════════ THE PROPERTY UNDER TEST, STATED PLAINLY ═══════════
 *
 * `out/compare/index.html` is ONE DOCUMENT SERVED FOR EVERY QUERY STRING. There
 * is no server, `output: "export"` does not vary a document by `?type=&a=&b=`,
 * and `useUrlQuery`'s server snapshot is `""` — so what the exported file carries
 * is the route's SHELL in its picker-first empty state, and not a single
 * comparison row. That is the property under test here, NOT a limitation of it —
 * the same framing `static-output.test.ts:83-96` uses for the Hub.
 *
 * 🔴 WHAT AC 6 THEREFORE CLAIMS, AND WHAT IT DOES NOT. A pasted comparison URL
 * reproduces the same comparison with no user input, ON THE FIRST CLIENT RENDER
 * AFTER HYDRATION, through the same four-state region machine the other five
 * routes use. It does NOT claim "on first paint", and nothing in this suite
 * asserts that it does.
 */

const OUT_DIR = fileURLToPath(new URL("../../../out/", import.meta.url));
const COMPARE_HTML = OUT_DIR + "compare/index.html";
const anyBuilt = existsSync(OUT_DIR);

function html(): string {
  return readFileSync(COMPARE_HTML, "utf8");
}

/*
 * Count a class only where it appears as a real DOM `class="..."` attribute — the
 * RSC flight payload carries "className" strings that must not be counted.
 * Lifted from `matches/static-output.test.ts`, whose suite learned this the hard
 * way.
 */
function classAttrCount(source: string, token: string): number {
  const pattern = new RegExp(`class="[^"]*\\b${token}\\b[^"]*"`, "g");
  return (source.match(pattern) ?? []).length;
}

describe.skipIf(!anyBuilt)("/compare exports one shell (Story 2.17, AC 1 / AC 6)", () => {
  it("emits the route at all", () => {
    // trailingSlash: true → out/compare/index.html. A missing file here means the
    // route produced nothing, which a skip guard on the route directory would
    // have hidden behind a screen of green.
    expect(existsSync(COMPARE_HTML), COMPARE_HTML).toBe(true);
  });

  it("ships the PICKER, which is the region that is never hidden", () => {
    const page = html();
    // The type selector's three segments (D12's minted triple) …
    expect(page).toContain(es.compare.type.players);
    expect(page).toContain(es.compare.type.teams);
    expect(page).toContain(es.compare.type.matches);
    // … and the two search-selects, told apart by their own field labels.
    expect(page).toContain(es.compare.picker.sideA);
    expect(page).toContain(es.compare.picker.sideB);
  });

  it("ships the combobox roles 2.14 built for this call site — exactly two of them", () => {
    /*
     * `SearchField` is REUSED, not forked — 2.14's ruling 2 says so by name.
     *
     * 🔴 MEASURED AGAINST THE HEADER'S OWN, NOT ASSERTED AS A FLOOR (code review
     * 2026-08-07). The shipped gate was `toBeGreaterThanOrEqual(2)`, and the
     * SiteHeader contributes one combobox to every exported document — so the
     * count on this page is three, and deleting one of the picker's two fields
     * left it at two and STILL GREEN. The gate could not detect the failure its
     * own comment named.
     *
     * `/about` is the baseline: a route with the header and no picker. The
     * difference is the picker's own contribution, and it must be exactly two.
     */
    const comboboxes = (source: string): number => (source.match(/role="combobox"/g) ?? []).length;
    const headerOnly = comboboxes(readFileSync(OUT_DIR + "about/index.html", "utf8"));
    expect(comboboxes(html()) - headerOnly).toBe(2);
  });

  it("ships the PICKER-FIRST EMPTY STATE, because the empty query IS the shell's state", () => {
    /*
     * `useUrlQuery`'s `getServerSnapshot` returns `""`, which parses to zero
     * chosen sides — so the honest pre-render answer is the empty state, and the
     * exported document should contain it rather than a blank slot waiting on a
     * fetch that never happens at build time.
     */
    const page = html();
    expect(page).toContain(es.compare.empty.headlineBefore);
    expect(page).toContain(es.compare.empty.headlineAfter);
    expect(page).toContain(es.compare.empty.explanation);
    // The DEFAULT type's in-sentence word: "Elige dos jugadores para comparar."
    expect(page).toContain(es.compare.word.players);
  });

  it("carries NO comparison, NO chart and NO recharts markup", () => {
    const page = html();
    /*
     * The comparison itself is entirely client-side: both artifacts are fetched
     * at runtime and the charts are behind `dynamic(..., { ssr: false })`. A
     * `<pattern>` here would mean the D4 hatch had been server-rendered, which
     * would also mean a chart leaf had escaped the lazy boundary.
     */
    expect(page).not.toContain("recharts");
    expect(page).not.toContain("<pattern");
    expect(page).not.toContain(es.compare.section.stats);
    expect(page).not.toContain(es.compare.section.charts);
  });

  it("names the route for a screen reader without minting a visible title", () => {
    // The route's own <h1> is sr-only: the visible entry points on the player and
    // team Heroes say "Comparar"; this names the page itself.
    expect(html()).toContain(es.compare.heading);
  });

  it("emits exactly one <h1>, and it is sr-only (the shipped route shape)", () => {
    /*
     * THE GATE BOTH SIBLING SUITES ALREADY CARRY, and this one omitted —
     * `players/static-output.test.ts:253` and `teams/static-output.test.ts:224`
     * are the same two assertions. It caught a real defect: the route shipped its
     * top heading as an `<h2>`, so `/compare` was the only route in the app with
     * no `<h1>`, and nothing here could tell.
     *
     * COUNTED, NOT MERELY PRESENT. A second `<h1>` is as wrong as none — it is
     * what happens when a later block reaches for the route's top level instead
     * of the `<h2>` Route Composition rules for it.
     */
    const page = html();
    expect((page.match(/<h1/g) ?? []).length).toBe(1);
    expect(page).toMatch(/<h1[^>]*class="sr-only"/);
  });

  it("keeps the side headers at <h2>, so the outline never skips a level", () => {
    /*
     * Route Composition rules `<h2>` per side. The shell carries no comparison,
     * so what is pinned here is the NEGATIVE: an `<h3>` in the exported document
     * would mean a heading below the route's own level had appeared without the
     * h2 tier that Statistics, Charts and the two side headers all occupy.
     */
    expect(html()).not.toContain("<h3");
  });

  it("uses the shipped page container — `pb-`, never `py-`", () => {
    const page = html();
    expect(classAttrCount(page, "pb-layer-gap")).toBeGreaterThanOrEqual(1);
    expect(classAttrCount(page, "py-layer-gap")).toBe(0);
    expect(classAttrCount(page, "max-w-6xl")).toBeGreaterThanOrEqual(1);
  });

  it("takes NO route metadata, and that is ruled rather than forgotten (D3)", () => {
    /*
     * `export const metadata` is deliberately absent — see `page.tsx` for the
     * three reasons, the first of which is that it would mint `en.*` keys that
     * are unreachable by construction (2.18's BINDING prohibition). The document
     * therefore falls back to the ROOT layout's title, and this is what pins that
     * the route did not quietly acquire its own.
     */
    const title = html().match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const rootTitle = readFileSync(OUT_DIR + "about/index.html", "utf8").match(
      /<title>([^<]*)<\/title>/
    )?.[1];
    expect(title).not.toBe("");
    // /about is the other metadata-free server shell; both inherit the same one.
    expect(title).toBe(rootTitle);
  });
});

/*
 * ═══════════ THE URL IS THE ONLY COMPARISON STATE (AR-10, Task 2.5) ═════════
 *
 * A SOURCE-LEVEL ASSERTION, and it is the only kind available: the harness is
 * `environment: "node"` with no global jsdom, so nothing here can mount the
 * region and watch it. What CAN be decided statically is the thing AR-10
 * actually constrains — whether the component keeps a copy of the comparison.
 *
 * THE TEST OF THIS RULE IS THE ADDRESS BAR. If a reader can put the page into a
 * state the URL does not describe, or edit the URL into a state the page
 * ignores, state is being held that should not be — and the way that happens is
 * a `useState` named after a side. `swapSides` is a pure params→params function
 * for the same reason (`compare-url.test.ts` covers its behaviour); the write is
 * the whole operation, and the page re-renders from the new query exactly as it
 * would from a pasted one.
 */
describe("no component state holds the comparison (AR-10)", () => {
  const region = readFileSync(SRC_DIR + "components/CompareRegion.tsx", "utf8");
  const picker = readFileSync(SRC_DIR + "components/ComparePicker.tsx", "utf8");

  /** Every `useState` / `useReducer` slot a module declares, by name, sorted. */
  function stateSlots(source: string): string[] {
    const pattern = /const\s+\[\s*([A-Za-z0-9_$]+)\s*(?:,[^\]]*)?\]\s*=\s*use(?:State|Reducer)\s*[<(]/g;
    return [...source.matchAll(pattern)].map((match) => match[1]).sort();
  }

  /** Every `useRef` slot a module declares, by name, sorted. */
  function refSlots(source: string): string[] {
    const pattern = /const\s+([A-Za-z0-9_$]+)\s*=\s*useRef\s*[<(]/g;
    return [...source.matchAll(pattern)].map((match) => match[1]).sort();
  }

  /*
   * 🔴 AN ALLOW-LIST, NOT A DENY-LIST (code review 2026-08-07).
   *
   * The shipped gate matched a fixed set of NAMES — `type|a|b|sideA|sideB|
   * selected[AB]` — so it was defeated by calling the slot something else.
   * `const [compareType, …]`, `const [chosenA, …]`, a `useReducer` or a `useRef`
   * all held the comparison in component state and all passed green. A rule that
   * a rename defeats is not a rule.
   *
   * Enumerating the LEGAL slots inverts that: every new piece of state on this
   * route fails this test until someone writes it down here, which is the moment
   * to ask whether it is ephemeral view state or a copy of the URL. The seven
   * below are the former — a fetch status, a fetched payload, two retry counters,
   * a carried-over notice, a tagged result and a debounced announcement. None of
   * them is the comparison, and none survives a reload.
   */
  it("declares exactly the seven legal state slots, and no side among them", () => {
    expect(stateSlots(region)).toEqual([
      "announcement",
      "dataAttempt",
      "indexAttempt",
      "indexStatus",
      "notice",
      "result",
      "tournament",
    ]);
    expect(refSlots(region), "a ref is state the linter does not read").toEqual([
      "announceTimer",
      "busyRef",
    ]);
  });

  it("gives the picker NO state and NO refs at all", () => {
    // It is a pure function of `type` / `a` / `b` that reports upward. Any slot
    // here is a second opinion about the comparison, which is the one thing
    // AR-10 forbids outright.
    expect(stateSlots(picker)).toEqual([]);
    expect(refSlots(picker)).toEqual([]);
  });

  it("refuses `?a=X&b=X` in all three places, so no caption can render twice", () => {
    /*
     * A SELF-COMPARISON IS NOT A COMPARISON, and it was reachable in two clicks
     * (code review 2026-08-07). It produces duplicate React keys, two identical
     * figure captions, two identical table names and two identical mini-header
     * entries — and `i18n.test.ts`'s composed-caption inventory is distinct BY
     * CONSTRUCTION, so it could never have seen it.
     *
     * THREE MECHANISMS, EACH COVERING WHAT THE OTHERS CANNOT: the picker cannot
     * offer it, the URL cleanup drops it when pasted, and `bothListed` refuses to
     * render it in the one render between the paste and the write. That last one
     * is the reason a URL-only fix is not enough.
     */
    expect(picker, "each side must filter the other's pick out of its corpus").toMatch(
      /scopedForA[\s\S]*scopedForB/
    );
    expect(picker).toMatch(/entity\.id\s*!==\s*bId/);
    expect(picker).toMatch(/entity\.id\s*!==\s*aId/);
    expect(region, "the cleanup effect must drop a duplicate side").toMatch(
      /current\.a\s*===\s*current\.b/
    );
    expect(region, "`bothListed` must refuse the degenerate pair").toMatch(/idA\s*!==\s*idB/);
  });

  it("routes EVERY write through `replaceUrlQuery`, and the picker makes none", () => {
    /*
     * One writer, in one module. The picker reports upward and writes nothing —
     * which is what makes it impossible for it to disagree with the URL.
     *
     * MATCHES THE CALL, NOT THE MENTION. `toContain("replaceUrlQuery")` was
     * satisfied by the import line alone — or by this very sentence, had it been
     * written in that module — so it would have stayed green with every call site
     * deleted.
     */
    expect(/replaceUrlQuery\s*\(/.test(region), "the region never CALLS the writer").toBe(true);
    expect(picker).not.toContain("replaceUrlQuery");
    expect(picker).not.toContain("history.");
  });

  it("uses `history.replaceState` rather than the App Router (ruled D1)", () => {
    /*
     * `useSearchParams`, `useRouter` and `usePathname` stay ZERO-OCCURRENCE on
     * this route. Under `output: "export"` an unwrapped `useSearchParams()`
     * throws `BailoutToCSRError` during prerender and FAILS the build; wrapping
     * it serialises the boundary's fallback into `out/compare/index.html` and the
     * exported document loses the real shell. Neither is acceptable, and this is
     * what stops a later reader "fixing" the hook back.
     *
     * MATCHES THE CALL AND THE IMPORT, NOT A MENTION. Both modules NAME these
     * APIs in prose to explain why they are rejected — that is the record the
     * ruling lives in, and a bare `toContain` would punish it.
     */
    const routerCall = /\buse(SearchParams|Router|Pathname)\s*\(/;
    const routerImport = /from\s+"next\/navigation"/;
    for (const source of [region, picker]) {
      expect(routerCall.test(source), "an App Router hook is called").toBe(false);
      expect(routerImport.test(source), "next/navigation is imported").toBe(false);
    }
  });
});
