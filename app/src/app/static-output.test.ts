import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { Leaderboards } from "@/lib/contract/contract-types";
import { readTournament } from "@/lib/build-data";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { t } from "@/lib/i18n";
import { es } from "@/locales/es";
import { leaderboardMetricKey } from "@/viz/leaderboard-model";

/** The leaderboards fixture the Hub is built from (Story 2.13). */
const LEADERBOARD_FIXTURE: Leaderboards = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "..", "data", "fixtures", "index", "leaderboards.json"),
    "utf8"
  )
) as Leaderboards;

/*
 * Verifies the exported artifacts, not live components: vitest runs in the
 * node environment (no jsdom devDependency — Story 2.2 Task 10 chose the
 * lightest option), so the built HTML is the honest check of AC 2/4 markup.
 * Skipped only when NEITHER artifact exists (no build ran); a partial export
 * — one file present, the other missing — must fail loudly, not skip.
 * `npm run build` precedes `npm test` in the story's verification chain.
 */

const OUT_DIR = fileURLToPath(new URL("../../out/", import.meta.url));
const INDEX_HTML = OUT_DIR + "index.html";
const NOT_FOUND_HTML = OUT_DIR + "404.html";
// trailingSlash: true → out/<route>/index.html.
const ABOUT_HTML = OUT_DIR + "about/index.html";
const GLOSSARY_HTML = OUT_DIR + "glossary/index.html";
const anyBuilt = existsSync(INDEX_HTML) || existsSync(NOT_FOUND_HTML);

describe.skipIf(!anyBuilt)("exported 404.html (AC 4)", () => {
  it("carries the ruled Spanish copy and the NotFoundContent home link", () => {
    const html = readFileSync(NOT_FOUND_HTML, "utf8");
    expect(html).toContain(es.notFound.message);
    // Pinned to the 404 body's own link label: a bare href="/" check is
    // satisfied by the header wordmark, which is on every page.
    expect(html).toMatch(new RegExp(`href="/"[^>]*>${es.notFound.homeLink}`));
  });

  it("inherits the chrome shell (attribution footer present)", () => {
    const html = readFileSync(NOT_FOUND_HTML, "utf8");
    expect(html).toContain(es.chrome.footer.attribution.slice(0, 40));
  });
});

describe.skipIf(!anyBuilt)("exported index.html canonical markup (AC 2)", () => {
  it("is Spanish with no hardcoded theme class (dark is canonical via :root)", () => {
    const html = readFileSync(INDEX_HTML, "utf8");
    const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? "";
    expect(htmlTag).toContain('lang="es"');
    expect(htmlTag).not.toMatch(/class="[^"]*\bdark\b/);
    expect(htmlTag).not.toMatch(/class="[^"]*\blight\b/);
  });

  it("embeds the bootstrap script exactly once as an executable inline script, ahead of the chrome", () => {
    // The bundler may minify/re-quote the checked-in script literal, so an
    // exact string match against bootstrapScript would be flaky —
    // executable inline scripts are identified structurally instead. The
    // RSC flight payload also carries an escaped copy; only unescaped
    // <script> elements count.
    const html = readFileSync(INDEX_HTML, "utf8");
    const executables = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter(
      ([, body]) => body.includes("wcstats.theme") && !body.includes("self.__next_f")
    );
    expect(executables).toHaveLength(1);
    for (const marker of ["wcstats.locale", "prefers-color-scheme", "locale-"]) {
      expect(executables[0][1]).toContain(marker);
    }
    const at = html.indexOf(executables[0][0]);
    expect(at).toBeGreaterThan(html.indexOf("<body"));
    expect(at).toBeLessThan(html.indexOf("<header"));
  });
});

/*
 * STORY 2.12 Task 8.4 — the exported `/` HTML.
 *
 * WHAT THIS FILE CAN AND CANNOT SEE, stated plainly so a reader does not
 * mistake a thin suite for a thin surface. Ruled D1 puts the Hub's tables on
 * the CLIENT fetch path, so the exported HTML carries the route's shell in its
 * `loading` state and NOT a single standings or result row. That is the
 * property under test here, not a limitation of it: the AD-11 assertion below
 * is the one thing only this file can check, and it fails loudly if anyone ever
 * "optimises" the index into the markup.
 *
 * The rendered tables are covered where they are decidable — `hub-model.test.ts`
 * over the grouping, ordering, keying and hrefs — and in the browser at Task 9.
 */
