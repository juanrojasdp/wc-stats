import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { KnockoutScore, MatchBundle, TeamScore } from "@/lib/contract/contract-types";
import {
  composeMatchTitle,
  decidedByCaption,
  formatGoalMinute,
  groupScorers,
  resolveLeader,
  stageLabelKey,
  toHeroData,
} from "@/lib/match-hero";

/*
 * Pure Hero display logic (Task 8.2), node env. Fixture assertions read the
 * fixtures off the filesystem (cwd is app/); the unfixtured "extra-time" branch
 * (FR-1 gap) is proved on a constructed object.
 *
 * PINNED EXPLICITLY AT THE 2.19 CUTOVER (ruled decision D2). This file used to
 * read through `build-data`'s `readMatchBundle`, which made it a fixture-pinned
 * unit test only by coincidence: flipping DATA_ROOT to the real corpus
 * repointed it silently, and it stayed green purely because m001 and m074 carry
 * the same ids and scores in both corpora. The viz model tests already read by
 * relative path for the same reason; this file now does too, so the corpus it
 * asserts against cannot move underneath it again.
 */

function readMatchFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m074 = readMatchFixture("m074-germany-paraguay");
const m001 = readMatchFixture("m001-mexico-south-africa");

describe("groupScorers — benefiting-team attribution (AD-6)", () => {
  it("puts m074's own-goal scorer GOMEZ in Germany's (home) column", () => {
    const hero = toHeroData(m074);
    const grouped = groupScorers(
      hero.goals,
      hero.homeTeam.teamId,
      hero.awayTeam.teamId
    );
    expect(grouped.home.map((g) => g.scorerName)).toContain("Gustavo GOMEZ");
    expect(grouped.home[0].ownGoal).toBe(true);
    // The Paraguay goal (Enciso) is the away column.
    expect(grouped.away.map((g) => g.scorerName)).toContain("Julio ENCISO");
    expect(grouped.away.map((g) => g.scorerName)).not.toContain("Gustavo GOMEZ");
  });

  it("splits m001 goals both under Mexico (home)", () => {
    const hero = toHeroData(m001);
    const grouped = groupScorers(hero.goals, hero.homeTeam.teamId, hero.awayTeam.teamId);
    expect(grouped.home.map((g) => g.scorerName)).toEqual([
      "Julian QUINONES",
      "Raul JIMENEZ",
    ]);
    expect(grouped.away).toHaveLength(0);
  });

  it("throws rather than silently dropping a goal that belongs to neither team", () => {
    // Both m001 goals are Mexico's, so neither id matching leaves them
    // orphaned — previously they vanished from both columns while the
    // scoreline still read 2–0.
    const hero = toHeroData(m001);
    expect(() => groupScorers(hero.goals, "brazil", "argentina")).toThrow(/did not partition/);
  });

  it("throws rather than double-counting when both team ids are the same", () => {
    const hero = toHeroData(m001);
    expect(() => groupScorers(hero.goals, "mexico", "mexico")).toThrow(/did not partition/);
  });
});

describe("formatGoalMinute", () => {
  it("renders a plain minute with the prime glyph", () => {
    expect(formatGoalMinute({ minute: 8, stoppageMinute: null })).toBe("8′");
  });

  it("renders stoppage time as 90+2′", () => {
    expect(formatGoalMinute({ minute: 90, stoppageMinute: 2 })).toBe("90+2′");
  });
});

describe("decidedByCaption", () => {
  it("returns none for a regulation result (m001)", () => {
    expect(decidedByCaption(m001.metadata.knockoutScore)).toEqual({ kind: "none" });
  });

  it("returns the shoot-out score in home–away order (m074)", () => {
    expect(decidedByCaption(m074.metadata.knockoutScore)).toEqual({
      kind: "shootout",
      home: 3,
      away: 4,
    });
  });

  it("handles the unfixtured extra-time branch on a constructed object", () => {
    const extraTime: KnockoutScore = {
      scoreAfter90: { home: 1, away: 1 },
      scoreAfterET: { home: 2, away: 1 },
      shootoutScore: null,
      winnerTeamId: "germany",
      decidedBy: "extra-time",
    };
    expect(decidedByCaption(extraTime)).toEqual({ kind: "extra-time" });
  });

  it("throws if a shootout result is missing its shootoutScore", () => {
    const broken: KnockoutScore = {
      scoreAfter90: { home: 1, away: 1 },
      scoreAfterET: { home: 1, away: 1 },
      shootoutScore: null,
      winnerTeamId: "germany",
      decidedBy: "shootout",
    };
    expect(() => decidedByCaption(broken)).toThrow();
  });

  it("names the offending value when decidedBy is outside the union", () => {
    // Bundles are `as`-cast unvalidated JSON, so this is reachable from a bad
    // artifact; without the default branch it returned undefined and the
    // caller crashed on `.kind` with no clue what caused it.
    const rogue = {
      scoreAfter90: { home: 1, away: 1 },
      scoreAfterET: null,
      shootoutScore: null,
      winnerTeamId: null,
      decidedBy: "abandoned",
    } as unknown as KnockoutScore;
    expect(() => decidedByCaption(rogue)).toThrow(/unknown decidedBy "abandoned"/);
  });
});

describe("resolveLeader", () => {
  it("leads with the higher value", () => {
    expect(resolveLeader(16, 3)).toBe("home");
    expect(resolveLeader(36.1, 63.9)).toBe("away");
  });

  it("ties on equal values (no leader marks)", () => {
    expect(resolveLeader(1, 1)).toBe("tie");
  });
});

describe("stageLabelKey", () => {
  it("maps a stage code to its enums.stage path", () => {
    expect(stageLabelKey("r32")).toBe("enums.stage.r32");
    expect(stageLabelKey("third-place")).toBe("enums.stage.third-place");
  });
});

describe("composeMatchTitle", () => {
  const fragments = {
    separator: " · ",
    scoreSeparator: "–",
    penShort: "pen.",
    siteName: "WC Stats",
  };

  it("composes teams + score + stage + site for a regulation match", () => {
    const regulation: KnockoutScore = m001.metadata.knockoutScore;
    const score: TeamScore = { home: 2, away: 0 };
    expect(
      composeMatchTitle({
        homeName: "Mexico",
        awayName: "South Africa",
        score,
        knockoutScore: regulation,
        stageLabel: "Fase de grupos",
        ...fragments,
      })
    ).toBe("Mexico 2–0 South Africa · Fase de grupos · WC Stats");
  });

  it("appends the shoot-out suffix in home–away order (m074)", () => {
    expect(
      composeMatchTitle({
        homeName: "Germany",
        awayName: "Paraguay",
        score: m074.metadata.score,
        knockoutScore: m074.metadata.knockoutScore,
        stageLabel: "Dieciseisavos de final",
        ...fragments,
      })
    ).toBe("Germany 1–1 Paraguay (3–4 pen.) · Dieciseisavos de final · WC Stats");
  });

  it("throws on a shootout with no shootoutScore instead of emitting a draw-looking title", () => {
    const broken: KnockoutScore = {
      scoreAfter90: { home: 1, away: 1 },
      scoreAfterET: { home: 1, away: 1 },
      shootoutScore: null,
      winnerTeamId: "germany",
      decidedBy: "shootout",
    };
    expect(() =>
      composeMatchTitle({
        homeName: "Germany",
        awayName: "Paraguay",
        score: { home: 1, away: 1 },
        knockoutScore: broken,
        stageLabel: "Dieciseisavos de final",
        ...fragments,
      })
    ).toThrow(/null shootoutScore/);
  });
});
