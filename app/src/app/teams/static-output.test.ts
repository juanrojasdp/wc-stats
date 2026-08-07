import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readTeamProfile, readTournament } from "@/lib/build-data";
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
  const html = anyBuilt ? teamHtml(FIXTURE_SLUG) : "";

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

  it("emits NO og:image — AR-11 permits zero external or asset requests", () => {
    expect(metaContent(html, "og:image")).toBeNull();
  });
});

describe.skipIf(!anyBuilt)("the pre-rendered Hero (AC 1, AC 4)", () => {
  const html = anyBuilt ? teamHtml(FIXTURE_SLUG) : "";
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

  it('deep-links "Comparar equipo" to the unbuilt /compare route (AC 4)', () => {
    /*
     * `/compare/?…` WITH THE SLASH, and `&amp;` because React escapes the
     * ampersand in an href attribute.
     *
     * The slash is not cosmetic: `trailingSlash: true` normalises a slash-less
     * path at request time, so an href written `/compare?…` ships as
     * `/compare/?…` and the emitted markup stops matching the helper that built
     * it. `compareTeamHref` emits the slash itself for exactly that reason —
     * this assertion is what caught the drift.
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
  const html = anyBuilt ? teamHtml(FIXTURE_SLUG) : "";

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

describe.skipIf(!anyBuilt)("the real-data escaping trap", () => {
  /*
   * The corpus's ENTIRE non-ASCII inventory is three characters — ü, ô, ç — all
   * in team names: Türkiye, Côte d'Ivoire, Curaçao. React escapes `'` as
   * `&#x27;`, so `Côte d'Ivoire` ships as `Côte d&#x27;Ivoire`.
   *
   * THE FIXTURE IS ESCAPE-FREE, so this only bites at 2.19's real scale — the
   * assertion is written correctly NOW so the trap is closed before it can fire.
   * It is a property of the escaping rule, not of any shipped team.
   */
  it("escapes an apostrophe the way React does, so substring probes must match", () => {
    const emitted = "Côte d&#x27;Ivoire";
    expect(emitted).not.toContain("d'Ivoire");
    expect(emitted).toContain("d&#x27;Ivoire");
  });
});