describe.skipIf(!anyBuilt)("exported / — the Tournament Hub (Story 2.12)", () => {
  it("carries the route heading in the pre-rendered body, not only after hydration", () => {
    /*
     * The <h1> sits OUTSIDE the fetch region on purpose: a document whose only
     * heading appears after a network round trip has no outline while the
     * request is in flight, and none at all if it fails.
     */
    expect(readFileSync(INDEX_HTML, "utf8")).toContain(es.hub.title);
  });

  it("paints a layout-shaped, aria-busy loading region with an accessible name", () => {
    const html = readFileSync(INDEX_HTML, "utf8");
    expect(html).toContain('aria-busy="true"');
    // Hub-scoped copy: `match.bundle.loading` says "del partido", which would
    // be a false statement on a tournament-wide route.
    expect(html).toContain(es.hub.region.loading);
    expect(html).not.toContain(es.match.bundle.loading);
  });

  it("does NOT inline the tournament index into the HTML (AD-11)", () => {
    /*
     * AD-11 bans a third data path and bans inlining full bundles into HTML.
     * Story 1.17 measured the real index at 409,512 B raw; if it ever reaches
     * the markup, this route's document grows by that much on every visit.
     *
     * Asserted on SHAPE rather than on size, so it fails on the first row
     * rather than at some threshold: `knockoutResults` and `goalDifference` are
     * Tournament-only field names that appear nowhere else in the app.
     */
    const html = readFileSync(INDEX_HTML, "utf8");
    expect(html).not.toContain("knockoutResults");
    expect(html).not.toContain("goalDifference");
  });

  it("composes the <title> from the artifact's own tournament name (UX-DR22)", () => {
    // `tournamentName` is a proper noun the artifact owns (AD-7) — read at
    // build time, passed through, never keyed and never translated.
    const html = readFileSync(INDEX_HTML, "utf8");
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    expect(title).toContain(es.app.siteName);
    expect(title).toContain(readTournament().tournamentName);
    // The layout's generic default must have been overridden by the route's.
    expect(title).not.toBe(es.meta.title);
  });

  it("retired the Story 2.1 scaffold body along with its keys", () => {
    // The placeholder's four keys were this route's only call site; the copy
    // and the keys had to go together or one of them becomes dead.
    const html = readFileSync(INDEX_HTML, "utf8");
    expect(html).not.toContain("Andamiaje del sistema de diseño");
    expect(html).not.toContain("Design system scaffold");
  });
});

/*
 * STORY 2.18 Task 9.6 — the two routes this story owns. On the house pattern:
 * skipped only when NO build ran, asserting against the DICTIONARY OBJECT
 * rather than against the components under test, and failing loudly on a
 * partial export rather than skipping.
 */
describe.skipIf(!anyBuilt)("exported /glossary (AC 2)", () => {
  it("was exported at all — a build that skipped it fails here, it does not skip", () => {
    expect(existsSync(GLOSSARY_HTML), "out/glossary/index.html missing").toBe(true);
  });

  it("renders every glossary term, Spanish canonical, with its #term anchor", () => {
    const html = readFileSync(GLOSSARY_HTML, "utf8");
    expect(html).toContain(es.glossaryPage.title);
    for (const id of GLOSSARY_TERMS) {
      // The anchor is a language-neutral English slug (ruled decision 11), so
      // one id works from both locales and survives an amended Spanish term.
      expect(html, `missing anchor for ${id}`).toContain(`id="${id}"`);
      // Both languages render SIMULTANEOUSLY (AC 2), not just the active one.
      expect(html, `missing es term for ${id}`).toContain(es.glossary[id].es);
      expect(html, `missing en term for ${id}`).toContain(es.glossary[id].en);
    }
  });

  it("says once, on the page, that the definitions are authored rather than transcribed", () => {
    // The PMSR prints no glossary and no definition of any term. Claiming
    // otherwise on this page would be the dishonesty the story exists against.
    expect(readFileSync(GLOSSARY_HTML, "utf8")).toContain(es.glossaryPage.authoredNote);
  });

  it("is a real definition list and adds no landmark", () => {
    const html = readFileSync(GLOSSARY_HTML, "utf8");
    expect(html).toContain("<dl");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
    // 22 landmarks for 11 sections was an axe failure once already.
    expect(html).not.toContain('role="region"');
  });
});

