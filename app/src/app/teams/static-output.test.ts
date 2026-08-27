import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readTeamProfile, readTournament } from "@/lib/build-data";
import { SITE_ORIGIN } from "@/lib/site-origin";
import { es } from "@/locales/es";

/*
 * Verifies the EXPORTED team-route HTML, not live components (node env, no
 * jsdom — the Story 2.2 decision). Kept OUTSIDE the [slug]/ directory by
 * convention: bracketed CLI path-filters trip shell quoting.
 * `matches/static-output.test.ts` is the only precedent — `/players` shipped no
 * static-output test at all — so this file follows it deliberately.
 *
 * `npm run build` MUST precede `npm test` or every assertion here silently
 * skips.
 *
 * THE SKIP GUARD KEYS ON out/, NOT ON out/teams/. Keying on the team directory
 * would make "the route produced nothing at all" indistinguishable from "no
 * build ran" — a build that emitted the shell but zero team routes would report
 * green skips. A partial export must fail loudly; that is what the bijection
 * assertion below is for.
 */

const OUT_DIR = fileURLToPath(new URL("../../../out/", import.meta.url));
const TEAMS_DIR = OUT_DIR + "teams/";
const anyBuilt = existsSync(OUT_DIR);

// trailingSlash: true → out/teams/{teamId}/index.html.
function teamHtml(teamId: string): string {
  return readFileSync(`${TEAMS_DIR}${teamId}/index.html`, "utf8");
}

/*
 * THE COLLECTION-SAFE READ, FOR DESCRIBE-BODY SCOPE ONLY (code review
 * 2026-08-07).
 *
 * Vitest evaluates a `describe` body even when `skipIf` will skip its tests, and
 * three describes below read the fixture route's HTML at that scope. So on the
 * one state this file's header docblock says must "fail loudly" — `out/` exists
 * but `out/teams/mexico/index.html` does not — `readFileSync` threw during
 * COLLECTION and took the whole file down with it, including the bijection
 * assertion that the docblock names as what a partial export must fail on, and
 * including the `"out/teams/ was not emitted by the build"` message written to
 * report exactly this.
 *
 * Returning "" instead keeps collection alive, so the named assertions run and
 * report the real cause; the content assertions then fail on their own terms
 * rather than being silently skipped.
 */
function teamHtmlIfBuilt(teamId: string): string {
  const file = `${TEAMS_DIR}${teamId}/index.html`;
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

/*
 * Count a class only where it appears as a real DOM `class="..."` attribute —
 * the RSC flight payload carries "className" strings that must not be counted,
 * and it fakes passes on raw props generally. COPIED from
 * `matches/static-output.test.ts:36`, where it is a private helper.
 */
function classAttrCount(html: string, token: string): number {
  const pattern = new RegExp(`class="[^"]*\\b${token}\\b[^"]*"`, "g");
  return (html.match(pattern) ?? []).length;
}

function documentTitle(html: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/);
  expect(match, "no <title> in the exported HTML").not.toBeNull();
  return match === null ? "" : match[1];
}

function metaContent(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)="${property}"[^>]*content="([^"]*)"`,
    "i"
  );
  const match = html.match(pattern);
  return match === null ? null : match[1];
}

const FIXTURE_SLUG = "mexico";

describe.skipIf(!anyBuilt)("the /teams route exists and covers the manifest (AC 3)", () => {
  it("emits a route directory", () => {
    expect(existsSync(TEAMS_DIR), "out/teams/ was not emitted by the build").toBe(true);
  });

  /*
   * THE BIJECTION (AD-4 / AR-4). Spelled out rather than compared directly
   * because the two sides are DIFFERENT TYPES: `readdirSync` gives directory
   * names, `entities.teams` gives objects.
   *
   * THIS GATE CANNOT FAIL AS WRITTEN ON THE FIXTURE TREE — `entities.teams` has
   * one entry, so it is green on a directory with one folder. It was DRIVEN RED
   * ON PURPOSE during development by adding a phantom manifest entry; the run is
   * recorded in the story's Debug Log. It becomes a real gate at 2.19's
   * real-data flip, where it covers 48 routes.
   */
  it("generates exactly one route per manifest-listed team, and no others", () => {
    const emitted = readdirSync(TEAMS_DIR).sort();
    const listed = readTournament()
      .entities.teams.map((team) => team.teamId)
      .sort();
    expect(emitted).toEqual(listed);
    expect(emitted.length).toBeGreaterThan(0);
  });

  it("pre-renders the route as index.html under a trailing-slash directory", () => {
    expect(existsSync(`${TEAMS_DIR}${FIXTURE_SLUG}/index.html`)).toBe(true);
  });
});

