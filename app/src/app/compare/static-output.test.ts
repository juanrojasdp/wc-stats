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

  it("ships the combobox roles 2.14 built for this call site", () => {
    /*
     * `SearchField` is REUSED, not forked — 2.14's ruling 2 says so by name.
     * Two of them mount here, which is why this counts rather than merely
     * checking presence: one would mean the picker silently lost a side.
     */
    const page = html();
    expect((page.match(/role="combobox"/g) ?? []).length).toBeGreaterThanOrEqual(2);
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
    // The route's own <h1>-substitute is sr-only: the visible entry points on the
    // player and team Heroes say "Comparar"; this names the page itself.
    expect(html()).toContain(es.compare.heading);
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

  it("declares no `useState` for `type`, `a` or `b` anywhere on the route", () => {
    /*
     * Matches the DECLARATION form — `const [x, setX] = useState` — so a state
     * slot named for either side or for the type is caught wherever it is
     * declared. Ephemeral view state (`notice`, `result`, `dataAttempt`,
     * `announcement`, `indexStatus`) is legal and deliberately not matched: none
     * of it is the comparison.
     */
    const forbidden = /const\s*\[\s*(type|a|b|sideA|sideB|selected[AB])\s*,/;
    expect(forbidden.test(region), "CompareRegion holds a side in state").toBe(false);
    expect(forbidden.test(picker), "ComparePicker holds a side in state").toBe(false);
  });

  it("routes EVERY write through `replaceUrlQuery`, and the picker makes none", () => {
    // One writer, in one module. The picker reports upward and writes nothing —
    // which is what makes it impossible for it to disagree with the URL.
    expect(region).toContain("replaceUrlQuery");
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
