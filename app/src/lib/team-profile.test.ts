import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { TeamProfile } from "@/lib/contract/contract-types";
import { composeTeamDescription, composeTeamTitle, toTeamHeroData } from "@/lib/team-profile";
import { es } from "@/locales/es";

/*
 * `src/lib/team-profile.ts`'s co-located suite (added at code review
 * 2026-08-07).
 *
 * WHY IT EXISTS. The module shipped with NO test at all while its siblings —
 * `team-profile-format.ts`, `player-profile.ts`, `hub-model.ts` — each carry
 * one, and it is the module that holds the route's `<title>`/OG composers and
 * its AD-11 Hero projection. It is also where the story's one real shipped bug
 * was: `compareTeamHref` emitted `/compare?type=teams&a=…` without the trailing
 * slash and had to be corrected in a follow-up commit, caught only by a
 * BUILD-GATED static-output assertion — one that silently skips in every
 * `npm test` run not preceded by `npm run build`. (That function has since been
 * hoisted into the shared, separately-tested `compare-url.ts` by Story 2.17.)
 *
 * THE FIXTURE IS READ WITH node:fs, not through `@/lib/build-data`, matching
 * `team-profile-model.test.ts` — one read path for the team suites.
 *
 * EVERY EXPECTATION IS A FIXTURE LITERAL OR A CONTRACT PROPERTY, never a value
 * produced by calling the function under test. Story 1.17's precision gate
 * graded itself and 41 tests stayed green while 553 leaves shipped truncated.
 */

function readTeamProfileFixture(slug: string): TeamProfile {
  const file = path.join(
    process.cwd(),
    "..",
    "data",
    "fixtures",
    "index",
    "team-profiles",
    `${slug}.json`
  );
  return JSON.parse(readFileSync(file, "utf8")) as TeamProfile;
}

const MEXICO = readTeamProfileFixture("mexico");

describe("toTeamHeroData — the AD-11 Hero projection (D6)", () => {
  it("selects the ruled field set and nothing more", () => {
    const hero = toTeamHeroData(MEXICO);
    expect(Object.keys(hero).sort()).toEqual(
      [
        "form",
        "group",
        "name",
        "possession",
        "pressingIntensity",
        "record",
        "teamCode",
        "teamId",
      ].sort()
    );
  });

  /*
   * THE POINT OF THE PROJECTION. AD-11 admits exactly two data paths and "no
   * inlining full bundles into HTML"; the Hero is the build-time half, so it
   * must carry a SUBSET. `TeamProfile` has nine top-level properties and the
   * two heaviest — `tacticalIdentity` (40 leaves) and `matches` (15 fields per
   * row) — must not survive whole.
   */
  it("never carries the whole artifact into the pre-rendered payload", () => {
    const hero = toTeamHeroData(MEXICO) as unknown as Record<string, unknown>;
    expect(hero.tacticalIdentity).toBeUndefined();
    expect(hero.matches).toBeUndefined();
    expect(hero.formationUsage).toBeUndefined();
    expect(hero.schemaVersion).toBeUndefined();
  });

  it("reads the record verbatim, deriving nothing (AR-5, D12)", () => {
    const hero = toTeamHeroData(MEXICO);
    // Fixture literals, read out of mexico.json by hand.
    expect(hero.record.played).toBe(5);
    expect(hero.record.won).toBe(4);
    expect(hero.record.drawn).toBe(0);
    expect(hero.record.lost).toBe(1);
    /*
     * 9 BY CONTRACT, 12 NAIVE. `record.points` counts group-stage points only —
     * knockout ties award none — and a naive `won*3 + drawn` disagrees with the
     * contract on 19 of 48 real teams. Asserted as a NON-equality so a future
     * re-derivation goes red rather than quietly shipping.
     */
    expect(hero.record.points).toBe(9);
    expect(hero.record.points).not.toBe(MEXICO.record.won * 3 + MEXICO.record.drawn);
  });

  it("passes pressingIntensity through as the count-valued mean it is, not a rate", () => {
    const hero = toTeamHeroData(MEXICO);
    expect(hero.pressingIntensity).toBe(213);
    expect(hero.possession).toBe(48.2);
    /* A percentage cannot exceed 100; `pressingIntensity` is 213. The two sit
     * two tiles apart and this is the property that separates them. */
    expect(hero.pressingIntensity).toBeGreaterThan(100);
    expect(hero.possession).toBeLessThanOrEqual(100);
  });

  /*
   * THE FORM STRIP IS A PROJECTION, NEVER AN AGGREGATION (D3, AR-5). One entry
   * per match, in the artifact's own chronological order — nothing summed,
   * counted, filtered or re-ordered. Pinned as a property of `matches[]` rather
   * than as a literal sequence, so a fixture regeneration cannot break it for a
   * reason unrelated to behaviour.
   */
  it("projects the form strip from matches[].result in artifact order", () => {
    const hero = toTeamHeroData(MEXICO);
    expect(hero.form).toHaveLength(MEXICO.matches.length);
    expect(hero.form).toEqual(MEXICO.matches.map((row) => row.result));
  });
});

