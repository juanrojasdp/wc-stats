import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readMatchBundle, readTournament } from "@/lib/build-data";
import { es } from "@/locales/es";

/*
 * Verifies the EXPORTED match-route HTML, not live components (node env, no
 * jsdom — the Story 2.2 decision). Kept out of the [slug]/ directory by
 * convention (bracketed CLI path-filters trip shell quoting; the root
 * static-output.test.ts sits beside its route the same way). `npm run build`
 * precedes `npm test` so out/ exists.
 *
 * The skip guard keys on out/ — NOT on out/matches/. Keying on the match
 * directory made "the route produced nothing at all" indistinguishable from
 * "no build ran", so a build that emitted the shell but zero match routes
 * reported 14 green skips. Task 8.1's rule is that a partial export fails
 * loudly; that is what the first assertion below is for.
 */

const OUT_DIR = fileURLToPath(new URL("../../../out/", import.meta.url));
const MATCHES_DIR = OUT_DIR + "matches/";
const anyBuilt = existsSync(OUT_DIR);

// trailingSlash: true → out/matches/{matchId}/index.html.
function matchHtml(matchId: string): string {
  return readFileSync(`${MATCHES_DIR}${matchId}/index.html`, "utf8");
}

// Count a class only where it appears as a real DOM `class="..."` attribute —
// the RSC flight payload carries "className" strings that must not be counted.
function classAttrCount(html: string, token: string): number {
  const pattern = new RegExp(`class="[^"]*\\b${token}\\b[^"]*"`, "g");
  return (html.match(pattern) ?? []).length;
}

// Slice a document down to the Hero <section>, so Hero-scoped assertions cannot
// be satisfied (or broken) by markup the shell owns.
function heroSection(html: string): string {
  const start = html.indexOf("<section");
  const end = html.indexOf("</section>", start);
  expect(start, "Hero <section> not found in the exported HTML").toBeGreaterThan(-1);
  expect(end, "Hero </section> not found in the exported HTML").toBeGreaterThan(start);
  return html.slice(start, end);
}

/*
 * The scorer row is the only `grid-cols-2 gap-4` block in the Hero; its two
 * children are the home (text-left) and away (text-right) columns. Splitting on
 * them is what makes the own-goal AC testable: a whole-document `toContain`
 * passes just as happily when the two columns are swapped.
 */
function scorerColumns(html: string): { home: string; away: string } {
  const hero = heroSection(html);
  const rowStart = hero.indexOf("grid-cols-2 gap-4");
  const homeStart = hero.indexOf('class="text-left"', rowStart);
  const awayStart = hero.indexOf('class="text-right"', homeStart);
  const rowEnd = hero.indexOf("gap-tile-gap", awayStart); // StoryStatTiles begins
  expect(rowStart, "scorer row not found in the Hero").toBeGreaterThan(-1);
  expect(homeStart, "home scorer column not found").toBeGreaterThan(rowStart);
  expect(awayStart, "away scorer column not found").toBeGreaterThan(homeStart);
  expect(rowEnd, "Story Stat tiles not found after the scorer row").toBeGreaterThan(awayStart);
  return { home: hero.slice(homeStart, awayStart), away: hero.slice(awayStart, rowEnd) };
}

function documentTitle(html: string): string {
  return html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
}

const esStage = (stage: keyof typeof es.enums.stage) => es.enums.stage[stage];