describe.skipIf(!anyBuilt)("exported /about (AC 3)", () => {
  it("was exported at all — a build that skipped it fails here, it does not skip", () => {
    expect(existsSync(ABOUT_HTML), "out/about/index.html missing").toBe(true);
  });

  it("carries the full attribution, the methodology note and the credits", () => {
    const html = readFileSync(ABOUT_HTML, "utf8");
    expect(html).toContain(es.about.title);
    // The attribution is the ALREADY-RULED string, split at its sentence
    // boundary in the component — never a second copy minted in a new key.
    const sentences = es.chrome.footer.attribution.split(". ");
    /*
     * ASSERT THE SHAPE BEFORE DESTRUCTURING (2.18 code review). This read
     * `const [dataSentence, independence] = …split(". ")`, so a one-sentence
     * rewording made `independence` undefined and `toContain(undefined)` threw
     * a TypeError — the guard failed pointing at itself instead of reporting
     * that AC 3's independence disclaimer had vanished from the page.
     */
    expect(
      sentences.length,
      "the ruled attribution must stay two sentences — AC 3 requires the independence disclaimer to stand alone"
    ).toBeGreaterThanOrEqual(2);
    const [dataSentence, independence] = sentences;
    expect(html).toContain(dataSentence);
    expect(html).toContain(independence);
    expect(html).toContain(es.about.methodology);
    expect(html).toContain(es.about.credits);
    expect(html).toContain(es.about.project);
  });

  it("states the per-shot xG absence, not just 'used as-is' (FD-1, decision 1)", () => {
    /*
     * The AC's own parenthetical is MISLEADING: per-shot xG does not exist in
     * the source PDFs at all (team totals only), which is why every shot marker
     * is drawn at the same size. This is the page whose purpose is to explain
     * the data honestly, so the absence must be on it.
     */
    expect(readFileSync(ABOUT_HTML, "utf8")).toContain("no hay un valor por remate");
  });
});

/*
 * ========== STORY 2.13 — LÍDERES DEL TORNEO ON THE HUB (Task 8.4) ==========
 *
 * The harness has no jsdom, no testing-library and no E2E, so the EXPORTED HTML
 * is where a rendered decision becomes assertable at all. Everything below is
 * read off the same `out/index.html` the suites above use, and every expected
 * string comes from the DICTIONARY OBJECT or the fixture rather than from the
 * components under test.
 */