describe("composeTeamTitle / composeTeamDescription (D7, AC 3)", () => {
  /*
   * BUILT FROM LOCALE AND FIXTURE LITERALS, never by calling the composer. The
   * separators come from the dictionary because that is where the route reads
   * them; the numbers are read out of mexico.json by hand.
   */
  const SEPARATOR = es.team.meta.separator;
  const RECORD_SEPARATOR = es.team.meta.recordSeparator;

  it("composes name, W-D-L and site name in the ruled order", () => {
    const title = composeTeamTitle({
      name: "Mexico",
      won: 4,
      drawn: 0,
      lost: 1,
      siteName: es.app.siteName,
      separator: SEPARATOR,
      recordSeparator: RECORD_SEPARATOR,
    });
    expect(title).toBe(`Mexico${SEPARATOR}4-0-1${SEPARATOR}${es.app.siteName}`);
  });

  it("closes the description with the furthest stage, the only carrier of progression", () => {
    const description = composeTeamDescription({
      name: "Mexico",
      won: 4,
      drawn: 0,
      lost: 1,
      furthestStageLabel: es.enums.stage.r16,
      separator: SEPARATOR,
      recordSeparator: RECORD_SEPARATOR,
    });
    expect(description).toBe(`Mexico${SEPARATOR}4-0-1${SEPARATOR}${es.enums.stage.r16}`);
  });

  /*
   * NEITHER COMPOSER PRINTS `played` OR `points`. D12: `record.played` is ALL
   * matches (Argentina is 8, not 3) and `record.points` is group-stage only, so
   * a title that showed either would invite the arithmetic the contract
   * forbids. The ruled composition is W-D-L and nothing else.
   */
  it("prints neither played nor points", () => {
    const title = composeTeamTitle({
      name: "Mexico",
      won: 4,
      drawn: 0,
      lost: 1,
      siteName: es.app.siteName,
      separator: SEPARATOR,
      recordSeparator: RECORD_SEPARATOR,
    });
    expect(title).not.toContain("9");
    expect(title).not.toContain("12");
  });

  /*
   * A SOURCE PROPER NOUN PASSES THROUGH UNTRANSLATED (AD-7), and the corpus's
   * whole non-ASCII inventory lives in team names. A composer that normalised,
   * stripped or escaped would corrupt three of the 48 real titles.
   */
  it("passes an accented team name through byte-for-byte", () => {
    const title = composeTeamTitle({
      name: "Türkiye",
      won: 1,
      drawn: 1,
      lost: 1,
      siteName: es.app.siteName,
      separator: SEPARATOR,
      recordSeparator: RECORD_SEPARATOR,
    });
    expect(title).toContain("Türkiye");
    expect(title.startsWith("Türkiye")).toBe(true);
  });
});