describe.skipIf(!anyBuilt)("<title> and OG metadata (AC 3, NFR-4)", () => {
  const html = teamHtmlIfBuilt(FIXTURE_SLUG);

  /*
   * BUILT FROM FIXTURE LITERALS, never by calling the composer under test.
   * Story 1.17's precision gate was "grading itself" — both sides came from the
   * table under test — and 41 tests stayed green while 553 leaves shipped
   * truncated.
   *
   * Mexico's record in the fixture is won 4 / drawn 0 / lost 1, furthest stage
   * r16.
   */
  const EXPECTED_TITLE = `Mexico${es.team.meta.separator}4-0-1${es.team.meta.separator}${es.app.siteName}`;
  const EXPECTED_DESCRIPTION = `Mexico${es.team.meta.separator}4-0-1${es.team.meta.separator}${es.enums.stage.r16}`;

  it("carries the team name and record in the document title", () => {
    expect(documentTitle(html)).toBe(EXPECTED_TITLE);
  });

  it("emits BOTH OG title and OG description (a description alone emits neither)", () => {
    expect(metaContent(html, "og:title")).toBe(EXPECTED_TITLE);
    expect(metaContent(html, "og:description")).toBe(EXPECTED_DESCRIPTION);
  });

  /*
   * REPLACED, NOT DELETED (Story 3.3, AC5). This read `toBeNull()` until
   * 2026-08-27, pinning a ban that D20 retired as an over-read of AR-11. The
   * `it` title moved with the assertion — a test called "emits NO og:image"
   * that asserts the opposite is the next reader's trap.
   *
   * The origin gate does NOT hold this line: `<meta content>` is deliberately
   * outside `FETCHING_POSITIONS`, so an off-origin `og:image` is reported and
   * passed. This assertion, its twin in `players/static-output.test.ts`, and
   * the whole-export one in `canonical-output.test.ts` are the whole guard.
   *
   * `SITE_ORIGIN` is IMPORTED, never spelled — `site-origin.test.ts` allows one
   * occurrence of the literal under `app/` and counts this file.
   *
   * This file's `metaContent` takes TWO arguments and matches `property|name`;
   * the players twin takes three. The helpers differ on purpose.
   */
  it("emits a SAME-ORIGIN og:image — the card, not a third-party asset", () => {
    const ogImage = metaContent(html, "og:image");
    expect(ogImage).toEqual(expect.any(String));
    expect(ogImage?.startsWith(SITE_ORIGIN)).toBe(true);
  });
});

describe.skipIf(!anyBuilt)("the pre-rendered Hero (AC 1, AC 4)", () => {
  const html = teamHtmlIfBuilt(FIXTURE_SLUG);
  const profile = anyBuilt ? readTeamProfile(FIXTURE_SLUG) : null;

  it("ships the team identity block in the HTML, not only in the client payload", () => {
    expect(html).toContain("Mexico");
    expect(html).toContain("MEX");
    // "Grupo A" — the word reuses match.hero.group; the letter is uppercased in
    // the view layer, so the LOWERCASE contract value must not appear as a label.
    expect(html).toContain(`${es.match.hero.group} A`);
  });

  /*
   * A LOCALE-FORMATTED VALUE THAT ONLY RENDERING CAN PRODUCE. `possession` is
   * 48.2 in the artifact and es-CO prints it "48,2%" — a comma decimal and a
   * percent sign that appear nowhere in the JSON. Asserting the raw 48.2 would
   * pass on an un-rendered payload dump.
   */
  it("formats Hero values through the es-CO locale layer", () => {
    expect(profile?.tacticalIdentity.possession).toBe(48.2);
    expect(html).toContain("48,2%");
    // pressingIntensity is a COUNT-VALUED MEAN at 1 dp and takes NO percent
    // sign (D12). 213.0 -> "213,0".
    expect(profile?.tacticalIdentity.pressingIntensity).toBe(213);
    expect(html).toContain("213,0");
    expect(html).not.toContain("213,0%");
  });

  it("prints the contracted points, never a naive won*3 + drawn", () => {
    /*
     * D12: `record.points` counts GROUP-STAGE points only — knockout ties award
     * none — and a naive derivation disagrees on 19 of 48 real teams. Mexico is
     * 9 by contract and 12 naive.
     */
    expect(profile?.record.points).toBe(9);
    expect((profile?.record.won ?? 0) * 3 + (profile?.record.drawn ?? 0)).toBe(12);
    expect(html).toContain(es.team.tile.points);
  });

  it("ships the form strip as one chip per match, spoken word included", () => {
    // Four wins then a loss — the artifact's own chronological order.
    expect(profile?.matches.map((row) => row.result)).toEqual([
      "win",
      "win",
      "win",
      "win",
      "loss",
    ]);
    /*
     * The chip renders an aria-hidden LETTER plus an sr-only WORD. Counting the
     * chip's own fill classes is what proves five chips shipped rather than one
     * repeated string match.
     */
    expect(classAttrCount(html, "bg-result-win")).toBe(4);
    expect(classAttrCount(html, "bg-result-loss")).toBe(1);
    expect(classAttrCount(html, "bg-result-draw")).toBe(0);
  });

  it('deep-links "Comparar equipo" to the /compare route (AC 4)', () => {
    /*
     * `/compare/?…` WITH THE SLASH, and `&amp;` because React escapes the
     * ampersand in an href attribute.
     *
     * The slash is not cosmetic: `trailingSlash: true` normalises a slash-less
     * path at request time, so an href written `/compare?…` ships as
     * `/compare/?…` and the emitted markup stops matching the helper that built
     * it. This assertion is what caught the drift.
     *
     * 🔴 THE TITLE SAID "the UNBUILT /compare route" AND WENT STALE THE MOMENT
     * STORY 2.17 SHIPPED IT (2.17 Task 2.4). The helper behind this href changed
     * with it: `team-profile.ts`'s private `compareTeamHref` is DELETED and this
     * link is built by the one `compareHref` in `@/lib/compare-url`, which
     * `PlayerHero` also uses. The EMITTED STRING is unchanged, which is the whole
     * point of asserting on markup rather than on a function's return value —
     * this line is byte-identical across the de-duplication.
     */
    expect(html).toContain('href="/compare/?type=teams&amp;a=mexico"');
    expect(html).toContain(es.team.action.compare);
  });

  it("carries exactly one <h1>, and it is sr-only", () => {
    expect(classAttrCount(html, "sr-only")).toBeGreaterThan(0);
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
  });
});

