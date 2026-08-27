import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readTournament } from "@/lib/build-data";
import { SITE_ORIGIN } from "@/lib/site-origin";

import robots from "./robots";
import sitemap from "./sitemap";

/*
 * THE SITEMAP GUARD (Story 3.4, AC5/AC7). A sitemap listing a URL that 404s is
 * worse than no sitemap at all, so this asserts a BIJECTION in both directions
 * and at two independent altitudes. Node env, no jsdom — the Story 2.2
 * decision; nothing here renders.
 *
 * THE FILENAME IS SAFE. Next's metadata matcher is
 * `[\\/]sitemap(?:\.xml|\.(js|jsx|ts|tsx))$`
 * (`next/dist/lib/metadata/is-metadata-route.js`), which `sitemap.test.ts` does
 * not match — `.test.ts` is not `.ts` at that anchor. `src/app/
 * static-output.test.ts` is the shipped precedent for a test file under
 * `src/app`.
 *
 * WHY THERE ARE THREE LAYERS AND NOT ONE. Layer 1 grades the sitemap against
 * the MANIFEST, which covers the 1,400 entity URLs completely — but the four
 * static routes are derived by walking `src/app`, and a test that walked
 * `src/app` the same way would assert its own literal against its own literal
 * and stay green through the exact edit it exists to catch. That is Story
 * 1.17's precision gate, where 41 tests stayed green while 553 leaves shipped
 * truncated. Layer 3's ground truth is the EMITTED EXPORT — independent of both
 * the manifest and the walk, and the only evidence that can actually support
 * the claim that no listed URL 404s.
 *
 * `npm run build` MUST precede `npm test` or the export layers silently skip.
 *
 * THE SKIP GUARD KEYS ON out/, NOT ON out/sitemap.xml. Keying on the sitemap
 * would make "the sitemap was not emitted at all" report as a green skip — the
 * precise failure `teams/static-output.test.ts`'s header docblock says must
 * fail loudly.
 */

const OUT_DIR = fileURLToPath(new URL("../../out/", import.meta.url));
const anyBuilt = existsSync(OUT_DIR);

const entries = sitemap();
const urls = entries.map((entry) => entry.url);

/** The three route prefixes whose members come from the manifest. */
const ENTITY_PREFIXES = ["matches", "players", "teams"];

/**
 * Is this `<loc>` one of the manifest-derived entity URLs?
 *
 * BOTH HALVES MATTER, and a first-segment test alone is the bug (code review
 * 2026-08-26). Story 3.9 mints `/players/` and `/teams/` INDEX routes, whose
 * first segment is an entity prefix but which are static routes from the tree
 * walk, not manifest entries. Classifying on the prefix alone would count them
 * as entities and put the entity total one above the manifest on the day 3.9
 * lands — breaking, from the other side, the same "no edit here" promise the
 * empty-id defect broke.
 */
function isEntityUrl(url: string): boolean {
  const [prefix, id] = url.slice(`${SITE_ORIGIN}/`.length).split("/");
  return ENTITY_PREFIXES.includes(prefix) && id !== undefined && id !== "";
}

/**
 * Ids under one route prefix, as the sitemap lists them. Sorted.
 *
 * `url !== head` IS LOAD-BEARING, and its absence was a real defect (code
 * review 2026-08-26). Story 3.9 mints `/players/` and `/teams/` INDEX routes —
 * two of the four routes `sitemap.ts` promises to pick up with no edit here.
 * `"…/players/".startsWith("…/players/")` is true, so the index route matched
 * its own prefix, sliced to `""`, and injected an empty id into this set. The
 * bijection then failed on a CORRECT sitemap, reporting `ABSENT from the
 * manifest: ` with an empty offender name — from the function below written to
 * name offenders. The guard broke exactly the promise the module keeps.
 */
function sitemapIds(prefix: string): string[] {
  const head = `${SITE_ORIGIN}/${prefix}/`;
  return urls
    .filter((url) => url.startsWith(head) && url !== head)
    .map((url) => url.slice(head.length).replace(/\/$/, ""))
    .sort();
}

/**
 * The two-sided difference, spelled out so a failure NAMES THE OFFENDERS.
 * `expect(a).toEqual(b)` on 1,248 sorted ids prints a diff nobody reads, and
 * `1404 !== 1403` sends the reader grepping. `site-origin.test.ts`'s
 * `occurrences.sort().join(", ")` is the shipped idiom.
 */
