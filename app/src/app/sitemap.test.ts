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

/** Ids under one route prefix, as the sitemap lists them. Sorted. */
function sitemapIds(prefix: string): string[] {
  const head = `${SITE_ORIGIN}/${prefix}/`;
  return urls
    .filter((url) => url.startsWith(head))
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
   * The counts, asserted SEPARATELY from the id sets. The set assertions above
   * would catch a drop too, but this one states the story's D7 arithmetic in
   * the failure message: 104 + 1,248 + 48 entities + the tree-walked static
   * routes. It is written against the manifest's own lengths, never against a
   * literal — the corpus grows and this must follow it without an edit.
   */
  it("lists every entity plus the static routes, and nothing else", () => {
    const entityCount =
      entities.matches.length + entities.players.length + entities.teams.length;
    const staticCount = urls.length - entityCount;
    expect(staticCount, "the tree walk contributed no static routes").toBeGreaterThan(0);
    expect(urls.length).toBe(entityCount + staticCount);
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

  it("lists /compare bare and in no other variant (AC4)", () => {
    expect(urls).toContain(`${SITE_ORIGIN}/compare/`);
    const variants = urls.filter(
      (url) => url.startsWith(`${SITE_ORIGIN}/compare`) && url !== `${SITE_ORIGIN}/compare/`
    );
    expect(variants, `parameterized /compare variant: ${variants.join(", ")}`).toEqual([]);
  });

  it("discovers the static routes from the tree, including the ones 3.9 has not shipped", () => {
    const entityPrefixes = ["matches", "players", "teams"];
    const staticUrls = urls.filter((url) => {
      const segment = url.slice(`${SITE_ORIGIN}/`.length).split("/")[0];
      return !entityPrefixes.includes(segment);
    });
    // Asserted as a floor, not a literal four: story 3.9 adds four more and
    // this file must not need an edit when it does.
    expect(
      staticUrls.length,
      `the src/app walk found ${staticUrls.length} static routes: ${staticUrls.join(", ")}`
    ).toBeGreaterThanOrEqual(4);
    expect(staticUrls).toContain(`${SITE_ORIGIN}/`);
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
      // `_next` is the chunk store and `data` is the copied artifact tree;
      // neither is a route. `404` and `_not-found` are routes, and are
      // correctly absent from a sitemap.
      if (["_next", "data", "404", "_not-found"].includes(entry.name)) {
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

  it("serialises every entry the module returned", () => {
    expect(emittedLocs.length, "no <loc> parsed out of out/sitemap.xml").toBeGreaterThan(1400);
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
    expect(emitted.length, "the export walk found no routes at all").toBeGreaterThan(1400);
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

  it("allows every user agent", () => {
    expect(text).toMatch(/User-Agent:\s*\*/i);
    expect(text).toMatch(/Allow:\s*\//i);
  });

  /*
   * D6: blocking /data/ would stop Googlebot's renderer fetching the artifacts
   * every route needs, stripping the rendered pages of their content. The
   * absence is a RULING, so something has to fail on its return.
   */
  it("carries no Disallow at all, least of all /data/ (D6)", () => {
    const disallows = text.split(/\r?\n/).filter((line) => /^Disallow:/i.test(line));
    expect(disallows, `robots.txt blocks something: ${disallows.join(" | ")}`).toEqual([]);
  });

  it("returns the same rules from the module as the export carries", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(false);
    expect(robots().sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });
});