describe.skipIf(!anyBuilt)("exported / — the leaderboards section (Story 2.13)", () => {
  const html = () => readFileSync(INDEX_HTML, "utf8");

  it("carries the ruled anchor and the ruled heading", () => {
    /*
     * `#lideres` is the anchor THIS STORY RULES: no Hub anchor is specified in
     * any planning artifact, EXPERIENCE.md's enumerated set is
     * Match-Dashboard-only, and UX-DR18 requires "stable deep-link anchors for
     * every section". If Story 2.12 lands a different id, adopt ITS and change
     * this line — two ids is the only bad outcome.
     */
    expect(html()).toContain('id="lideres"');
    expect(html()).toContain(es.leaderboards.title);
    expect(es.leaderboards.title).toBe("Líderes del torneo");
  });

  it("renders EVERY board in the artifact, keyed off metricCode + scope", () => {
    /*
     * Driven off the fixture's own board list, never off three (AC 2). A board
     * carries no id and no title, so its heading IS its identity: metric label
     * + scope label.
     */
    const page = html();
    expect(LEADERBOARD_FIXTURE.boards.length).toBeGreaterThan(0);
    for (const board of LEADERBOARD_FIXTURE.boards) {
      const label = t(leaderboardMetricKey(board.metricCode));
      expect(page, `missing heading for ${board.metricCode}`).toContain(label);
    }
    expect(page).toContain(es.leaderboards.scope.team);
    expect(page).toContain(es.leaderboards.scope.player);
  });

  it("pre-renders the teasers at hero altitude, from the BUILD-TIME read", () => {
    /*
     * AD-11: the teasers must survive with no JavaScript and before the runtime
     * fetch resolves, so they are in the exported HTML.
     *
     * ASSERTED ON RENDERED OUTPUT, NEVER ON A NAME (2.13 code review). The
     * version that shipped asserted `toContain("SON Heungmin")` — and that name
     * occurs TWICE in the document, once as markup and once inside the RSC
     * flight payload, so the test passed on the serialized prop alone. Delete
     * the entire <ol> from BoardTeaser and it stayed green.
     *
     * A LOCALE-FORMATTED VALUE cannot appear in the payload: the artifact
     * carries `35.2` as a raw number and only the render produces "35,2 km/h",
     * with a NON-BREAKING space (ruling 6). That string is proof the component
     * ran.
     */
    const page = html();
    expect(page).toContain(es.leaderboards.teaserHeading);
    expect(page).toContain(`35,2 ${es.enums.unit.kmh}`);
  });

  it("inlines ONLY the teaser rows, never the whole artifact (AD-11)", () => {
    /*
     * `LeaderboardsSection` is a client component, so its prop is serialized
     * into this document's flight payload. It used to receive the whole
     * `Leaderboards`, which put all 32 fixture rows into the HTML to render 9 —
     * and the runtime region then fetched the same bytes again. At the 2.19
     * DATA_ROOT flip that is ~409 KB inlined into the Hub AND re-downloaded, on
     * a Lighthouse->=90 route. `page.tsx` now passes `leaderboardTeasers(...)`.
     *
     * The sibling guard for `tournament.json` asserts on `knockoutResults` —
     * a Tournament-only field name, which is why it could never fire on this.
     * These are the leaderboards' own tells: `aggregation` and `higherIsBetter`
     * are board fields the teaser does not paint, and `gonzalez-armando-mex`
     * sits at rank 20 of topSpeed, in no teaser at all.
     */
    const page = html();
    expect(page).not.toContain("aggregation");
    expect(page).not.toContain("higherIsBetter");
    expect(page).not.toContain("gonzalez-armando-mex");
  });

  it("links every player row to its Player Profile and every team row to its team", () => {
    /*
     * RULING 3, and the trailing slash is REQUIRED (`trailingSlash: true`) — an
     * assertion on the slash-less form passes on a document that links nowhere.
     * Both routes are unbuilt today; that is the shipped LineupsDisclosure /
     * MatchHero precedent, which `matches/static-output.test.ts` already pins
     * green, not a departure. AD-3 makes the entity id the slug.
     */
    const page = html();
    expect(page).toContain('href="/players/son-heungmin-kor/"');
    expect(page).toMatch(/href="\/teams\/[a-z0-9-]+\/"/);
  });

  it("renders the teaser's km/h figure with its unit, formatted es-CO", () => {
    /*
     * RULING 6 and UJ-4's own example. A teaser row has NO COLUMN HEAD to carry
     * the unit, so it composes value + unit — "35,2 km/h" — joined by a
     * NON-BREAKING space, which is what the   below is. In a table cell the
     * value stays bare and the unit rides the head instead.
     */
    expect(html()).toContain(`35,2 ${es.enums.unit.kmh}`);
  });

  it("names its section exactly once, and adds NO display-score element", () => {
    /*
     * The `type-display-score` invariant belongs to the MATCH route and is
     * deliberately not copied here — this section ships no score at all.
     *
     * THE LANDMARK ASSERTION WAS SELF-CONTRADICTORY (2.13 code review). It read
     * `not.toContain('role="region"')` beside `toContain('aria-labelledby=
     * "lideres-title"')` — but a <section> WITH an accessible name has the
     * implicit ARIA role `region` and IS a landmark; `aria-labelledby` on a
     * section is precisely what triggers it. So the second assertion proved the
     * landmark exists while the first claimed it did not, and a grep for the
     * literal attribute can never observe an implicit role — it would have
     * stayed green no matter how many named <section>s were added, which is
     * exactly the "22 landmarks for 11 sections" axe failure it cited.
     *
     * What is actually worth pinning is that this section contributes ONE
     * landmark and names it once: a duplicated id would give two landmarks the
     * same name, and duplicate ids are their own defect.
     */
    const page = html();
    expect(page).not.toContain("type-display-score");
    expect(page.match(/id="lideres"/g) ?? []).toHaveLength(1);
    expect(page.match(/aria-labelledby="lideres-title"/g) ?? []).toHaveLength(1);
    expect(page.match(/id="lideres-title"/g) ?? []).toHaveLength(1);
  });

  it("ships NO chart and NO recharts markup on the Hub (ruling 2)", () => {
    /*
     * EXPERIENCE.md's Visualization Layering row gives leaderboards exactly two
     * altitudes — "Top-3 teaser rows | — | Full sortable table" — and the em
     * dash at Tactical altitude is the ruling. There are exactly two recharts
     * import specifiers in the app and the vendor duplication is PER SPECIFIER,
     * so a third would put a third ~300 KB chunk on a Lighthouse->=90 route.
     */
    const page = html();
    expect(page).not.toContain("recharts");
    expect(page).not.toContain("<pattern");
  });
});

