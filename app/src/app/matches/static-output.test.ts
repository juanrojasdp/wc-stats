import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readMatchBundle, readTournament } from "@/lib/build-data";
import { findTermSpan, headingMark } from "@/lib/glossary";
import { SECTION_IDS } from "@/lib/tactical-sections";
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

/*
 * ESCAPE THE EXPECTATION, DO NOT STOP SUBSTRING-MATCHING (Story 2.19, ledger A2,
 * ruled decision D3).
 *
 * Every assertion in this file compares a value taken from the artifact against
 * the EXPORTED BYTES, and that is the whole point of the file — it is what makes
 * it a check on the export rather than a re-run of the renderer. But the bytes
 * are HTML, and React escapes text before writing them, so a name carrying any
 * of the five escaped characters never matches its own raw form.
 *
 * Measured over the real corpus at the 2.19 cutover: exactly ONE name in the
 * entire tournament needs this — `Côte d'Ivoire`, which exports as
 * `Côte d&#x27;Ivoire`, on four matches (m009, m033, m055, m078). Zero of the
 * 1,248 player names do. That is precisely the shape of defect that ships: it
 * is invisible on fixtures, invisible on 100 of 104 real matches, and would
 * have turned red for the first time on a corpus nobody re-reads.
 *
 * The five replacements and their order are React's own `escapeHtml`.
 */
function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
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
        escapeForHtml(
          `${metadata.homeTeam.name} ${metadata.score.home}–${metadata.score.away} ${metadata.awayTeam.name}`
        )
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
    /*
     * MINUTES RE-ANCHORED ON THE REAL CORPUS AT THE 2.19 CUTOVER. The hand-built
     * 1.1 fixture put these goals at 8′ and 66′; the extracted bundle puts them
     * at 9′ and 67′ — both exactly one minute later. The scoreline (Mexico 2–0),
     * the scorers and their order are unchanged, which is why the ids and titles
     * survived the flip while these two literals did not.
     *
     * The consistent +1 was checked against the source PDF as part of the SM-3
     * spot-check (Task 4.3) rather than assumed: the extraction is right and the
     * fixture was the approximation. This file asserts the EXPORT, so the export
     * is what it now pins.
     */
    const { home, away } = scorerColumns(html);
    expect(home).toContain("Julian QUINONES 9′");
    expect(home).toContain("Raul JIMENEZ 67′");
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

describe.skipIf(!anyBuilt)("m074 Hero markup — shoot-out, knockout (AC 2)", () => {
  const html = anyBuilt ? matchHtml("m074-germany-paraguay") : "";

  /*
   * THIS MATCH LOST ITS OWN GOAL AT THE 2.19 CUTOVER, and that is a corpus fact
   * rather than a defect. The 1.1 fixture invented a Gustavo GOMEZ own goal at
   * 5′ to exercise AD-6's benefiting-team attribution; the real m074 is
   * Germany 1–1 Paraguay through Enciso 42′ and Havertz 54′, with no own goal
   * anywhere in it. The shoot-out and knockout facts the fixture carried DO
   * survive verbatim, which is why the two cases below are untouched.
   *
   * The AD-6 assertion is not deleted with the fixture that motivated it — it
   * moves to m004, a REAL own goal, in the block below. Deleting it would have
   * retired the only export-level check on the one goal-attribution rule that is
   * counter-intuitive enough to need one.
   */
  it("lists each side's scorer in its own column", () => {
    const { home, away } = scorerColumns(html);
    expect(home).toContain("Kai HAVERTZ 54′");
    expect(away).toContain("Julio ENCISO 42′");
    expect(home).not.toContain("ENCISO");
    expect(away).not.toContain("HAVERTZ");
  });

  it("shows the shoot-out caption in home–away order", () => {
    expect(html).toContain(`${es.match.hero.shootout} 3–4`); // Penales: 3–4
  });

  it("shows the Round-of-32 stage chip with no group", () => {
    expect(html).toContain(esStage("r32")); // Dieciseisavos de final
    expect(html).not.toContain(es.match.hero.group); // no "Grupo" on a knockout
  });
});

describe.skipIf(!anyBuilt)("m004 Hero markup — a REAL own goal (AC 2, AD-6)", () => {
  const html = anyBuilt ? matchHtml("m004-usa-paraguay") : "";

  /*
   * The real corpus carries 14 own goals across 14 matches, so AD-6's rule has
   * a genuine anchor now that m074's invented one is gone. m004 is USA 4–1
   * Paraguay, opened by a Paraguay player putting it into his own net at 7′.
   */
  it("attributes the own goal to the BENEFITING team's column with (a.g.)", () => {
    const { home, away } = scorerColumns(html);
    // BOBADILLA is a Paraguay player; `teamId` on the goal is the benefiting
    // team (AD-6), so the line must sit in USA's (home) column and nowhere else.
    expect(home).toContain(`Damian BOBADILLA 7′ ${es.match.hero.ownGoal}`);
    expect(away).not.toContain("BOBADILLA");
  });

  it("keeps the scorer's own side clean of it — Paraguay's column is its own goal only", () => {
    const { away } = scorerColumns(html);
    expect(away).not.toContain(es.match.hero.ownGoal);
  });
});

/*
 * Story 2.5 Task 9.3. The Tactical Layer mounts only after the client fetch
 * resolves (AR-11), so the exported HTML legitimately contains none of it —
 * that absence is the assertion. A regression here means someone moved the
 * layer to the build-time path and broke the rendering split.
 */