describe.skipIf(!anyBuilt)("AD-11's split is respected — the Hero is a PROJECTION", () => {
  const html = teamHtmlIfBuilt(FIXTURE_SLUG);

  /*
   * The below-Hero payload must NOT be inlined. `shapeByPhase`'s metre values,
   * the per-match opponents and the formation distribution all arrive over the
   * runtime fetch; if any of them appears in the exported HTML, the projection
   * has leaked and every byte ships twice on all 48 routes.
   *
   * `teamWidth`'s 53,4 and the opponent name "South Africa" are the two cheapest
   * probes: neither is reachable from `TeamHeroData`.
   */
  it("does not inline the below-Hero artifact into the exported HTML", () => {
    expect(html).not.toContain("South Africa");
    expect(html).not.toContain("53,4");
  });
});

/*
 * THE REAL-DATA ESCAPING TRAP — and it is now driven off the REAL manifest
 * (code review 2026-08-07).
 *
 * WHAT WAS HERE COULD NOT FAIL. It declared `const emitted = "Côte d&#x27;Ivoire"`
 * and then asserted that that literal contains `d&#x27;Ivoire` and not
 * `d'Ivoire` — reading no artifact, no locale, no exported HTML and no product
 * code. No change to this application could ever have turned it red. That is the
 * "gate that cannot fail" this story's own Testing Requirements ban ("A test
 * that can only pass is not a gate"), shipped in the same file whose bijection
 * assertion was driven red on purpose to avoid exactly it.
 *
 * The real risk it was written for is a substring probe spelled with a raw
 * apostrophe, which silently never matches the emitted markup. Two things make
 * that a genuine gate: the ESCAPING RULE, applied rather than hand-written, and
 * the CORPUS INVENTORY, read from `data/index/` rather than recited from a
 * comment. The second is the one that bites — it goes red at 2.19 the moment a
 * team name arrives carrying a character HTML escaping changes, which is the
 * event that would invalidate every substring probe in this suite.
 */
const REAL_MANIFEST = fileURLToPath(new URL("../../../../data/index/tournament.json", import.meta.url));
const realManifestPresent = existsSync(REAL_MANIFEST);

/** The five characters HTML escaping rewrites, and what React emits for each. */
const HTML_ESCAPES: ReadonlyArray<readonly [string, string]> = [
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#x27;"],
];

function escapeLikeReact(value: string): string {
  return HTML_ESCAPES.reduce((acc, [raw, escaped]) => acc.split(raw).join(escaped), value);
}

function realTeamNames(): string[] {
  const parsed = JSON.parse(readFileSync(REAL_MANIFEST, "utf8")) as {
    entities: { teams: { name: string }[] };
  };
  return parsed.entities.teams.map((team) => team.name);
}

describe.skipIf(!realManifestPresent)("the real-data escaping trap", () => {
  /*
   * THE INVENTORY GATE. Exactly one of the 48 real team names contains a
   * character HTML escaping rewrites: "Côte d'Ivoire". (ü, ô and ç are the
   * corpus's only other non-ASCII characters and escaping leaves all three
   * alone — they are emitted as themselves in a UTF-8 document.) A 49th name,
   * or a rename introducing an ampersand, turns this red and tells whoever
   * added it that every substring probe in this suite needs rechecking.
   */
  it("names every real-corpus team whose emitted markup differs from its raw name", () => {
    const affected = realTeamNames().filter((name) => escapeLikeReact(name) !== name);
    expect(affected).toEqual(["Côte d'Ivoire"]);
  });

  /*
   * THE PROBE GATE, applied to a name taken FROM THE MANIFEST rather than
   * retyped here — so it exercises the transform against real data instead of
   * grading a literal against itself.
   */
  it("escapes an apostrophe the way React does, so substring probes must match", () => {
    const raw = realTeamNames().find((name) => name.includes("'"));
    expect(raw, "no apostrophe-bearing team name in the real manifest").toBeDefined();
    const emitted = escapeLikeReact(raw ?? "");
    expect(emitted).not.toContain("d'Ivoire");
    expect(emitted).toContain("d&#x27;Ivoire");
  });
});