describe.skipIf(!anyBuilt)("the footer reaches both /about and /glossary on every route (AC 3)", () => {
  it("links both from the site chrome, on an unrelated route", () => {
    // EXPERIENCE.md's IA route table names the footer as /glossary's reach
    // path; DESIGN.md's footer bullet mentions only /about and is stale (filed).
    // trailingSlash: true, so Next rewrites both hrefs — asserting the
    // slash-less form passes on a document that links nowhere.
    const html = readFileSync(INDEX_HTML, "utf8");
    expect(html).toContain('href="/about/"');
    expect(html).toContain('href="/glossary/"');
    expect(html).toContain(es.chrome.footer.glossaryLink);
  });
});

/*
 * AC 5's "loads ONLY" half — Task 9.3, written at code review.
 *
 * THE STORY MANDATED THIS TEST AND IT WAS NEVER WRITTEN. Task 9.3 is explicit:
 * "Write the test as an ALLOW-LIST — {/index/tournament.json,
 * /index/leaderboards.json} — never `toHaveLength(1)`", the latter because it
 * would turn red the day Story 2.13 adds its fetch and tempt 2.13 to weaken it.
 * The Completion Notes claimed the assertion shipped; it had not.
 *
 * WHY A MODULE WALK RATHER THAN A NETWORK ASSERTION. The harness is
 * `environment: "node"` with no jsdom, so nothing can be mounted and no fetch
 * can be observed. What IS decidable statically is the thing AC 5 actually
 * constrains: which artifact paths are reachable from this route's module
 * graph. The walk starts at `src/app/page.tsx` and follows every `@/` import
 * transitively, so a third `fetchArtifact` added ANYWHERE under the Hub — in a
 * shared component, in a lib helper, in a future section — fails here.
 *
 * The other half of AD-4 stays out: the App never measures bytes ("measured by
 * the Pipeline, the App never re-measures"), and the combined-budget gate is
 * Story 1.17's D3/D5.
 */
const ARTIFACT_ALLOW_LIST = ["/index/leaderboards.json", "/index/tournament.json"];
const SRC_DIR = fileURLToPath(new URL("../", import.meta.url));
const ALIAS_IMPORT = /from\s+"@\/([^"]+)"/g;
const FETCH_ARTIFACT_PATH = /fetchArtifact\s*<[^>]*>\s*\(\s*"([^"]+)"/g;

/** Resolves an `@/x/y` specifier to a real file, or null for type-only paths. */
function resolveAlias(specifier: string): string | null {
  for (const candidate of [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`]) {
    const full = SRC_DIR + candidate;
    if (existsSync(full)) {
      return full;
    }
  }
  return null;
}

function artifactPathsReachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const found = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(FETCH_ARTIFACT_PATH)) {
      found.add(match[1]);
    }
    for (const match of source.matchAll(ALIAS_IMPORT)) {
      const resolved = resolveAlias(match[1]);
      if (resolved !== null) {
        queue.push(resolved);
      }
    }
  }
  return [...found].sort();
}

describe("/ artifact fetches (AC 5, Task 9.3)", () => {
  it("reaches EXACTLY the two allow-listed artifacts and no others", () => {
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/page.tsx");
    // Set equality, deliberately: a MISSING fetch is as much a defect as an
    // extra one — it would mean a surface stopped loading its own data.
    expect(reachable).toEqual(ARTIFACT_ALLOW_LIST);
  });

  it("walks far enough to see a fetch that is several modules deep", () => {
    /*
     * Guards the guard. If `resolveAlias` ever stops resolving — a changed
     * path alias, a moved file — the walk would visit page.tsx alone, find
     * nothing, and the assertion above would fail loudly rather than pass
     * vacuously. `page.tsx` itself contains no `fetchArtifact` call at all:
     * both live two hops away, in the client regions.
     */
    expect(readFileSync(SRC_DIR + "app/page.tsx", "utf8")).not.toContain("fetchArtifact");
    expect(artifactPathsReachableFrom(SRC_DIR + "app/page.tsx").length).toBe(2);
  });

  it("does NOT reach the match bundle — that path belongs to /matches/{id} (FR-34)", () => {
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/page.tsx");
    expect(reachable.some((artifactPath) => artifactPath.includes("matches"))).toBe(false);
  });
});