/*
 * STORY 2.18 Task 9.7 — the title half of this guard DEGRADES, and the fix is
 * to re-anchor it rather than delete it.
 *
 * Once a heading is fragmented by term marking, the full title never appears as
 * one contiguous run in ANY markup, so `not.toContain(title)` becomes trivially
 * true and would stay green through exactly the regression it exists to catch.
 * Today that is "Línea de momentum", which renders as "Línea de " + a marked
 * "momentum". The `id` half is unaffected and is NOT the thing being fixed.
 *
 * The replacement asserts on the longest contiguous run of each title that
 * carries no glossary term — computed from the SAME pure marking table the
 * renderer uses, so the guard and the component cannot drift.
 */
function longestUnmarkedRun(id: (typeof SECTION_IDS)[number]): string {
  const title = es.tactical.sections[id].title;
  const mark = headingMark(id);
  if (mark === null) {
    return title;
  }
  const term = es.glossary[mark.id].es;
  const span = findTermSpan(title, term);
  if (span === null) {
    return title;
  }
  const runs = [title.slice(0, span.start), title.slice(span.end)].map((run) => run.trim());
  return runs.reduce((longest, run) => (run.length > longest.length ? run : longest), "");
}

describe.skipIf(!anyBuilt)("the Tactical Layer stays off the build-time path (AR-11)", () => {
  it("exports no Tactical section markup — all eleven ids and titles", () => {
    for (const entity of readTournament().entities.matches) {
      const html = matchHtml(entity.matchId);
      // Every id, not a sample: the point is that NO section escaped to the
      // build-time path, and checking two of eleven would let the other nine
      // regress green.
      for (const id of SECTION_IDS) {
        expect(html, `${entity.matchId} exports id="${id}"`).not.toContain(`id="${id}"`);
        // The pre-rendered document is Spanish canonical; the section titles
        // are the copy that would appear if the layer were server-rendered.
        const run = longestUnmarkedRun(id);
        expect(html, `${entity.matchId} exports the "${id}" title`).not.toContain(run);
      }
    }
  });

  it("the re-anchored runs are non-vacuous and actually shorter where a heading is marked", () => {
    /*
     * A guard that asserts the absence of "" passes on every document ever
     * written. This pins that every run is substantial, and that the ONE marked
     * heading really did shorten — if term marking is later removed, this test
     * goes red and tells the next author to simplify the guard back.
     */
    const marked = SECTION_IDS.filter((id) => headingMark(id) !== null);
    expect(marked).toEqual(["momentum"]);
    for (const id of SECTION_IDS) {
      expect(longestUnmarkedRun(id).length, `${id} run`).toBeGreaterThan(5);
    }
    expect(longestUnmarkedRun("momentum")).toBe("Línea de");
    expect(longestUnmarkedRun("momentum").length).toBeLessThan(
      es.tactical.sections.momentum.title.length
    );
    // An unmarked section keeps its whole title as the run.
    expect(longestUnmarkedRun("set-plays")).toBe(es.tactical.sections["set-plays"].title);
  });

  /*
   * Story 2.11b Task 8.3. The guard above walks the ELEVEN SectionIds, and the
   * Expert Layer is deliberately not one of them (ruled decision 2) — so
   * `#expert` was entirely unprotected. It is a client-only layer for exactly
   * the same reason the Tactical one is: it mounts inside MatchBundleRegion's
   * loaded branch, from a runtime fetch, under AR-11.
   */
  it("exports no Expert Layer markup either — the id, the pill and the heading", () => {
    for (const entity of readTournament().entities.matches) {
      const html = matchHtml(entity.matchId);
      expect(html, `${entity.matchId} exports id="expert"`).not.toContain('id="expert"');
      expect(html, `${entity.matchId} exports the EXPERTO pill`).not.toContain(es.expert.pill);
      expect(html, `${entity.matchId} exports the Expert heading`).not.toContain(
        es.expert.heading
      );
    }
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
    /*
     * Scoped to the Hero: a document-wide count breaks the day SiteHeader
     * gains a menu toggle, for a reason that has nothing to do with the Hero.
     *
     * STORY 2.18 RE-ANCHOR, not a relaxation. A bare aria-expanded count went
     * from 1 to 2 when the xG tile label became a real glossary popover
     * trigger — and a popover trigger is NOT a disclosure: Radix marks it
     * aria-haspopup="dialog" and it controls an overlay, while the lineups
     * disclosure carries aria-controls and expands in flow. Counting them
     * together would have made this assertion mean "how many things in the
     * Hero happen to use aria-expanded", which tests nothing. Both halves are
     * asserted below, so neither can regress silently.
     */
    const hero = heroSection(html);
    const expandables = [...hero.matchAll(/<[a-z]+[^>]*aria-expanded="(?:true|false)"[^>]*>/g)].map(
      ([tag]) => tag
    );
    const disclosures = expandables.filter((tag) => !tag.includes('aria-haspopup="dialog"'));
    expect(disclosures).toHaveLength(1);
    expect(disclosures[0]).toContain("aria-controls");
  });

  /*
   * Story 2.18 Task 5.3: the Hero's xG tile label is the FIRST GlossaryTerm
   * call site, and the ONE glossary mark on this route's build-time path. The
   * popover PANEL is deliberately absent from the export — Radix mounts content
   * only while open — so the trigger is what the exported HTML can prove.
   */
  it("marks xG as a glossary term in the Hero, exactly once", () => {
    const hero = heroSection(html);
    const triggers = hero.match(/data-slot="popover-trigger"/g) ?? [];
    expect(triggers).toHaveLength(1);
    // The sr-only expansion STAYS: the popover's accessible name is the term
    // itself, so dropping it would remove the only screen-reader expansion of
    // the abbreviation.
    expect(hero).toContain(es.match.hero.xgExpansion);
    // Closed on export — no panel copy, no role="dialog" in the static HTML.
    expect(hero).not.toContain(es.glossary.xg.definition);
  });
});