describe.skipIf(!anyBuilt)("exported /matches/[slug] routes (AC 1)", () => {
  it("emitted the match routes at all (a build that skipped them fails here)", () => {
    expect(existsSync(MATCHES_DIR)).toBe(true);
  });

  it("pre-renders exactly the manifest matches — no extra, no missing (bijection)", () => {
    const manifest = readTournament().entities.matches.map((m) => m.matchId).sort();
    const built = readdirSync(MATCHES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(built).toEqual(manifest);
    expect(manifest.length).toBeGreaterThan(0);
  });

  it("each <title> carries teams + score + stage label (Spanish canonical)", () => {
    for (const entity of readTournament().entities.matches) {
      const { metadata } = readMatchBundle(entity.matchId);
      const title = documentTitle(matchHtml(entity.matchId));
      // Assembled from literals + fixture values, NOT by calling
      // composeMatchTitle: an expectation built by the function under test
      // reproduces that function's bugs and can only prove it was called.
      expect(title).toContain(
        `${metadata.homeTeam.name} ${metadata.score.home}–${metadata.score.away} ${metadata.awayTeam.name}`
      );
      expect(title).toContain(` · ${esStage(metadata.stage)} · `);
      expect(title).toContain(es.app.siteName);
    }
  });

  it("m074's title carries the shoot-out suffix", () => {
    expect(documentTitle(matchHtml("m074-germany-paraguay"))).toContain(
      "Germany 1–1 Paraguay (3–4 pen.)"
    );
  });

  it("renders the display-score token exactly once per page", () => {
    for (const entity of readTournament().entities.matches) {
      expect(classAttrCount(matchHtml(entity.matchId), "type-display-score")).toBe(1);
    }
  });
});

describe.skipIf(!anyBuilt)("m001 Hero markup (AC 2)", () => {
  const html = anyBuilt ? matchHtml("m001-mexico-south-africa") : "";

  it("lists Mexico's scorers with minutes, in the home column", () => {
    const { home, away } = scorerColumns(html);
    expect(home).toContain("Julian QUINONES 8′");
    expect(home).toContain("Raul JIMENEZ 66′");
    // South Africa was not on the scoresheet — the away column stays empty.
    expect(away).not.toContain("QUINONES");
    expect(away).not.toContain("JIMENEZ");
  });

  it("shows all five Story-Stat tile labels (Spanish)", () => {
    expect(html).toContain(es.match.hero.tiles.possession); // Posesión
    expect(html).toContain(es.match.hero.tiles.shots); // Tiros
    expect(html).toContain(es.match.hero.xg); // xG
    expect(html).toContain(es.match.hero.tiles.distance); // Distancia (km)
    expect(html).toContain(es.match.hero.tiles.topSpeed); // Vel. máx. (km/h)
  });

  it("renders the group-stage chip with the group letter", () => {
    // "Fase de grupos · Grupo A"
    expect(html).toContain(`${esStage("group")} · ${es.match.hero.group} A`);
  });

  it("is Spanish canonical (disclosure title present)", () => {
    expect(html).toContain(es.match.hero.lineups.title); // Alineaciones y formaciones
  });
});

describe.skipIf(!anyBuilt)("m074 Hero markup — own goal, shoot-out, knockout (AC 2)", () => {
  const html = anyBuilt ? matchHtml("m074-germany-paraguay") : "";

  it("attributes the own goal to Germany's (home) column with (a.g.)", () => {
    const { home, away } = scorerColumns(html);
    // GOMEZ is a Paraguay player; teamId is the BENEFITING team (AD-6), so the
    // line must sit in Germany's column and nowhere else.
    expect(home).toContain(`Gustavo GOMEZ 5′ ${es.match.hero.ownGoal}`);
    expect(away).not.toContain("GOMEZ");
    expect(away).toContain("Julio ENCISO");
  });

  it("shows the shoot-out caption in home–away order", () => {
    expect(html).toContain(`${es.match.hero.shootout} 3–4`); // Penales: 3–4
  });

  it("shows the Round-of-32 stage chip with no group", () => {
    expect(html).toContain(esStage("r32")); // Dieciseisavos de final
    expect(html).not.toContain(es.match.hero.group); // no "Grupo" on a knockout
  });
});

describe.skipIf(!anyBuilt)("Hero links and the single disclosure (AC 2)", () => {
  const html = anyBuilt ? matchHtml("m001-mexico-south-africa") : "";

  it("links header team names to Team Profiles", () => {
    expect(html).toContain('href="/teams/mexico/"');
    expect(html).toContain('href="/teams/south-africa/"');
  });

  it("links lineup player names to Player Profiles (content ships in the HTML)", () => {
    expect(html).toContain('href="/players/quinones-julian-mex/"');
  });

  it("contains exactly one aria-expanded disclosure in the Hero", () => {
    // Scoped to the Hero: a document-wide count breaks the day SiteHeader
    // gains a menu toggle, for a reason that has nothing to do with the Hero.
    const disclosures = (heroSection(html).match(/aria-expanded="(?:true|false)"/g) ?? []).length;
    expect(disclosures).toBe(1);
  });
});