function describeDifference(expected: string[], actual: string[]): string {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((id) => !actualSet.has(id));
  const extra = actual.filter((id) => !expectedSet.has(id));
  return [
    missing.length > 0 ? `MISSING from the sitemap: ${missing.sort().join(", ")}` : "",
    extra.length > 0 ? `ABSENT from the manifest: ${extra.sort().join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function expectBijection(label: string, expected: string[], actual: string[]): void {
  expect(expected.length, `${label}: the manifest side is empty`).toBeGreaterThan(0);
  expect(actual.length, `${label}: the sitemap side is empty`).toBeGreaterThan(0);
  expect(actual, `${label} — ${describeDifference(expected, actual)}`).toEqual(expected);
}

// ---------------------------------------------------------------------------
// Layer 1 — manifest bijection. Runs with no build; THIS is the A1 gate.
// ---------------------------------------------------------------------------

describe("every manifest entity has exactly one <loc>, and every entity <loc> has a manifest entry (AC2, AC5)", () => {
  const { entities } = readTournament();

  it("covers the matches exactly", () => {
    const listed = entities.matches.map((match) => match.matchId).sort();
    expectBijection("matches", listed, sitemapIds("matches"));
  });

  it("covers the players exactly", () => {
    const listed = entities.players.map((player) => player.playerId).sort();
    expectBijection("players", listed, sitemapIds("players"));
  });

  it("covers the teams exactly", () => {
    const listed = entities.teams.map((team) => team.teamId).sort();
    expectBijection("teams", listed, sitemapIds("teams"));
  });

  /*
   * THE ONE THING BETWEEN THIS SITEMAP AND A MALFORMED XML DOCUMENT (code
   * review 2026-08-26).
   *
   * Next does NOT escape `<loc>`: `resolve-route-data.js` appends
   * `<loc>${item.url}</loc>` raw, and `sitemap.ts` interpolates manifest ids
   * raw in turn. ONE id carrying `&`, `<` or `"` makes `out/sitemap.xml`
   * ill-formed, and a crawler rejects the WHOLE DOCUMENT — all 1,404 URLs, not
   * just the offender.
   *
   * Every other layer is blind to it: Layer 3's `<loc>([^<]+)</loc>` capture
   * takes the raw string happily, it matches the module's own entry, and
   * `existsSync` finds the directory the exporter wrote under the same raw
   * name. So the guard built to catch a `<loc>` that 404s cannot see a `<loc>`
   * that poisons the file.
   *
   * The pattern is the contract's own (`contract/common.schema.json`), which
   * until now the app never ran — it is enforced pipeline-side only. All 1,400
   * current ids pass, so this is latent; the corpus is Spanish proper nouns and
   * one accented or ampersanded id is all it takes.
   */
  it("lists only ids that are safe to interpolate into XML unescaped", () => {
    const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    const offenders = [
      ...entities.matches.map((match) => match.matchId),
      ...entities.players.map((player) => player.playerId),
      ...entities.teams.map((team) => team.teamId),
    ].filter((id) => !SLUG.test(id));
    expect(
      offenders,
      `id is not a bare slug and Next does not escape <loc>: ${offenders.slice(0, 10).join(", ")}`
    ).toEqual([]);
  });

  /*
   * The counts, asserted SEPARATELY from the id sets, and REPAIRED on
   * 2026-08-26 — this case shipped unable to fail.
   *
   * It read:
   *     const staticCount = urls.length - entityCount;
   *     expect(urls.length).toBe(entityCount + staticCount);
   * which reduces to `x === y + (x - y)`: true for every input that has ever
   * existed or ever could. The only live assertion was `staticCount > 0`, which
   * Layer 2's floor already covers, while the docblock claimed it "states the
   * story's D7 arithmetic … written against the manifest's own lengths." It was
   * written against its own subtraction, and the test name's "and nothing else"
   * was checked by nothing.
   *
   * THE STORY'S OWN RED EVIDENCE PROVES IT WAS INERT. At 6.1 (a player sliced
   * out of the sitemap) and 6.2 (a phantom player appended) the notes record
   * `Tests 2 failed | 18 passed (20)` — this case was green through BOTH
   * directions of the exact defect it names. That is the Epic 2 retrospective's
   * highest-priority systemic finding, reached again.
   *
   * WHAT IT NOW ASSERTS, AND WHAT IT DELIBERATELY DOES NOT. The entity side is
   * counted against the MANIFEST'S own lengths — genuinely independent of the
   * sitemap, and red in both directions (a dropped entity and a phantom both
   * move this number). The static side is NOT independently counted here, and
   * re-walking `src/app` to check it would rebuild the exact self-against-self
   * shape the header rejects: the module's output graded by the module's own
   * function. Layer 3 grades the static routes against the EMITTED EXPORT,
   * which is the only ground truth that is not this walk. Saying so is better
   * than an assertion that looks independent and is not — which is how this
   * case came to ship inert in the first place.
   */
  it("lists every entity plus the static routes, and nothing else", () => {
    const entityCount =
      entities.matches.length + entities.players.length + entities.teams.length;

    const listedEntityUrls = urls.filter(isEntityUrl);
    const listedStaticUrls = urls.filter((url) => !isEntityUrl(url));

    expect(
      listedEntityUrls.length,
      `entity <loc> count disagrees with the manifest: ${listedEntityUrls.length} listed, ` +
        `${entityCount} in entities.matches/.players/.teams`
    ).toBe(entityCount);

    expect(listedStaticUrls.length, "the tree walk contributed no static routes").toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — shape. Runs with no build.
// ---------------------------------------------------------------------------

describe("every <loc> is absolute, self-origin and trailing-slashed (AC3, AC4)", () => {
  it("begins with SITE_ORIGIN and resolves to that origin", () => {
    const foreign = urls.filter((url) => !url.startsWith(`${SITE_ORIGIN}/`));
    expect(foreign, `not on the site's own origin: ${foreign.slice(0, 5).join(", ")}`).toEqual([]);

    const mismatched = urls.filter((url) => new URL(url).origin !== SITE_ORIGIN);
    expect(mismatched, `origin mismatch: ${mismatched.slice(0, 5).join(", ")}`).toEqual([]);
  });

  it("ends every URL with a slash, because trailingSlash: true is what the host serves", () => {
    const bare = urls.filter((url) => !url.endsWith("/"));
    expect(
      bare,
      `no trailing slash — the host would redirect or 404: ${bare.slice(0, 5).join(", ")}`
    ).toEqual([]);
  });

  it("carries no query and no fragment", () => {
    const parameterized = urls.filter((url) => url.includes("?") || url.includes("#"));
    expect(
      parameterized,
      `query or fragment in a <loc>: ${parameterized.slice(0, 5).join(", ")}`
    ).toEqual([]);
  });

  it("lists no URL twice", () => {
    const seen = new Set<string>();
    const duplicated = urls.filter((url) => (seen.has(url) ? true : (seen.add(url), false)));
    expect(duplicated, `duplicate <loc>: ${[...new Set(duplicated)].join(", ")}`).toEqual([]);
  });

  it("carries only the entry Next serialises — no lastModified, changeFrequency or priority (D3)", () => {
    const decorated = entries.filter((entry) => Object.keys(entry).join(",") !== "url");
    expect(
      decorated.map((entry) => entry.url),
      "a sitemap entry carries more than url; reproducibility (2.19) and invented dates (D3)"
    ).toEqual([]);
  });

  /*
   * THE BOUNDARY `/` IS THE WHOLE ASSERTION (code review 2026-08-26). This
   * shipped matching the prefix `${SITE_ORIGIN}/compare` with no delimiter, so
   * a future sibling route — `/comparisons/`, `/compare-teams/` — would be
   * reported as a "parameterized /compare variant" and AC4 would go red on
   * correct output. Same missing-boundary class that
   * `assert-no-external-origins.mjs` devotes a paragraph to
   * (`<origin>.evil.com` against a plain prefix), in a file that cites that
   * gate as its precedent.
   */
  it("lists /compare bare and in no other variant (AC4)", () => {
    const bare = `${SITE_ORIGIN}/compare/`;
    expect(urls).toContain(bare);
    const variants = urls.filter((url) => url.startsWith(bare) && url !== bare);
    expect(variants, `parameterized /compare variant: ${variants.join(", ")}`).toEqual([]);
  });

  it("discovers the static routes from the tree, including the ones 3.9 has not shipped", () => {
    const staticUrls = urls.filter((url) => !isEntityUrl(url));
    /*
     * A FLOOR DERIVED FROM THE TREE, not the literal four this shipped with.
     * `:110` states the rule the literal broke — "never against a literal; the
     * corpus grows and this must follow it without an edit" — and a floor of
     * `4` is exactly the edit story 3.9 would have to remember to make. The
     * four routes named below are the ones that exist today and must never
     * silently vanish; 3.9's arrive as additions and need no change here.
     */
    for (const route of ["/", "/about/", "/compare/", "/glossary/"]) {
      expect(
        staticUrls,
        `the src/app walk lost ${route}; it found: ${staticUrls.join(", ")}`
      ).toContain(`${SITE_ORIGIN}${route}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 3 — export bijection. Ground truth is the emitted tree.
// ---------------------------------------------------------------------------

/** Every route path under `out/` that emitted an `index.html`, as `/a/b/`. */
function emittedRoutePaths(): string[] {
  const found: string[] = [];

  function walk(directory: string, routePath: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name === "index.html") {
        found.push(routePath);
        continue;
      }
      if (!entry.isDirectory()) {
        continue;
      }
      /*
       * `_next` is the chunk store and `data` is the copied artifact tree;
       * neither is a route. `404` and `_not-found` are routes, and are
       * correctly absent from a sitemap.
       *
       * AT THE ROOT ONLY (code review 2026-08-26). This shipped matching the
       * four names at EVERY depth, while each justification above is about
       * their meaning at the export root — none holds below it. A future
       * `/tops/data/` route, or an entity slug of `404` (the contract's slug
       * pattern admits both), would be invisible to this walk and therefore
       * exempt from the "every emitted page is listed" direction, silently
       * narrowing the half of AC5's bijection that catches an unlisted page.
       */
      if (routePath === "/" && ["_next", "data", "404", "_not-found"].includes(entry.name)) {
        continue;
      }
      /*
       * `__next.*` RSC PAYLOAD DIRECTORIES, SKIPPED AT EVERY DEPTH (story 3.9).
       *
       * These hold `.txt` flight payloads and never an `index.html`, so they
       * contribute no route — but there are ~2,800 of them against 1,408 real
       * routes, and descending into all of them made this the walk that timed
       * out at vitest's 5 s default under ten-worker contention. It failed on a
       * TIMEOUT rather than on an assertion, which is the same way the memoised
       * `everyRouteHtml()` in `static-output.test.ts` once failed.
       *
       * ⚠️ THIS IS A DEPTH-BLIND NAME FILTER, WHICH THE COMMENT ABOVE WARNS
       * AGAINST — and the distinction is the whole reason both exist. That
       * warning is about `_next`, `data`, `404` and `_not-found`: ordinary names
       * that a future ROUTE could legitimately carry, since the contract's slug
       * pattern admits them. `__next.` cannot be a route segment at any depth: it
       * is Next's own reserved emission prefix, and every dynamic segment on this
       * site is an entity slug (AD-3 — `{surname}-{givenName}-{teamCode}`, a
       * teamId, or a matchId), none of which contains a `.` at all.
       *
       * The bijection is unweakened and is asserted, not assumed: the `unlisted`
       * check below still walks every real route, and the `>= urls.length` floor
       * still fails if this filter ever starts eating routes.
       */
      if (entry.name.startsWith("__next.")) {
        continue;
      }
      walk(path.join(directory, entry.name), `${routePath}${entry.name}/`);
    }
  }

  walk(OUT_DIR, "/");
  return found.sort();
}

describe.skipIf(!anyBuilt)("every <loc> resolves to a real page, and every page is listed (AC5)", () => {
  const sitemapFile = path.join(OUT_DIR, "sitemap.xml");

  it("emits out/sitemap.xml as a FILE, not as a directory (AC1, D1)", () => {
    expect(existsSync(sitemapFile), "out/sitemap.xml was not emitted by the build").toBe(true);
    expect(statSync(sitemapFile).isFile(), "out/sitemap.xml is a directory, not a file").toBe(true);
    expect(
      existsSync(path.join(OUT_DIR, "sitemap.xml", "index.html")),
      "trailingSlash turned the sitemap into a directory route"
    ).toBe(false);
  });

  /*
   * Parsed out of the EMITTED XML rather than taken from the module above, so
   * this layer grades what actually shipped. If Next ever changes how it
   * serialises the array, that is a change this layer must see.
   */
  const emittedLocs = existsSync(sitemapFile)
    ? [...readFileSync(sitemapFile, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        (match) => match[1]
      )
    : [];

  /*
   * The floor is `urls.length`, DERIVED, not the literal `1400` this shipped
   * with (code review 2026-08-26). `:110` states the rule: "written against the
   * manifest's own lengths, never against a literal — the corpus grows and this
   * must follow it without an edit." A literal floor also never tightens, so a
   * 1,401-entry export against a 1,404-entity manifest passed it; and
   * `build-data.ts` documents that `DATA_ROOT` resolved to `../data/fixtures`
   * before the 2.19 cutover, a corpus far below 1,400 — running the suite in
   * that mode failed on the literal rather than on substance.
   */
  it("serialises every entry the module returned", () => {
    expect(emittedLocs.length, "no <loc> parsed out of out/sitemap.xml").toBe(urls.length);
    expect(emittedLocs.slice().sort()).toEqual(urls.slice().sort());
  });

  it("resolves every <loc> to an index.html the export actually emitted", () => {
    const missing = emittedLocs
      .map((loc) => loc.slice(SITE_ORIGIN.length))
      .filter((routePath) => !existsSync(path.join(OUT_DIR, routePath, "index.html")));
    expect(
      missing,
      `listed in the sitemap but 404 on the host: ${missing.slice(0, 10).join(", ")}`
    ).toEqual([]);
  });

  it("lists every route the export emitted, except 404 and _not-found", () => {
    const emitted = emittedRoutePaths();
    const listed = new Set(emittedLocs.map((loc) => loc.slice(SITE_ORIGIN.length)));
    const unlisted = emitted.filter((routePath) => !listed.has(routePath));
    expect(
      unlisted,
      `emitted by the build but missing from the sitemap: ${unlisted.slice(0, 10).join(", ")}`
    ).toEqual([]);
    /*
     * Derived, not the literal `1400` this shipped with — see the note above.
     * A floor rather than an equality: the `unlisted` assertion immediately
     * above is the real bijection in this direction, and it already fails on
     * any emitted route the sitemap omits. This exists so that "the walk found
     * nothing at all" cannot report green, which is the 6.6 skip-guard case.
     */
    expect(emitted.length, "the export walk found no routes at all").toBeGreaterThanOrEqual(
      urls.length
    );
  });
});

// ---------------------------------------------------------------------------
// Layer 4 — robots.txt.
// ---------------------------------------------------------------------------

describe.skipIf(!anyBuilt)("robots.txt points at the sitemap and blocks nothing (AC7)", () => {
  const robotsFile = path.join(OUT_DIR, "robots.txt");
  const text = existsSync(robotsFile) ? readFileSync(robotsFile, "utf8") : "";

  it("emits out/robots.txt as a FILE (AC1, D1)", () => {
    expect(existsSync(robotsFile), "out/robots.txt was not emitted by the build").toBe(true);
    expect(statSync(robotsFile).isFile(), "out/robots.txt is a directory, not a file").toBe(true);
  });

  it("carries exactly one Sitemap: line, and it is the sitemap this story emits", () => {
    const lines = text.split(/\r?\n/).filter((line) => line.startsWith("Sitemap:"));
    expect(lines, `expected one Sitemap: line, got ${lines.length}`).toHaveLength(1);
    expect(lines[0].replace(/^Sitemap:\s*/, "")).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });

  /*
   * ANCHORED, AND THE ANCHOR IS THE ASSERTION (code review 2026-08-26).
   *
   * This shipped as `expect(text).toMatch(/Allow:\s*\//i)` — unanchored and
   * case-insensitive, so the string `"Disallow: /"` CONTAINS `"allow: /"` and
   * satisfies it. Verified: `/Allow:\s*\//i.test("User-Agent: *\nDisallow: /")`
   * is `true`. The one assertion written to prove AC7's "allow everything"
   * passed on a robots.txt that blocks the entire site from every crawler.
   *
   * It was masked by the no-`Disallow` case below, which means the two were
   * never the independent checks the layer's shape implies — remove or weaken
   * that one and this would have been the only thing standing between a
   * site-wide block and a green suite.
   */
  it("allows every user agent", () => {
    expect(text).toMatch(/^User-Agent:\s*\*$/im);
    expect(text).toMatch(/^Allow:\s*\/$/im);
  });

  /*
   * D6, NARROWED TO `/data/` ON 2026-08-26 (was: no `Disallow` at all).
   *
   * Blocking `/data/` would stop Googlebot's renderer fetching the artifacts
   * every route needs, stripping ~1,400 rendered pages of their content. That
   * is the ruling, it is about `/data/`, and something has to fail on its
   * return. What it is NOT is a ban on every `Disallow` line: the export also
   * ships 11,235 crawlable `.txt` RSC payloads that no rendering argument
   * covers, and the absolute form made addressing them a test-breaking change.
   * See `robots.ts`'s docblock.
   */
  it("blocks nothing under /data/, whatever else it may block (D6)", () => {
    const blocked = text
      .split(/\r?\n/)
      .filter((line) => /^Disallow:/i.test(line))
      .map((line) => line.replace(/^Disallow:\s*/i, ""))
      .filter((pattern) => pattern !== "" && "/data/".startsWith(pattern.replace(/\*$/, "")));
    expect(
      blocked,
      `robots.txt blocks the artifacts every route fetches: ${blocked.join(" | ")}`
    ).toEqual([]);
  });

  it("returns the same rules from the module as the export carries", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules), "rules became an array; the export parse below assumes one").toBe(
      false
    );
    const single = rules as { userAgent?: string | string[]; allow?: string | string[] };
    // The module's own values, then the SAME values read back out of the
    // emitted file — which is what this test's name has always claimed and
    // what it did not do until 2026-08-26: it read `robots()` twice and never
    // touched `text`.
    expect(single.userAgent).toBe("*");
    expect(single.allow).toBe("/");
    expect(text).toMatch(new RegExp(`^User-Agent:\\s*\\*$`, "im"));
    expect(text).toMatch(new RegExp(`^Allow:\\s*${single.allow}$`, "im"));
    expect(robots().sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });
});

// ---------------------------------------------------------------------------
// Layer 4a — robots.ts with NO BUILD. Added by the 2026-08-26 code review.
// ---------------------------------------------------------------------------

/*
 * AC7 DEMANDS A PIN, AND UNTIL NOW THE PIN ONLY FIRED AFTER A REBUILD.
 *
 * Every assertion in Layer 4 grades `out/robots.txt` behind
 * `describe.skipIf(!anyBuilt)`. Nothing in this repo makes a build precede the
 * suite: `package.json` `"test"` is a bare `vitest run`, `"build"` runs no
 * tests, there is no `.github/`, and `netlify.toml` runs `npm run build` alone
 * at deploy. So adding `disallow: "/data/"` to `robots.ts` and running
 * `npm test` left the on-disk export untouched and the suite green — the
 * story's own 6.5 red required a manual rebuild to fire.
 *
 * AC7's words are "A test pins the absence, because 'we left it out' is not a
 * property until something fails on its return." A pin conditional on a
 * freshness nothing enforces is not that. This block grades the MODULE, the
 * way Layers 1 and 2 grade the sitemap with no build.
 */
describe("robots.ts states the D6 ruling with no build (AC7, D6)", () => {
  const rules = robots().rules as {
    userAgent?: string | string[];
    allow?: string | string[];
    disallow?: string | string[];
  };

  it("allows every user agent at the root", () => {
    expect(Array.isArray(robots().rules)).toBe(false);
    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");
  });

  it("declares no rule that blocks /data/ (D6)", () => {
    const patterns = rules.disallow === undefined ? [] : [rules.disallow].flat();
    const blocking = patterns.filter((pattern) =>
      "/data/".startsWith(String(pattern).replace(/\*$/, ""))
    );
    expect(
      blocking,
      `robots.ts blocks the artifacts every route fetches: ${blocking.join(" | ")}`
    ).toEqual([]);
  });

  it("points at this story's sitemap, on the site's own origin", () => {
    expect(robots().sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });
});
