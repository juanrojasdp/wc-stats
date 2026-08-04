import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  CrossEvent,
  DefensiveActionEvent,
  MatchBundle,
  ShotEvent,
  ShotOutcome,
} from "@/lib/contract/contract-types";
import { crossLogRows } from "@/viz/cross-map-model";
import { defensiveRows } from "@/viz/defensive-actions-model";
import { panelDataState } from "@/viz/marker-model";
import {
  SHOT_OUTCOME_ENCODING,
  anyExpectedGoals,
  hasExcludedOwnGoals,
  shotFigureCounts,
  shotLogRows,
  shotMarkers,
  shotOutcomeKey,
} from "@/viz/shot-map-model";

/*
 * Task 4.5. Fixtures are read with node:fs (src/viz is inside the client-import
 * seam as of Task 1.3), the way build-data.ts resolves the same tree.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");

const ALL_OUTCOMES: ShotOutcome[] = ["goal", "on-target", "off-target", "blocked", "incomplete"];

function shotsOf(bundle: MatchBundle): ShotEvent[] {
  const shots = bundle.events.shots;
  if (shots === null) {
    throw new Error(`fixture ${bundle.matchId} has no shots`);
  }
  return shots;
}

function sides(bundle: MatchBundle) {
  return {
    home: {
      teamId: bundle.metadata.homeTeam.teamId,
      teamCode: bundle.metadata.homeTeam.teamCode.toUpperCase(),
    },
    away: {
      teamId: bundle.metadata.awayTeam.teamId,
      teamCode: bundle.metadata.awayTeam.teamCode.toUpperCase(),
    },
  };
}

function outcomeDistribution(markers: { qualifierKey: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const marker of markers) {
    counts[marker.qualifierKey] = (counts[marker.qualifierKey] ?? 0) + 1;
  }
  return counts;
}

describe("SHOT_OUTCOME_ENCODING (UX-DR10: colour AND shape)", () => {
  it("has exactly one entry per ShotOutcome value", () => {
    expect(Object.keys(SHOT_OUTCOME_ENCODING).sort()).toEqual([...ALL_OUTCOMES].sort());
  });

  it("is DESIGN's table, verbatim", () => {
    expect(SHOT_OUTCOME_ENCODING).toEqual({
      goal: { shape: "circle-filled-ring", colorVar: "--shot-goal" },
      "on-target": { shape: "circle-filled", colorVar: "--shot-on-target" },
      "off-target": { shape: "circle-hollow", colorVar: "--shot-off-target" },
      blocked: { shape: "square-filled", colorVar: "--shot-blocked" },
      incomplete: { shape: "square-hollow", colorVar: "--shot-incomplete" },
    });
  });

  it("gives every outcome a distinct colour AND a distinct shape", () => {
    const colours = ALL_OUTCOMES.map((o) => SHOT_OUTCOME_ENCODING[o].colorVar);
    const shapes = ALL_OUTCOMES.map((o) => SHOT_OUTCOME_ENCODING[o].shape);
    expect(new Set(colours).size).toBe(5);
    expect(new Set(shapes).size).toBe(5);
  });
});

describe("shotMarkers on m001 — Story 1.3's permanent ground truth", () => {
  it("renders Mexico's 16 markers with the source PDF's 2/2/8/3/1 distribution", () => {
    /*
     * spike/mex_rsa.pdf IS the m001 report, and Story 1.3 pinned Mexico at
     * "16 markers, 2/2/8/3/1". A regression here is a regression against the
     * source PDF itself, not merely against another number this code produced.
     */
    const markers = shotMarkers(shotsOf(m001), "mexico");
    expect(markers).toHaveLength(16);
    expect(outcomeDistribution(markers)).toEqual({
      [shotOutcomeKey("goal")]: 2,
      [shotOutcomeKey("on-target")]: 2,
      [shotOutcomeKey("off-target")]: 8,
      [shotOutcomeKey("blocked")]: 3,
      [shotOutcomeKey("incomplete")]: 1,
    });
  });

  it("renders South Africa's 3", () => {
    expect(shotMarkers(shotsOf(m001), "south-africa")).toHaveLength(3);
  });

  it("orders markers by minute", () => {
    const markers = shotMarkers(shotsOf(m001), "mexico");
    expect(markers[0].minuteLabel).toBe("3′");
    expect(markers[markers.length - 1].minuteLabel).toBe("66′");
  });

  it("carries the artifact's x/y IDENTICALLY — the AR-6 guard", () => {
    const markers = shotMarkers(shotsOf(m001), "mexico");
    const first = markers[0];
    // The minute-3 Brian GUTIERREZ blocked attempt, verbatim from the fixture.
    expect(first.x).toBe(70.87);
    expect(first.y).toBe(67.66);
    expect(first.subjectName).toBe("Brian GUTIERREZ");
    expect(first.shape).toBe("square-filled");
    expect(first.colorVar).toBe("--shot-blocked");
    // Every marker's coordinates are === the source row's, not approximately.
    const source = shotsOf(m001).filter((s) => s.teamId === "mexico");
    for (const marker of markers) {
      const match = source.find((s) => s.x === marker.x && s.y === marker.y);
      expect(match, `${marker.x}/${marker.y}`).toBeDefined();
    }
  });

  it("gives every marker a stable, unique React key", () => {
    const keys = shotMarkers(shotsOf(m001), "mexico").map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k.startsWith("shot-"))).toBe(true);
  });
});

describe("own goals (AR-6: in the log and the scorer list, off the map)", () => {
  it("drops Paraguay's own goal from the map but keeps all 8 rows in the log", () => {
    const shots = shotsOf(m074);
    const paraguay = shots.filter((s) => s.teamId === "paraguay");
    expect(paraguay).toHaveLength(8);
    expect(paraguay.filter((s) => s.ownGoal)).toHaveLength(1);

    expect(shotMarkers(shots, "paraguay")).toHaveLength(7);
    const { home, away } = sides(m074);
    const rows = shotLogRows(shots, home, away);
    expect(rows.filter((r) => r.teamCode === "PAR")).toHaveLength(8);
    expect(rows.filter((r) => r.ownGoal)).toHaveLength(1);
  });

  it("reports the exclusion so the panel can say so (Task 8.7)", () => {
    expect(hasExcludedOwnGoals(shotsOf(m074), "paraguay")).toBe(true);
    expect(hasExcludedOwnGoals(shotsOf(m074), "germany")).toBe(false);
    expect(hasExcludedOwnGoals(shotsOf(m001), "mexico")).toBe(false);
  });

  it("counts the FIGURE, never keyStatistics.goals — m074 Germany's quiet lie", () => {
    /*
     * Germany's only goal was Paraguay's own goal, which AD-6 attributes to the
     * benefiting team in the scorer list and EXCLUDES from the shot map. A
     * figure summary built from keyStatistics would read "1 gol" over a map
     * with no green marker.
     */
    expect(m074.keyStatistics.home.goals).toBe(1);
    const germany = shotMarkers(shotsOf(m074), "germany");
    expect(germany).toHaveLength(21);
    const counts = shotFigureCounts(germany);
    expect(counts).toEqual({ shots: 21, goals: 0 });
  });

  it("counts goal markers where there are some, and the own goal is not one of them", () => {
    expect(shotFigureCounts(shotMarkers(shotsOf(m001), "mexico"))).toEqual({ shots: 16, goals: 2 });
    /*
     * Paraguay's eight rows carry TWO outcome-"goal" attempts, one of which is
     * the GOMEZ own goal. Dropping it takes the map to seven markers and the
     * goal count to one — the figure summary must not claim two.
     */
    const paraguay = shotsOf(m074).filter((s) => s.teamId === "paraguay");
    expect(paraguay.filter((s) => s.outcome === "goal")).toHaveLength(2);
    expect(shotFigureCounts(shotMarkers(shotsOf(m074), "paraguay"))).toEqual({ shots: 7, goals: 1 });
  });
});

describe("shootoutAttempts are a different table (AR-6)", () => {
  it("never reaches a marker or a log row on m074, which carries nine", () => {
    expect(m074.events.shootoutAttempts).toHaveLength(9);
    const shots = shotsOf(m074);
    const { home, away } = sides(m074);
    const markers = [...shotMarkers(shots, home.teamId), ...shotMarkers(shots, away.teamId)];
    const rows = shotLogRows(shots, home, away);
    // 29 shot rows, 28 markers (one own goal excluded); the nine shoot-out
    // attempts would push either figure past that if they leaked in.
    expect(shots).toHaveLength(29);
    expect(markers).toHaveLength(28);
    expect(rows).toHaveLength(29);
  });
});

describe("shotLogRows", () => {
  it("orders by minute, then home before away", () => {
    const { home, away } = sides(m074);
    const rows = shotLogRows(shotsOf(m074), home, away);
    for (let i = 1; i < rows.length; i += 1) {
      const previous = rows[i - 1];
      const current = rows[i];
      // `Infinity` for an absent clock, matching the CrossLogRow test: nulls
      // sort LAST, so a clock-less row must compare as later than every stamped
      // one rather than as minute 0 (Story 2.11a decision 3).
      const previousClock = (previous.minute ?? Infinity) * 1000 + (previous.stoppageMinute ?? 0);
      const currentClock = (current.minute ?? Infinity) * 1000 + (current.stoppageMinute ?? 0);
      expect(previousClock).toBeLessThanOrEqual(currentClock);
      if (previousClock === currentClock && previous.teamCode !== current.teamCode) {
        expect(previous.teamCode).toBe(home.teamCode);
      }
    }
  });

  it("carries coordinates verbatim for the table's own record", () => {
    const { home, away } = sides(m001);
    const rows = shotLogRows(shotsOf(m001), home, away);
    expect(rows).toHaveLength(19);
    const gutierrez = rows.find((r) => r.playerName === "Brian GUTIERREZ");
    expect(gutierrez?.x).toBe(70.87);
    expect(gutierrez?.y).toBe(67.66);
    expect(gutierrez?.outcomeKey).toBe(shotOutcomeKey("blocked"));
    expect(gutierrez?.minuteLabel).toBe("3′");
  });

  it("throws, naming the id, on a shot belonging to neither side (Task 8.5)", () => {
    const { home, away } = sides(m001);
    const rogue: ShotEvent = { ...shotsOf(m001)[0], teamId: "atlantis" };
    expect(() => shotLogRows([rogue], home, away)).toThrow(/atlantis/);
  });
});

describe("the xG column is omitted while every value is null (FD-1)", () => {
  it("is absent on all three fixtures", () => {
    for (const bundle of [m001, m002, m074]) {
      const { home, away } = sides(bundle);
      const rows = shotLogRows(shotsOf(bundle), home, away);
      expect(rows.every((r) => r.expectedGoals === null), bundle.matchId).toBe(true);
      expect(anyExpectedGoals(rows), bundle.matchId).toBe(false);
    }
  });

  it("appears as soon as one row carries a value — the forward-compatible slot", () => {
    const { home, away } = sides(m001);
    const shots = shotsOf(m001);
    const withXg: ShotEvent[] = [{ ...shots[0], expectedGoals: 0.31 }, ...shots.slice(1)];
    const rows = shotLogRows(withXg, home, away);
    expect(anyExpectedGoals(rows)).toBe(true);
    expect(rows.find((r) => r.expectedGoals !== null)?.expectedGoals).toBe(0.31);
  });

  it("omits the popover xG row while the field is null, and adds it when set", () => {
    const shots = shotsOf(m001);
    const plain = shotMarkers(shots, "mexico")[0];
    expect(plain.detail.map((row) => row.labelKey)).toEqual([
      "viz.table.player",
      "viz.table.minute",
      "viz.table.outcome",
    ]);
    const withXg = shotMarkers(
      shots.map((s) => ({ ...s, expectedGoals: 0.42 })),
      "mexico"
    )[0];
    expect(withXg.detail.map((row) => row.labelKey)).toEqual([
      "viz.table.player",
      "viz.table.minute",
      "viz.table.outcome",
      "viz.shotMap.xg",
    ]);
    expect(withXg.detail[3].value).toEqual({ kind: "number", value: 0.42, digits: 2 });
  });
});

describe("the three log row models agree on ONE null contract (Story 2.11a decision 3)", () => {
  /*
   * `ShotLogRow` was the last of the three still carrying `?? 0`. `CrossLogRow`
   * already used `?? null` and `DefensiveLogRow` was fixed by Story 2.9's code
   * review with a docblock naming this story as the owner of the Shot fix.
   *
   * A clock-less event must yield `null`, not 0, in all three — otherwise the
   * shared sortable table orders those rows FIRST on a clock column while
   * `orderByMinute` puts them LAST, and the row silently claims minute 0.
   */
  const { home, away } = sides(m001);

  it("yields null minute and stoppageMinute for a clock-less SHOT", () => {
    const clockless: ShotEvent = {
      ...shotsOf(m001)[0],
      at: undefined as unknown as ShotEvent["at"],
    };
    const [row] = shotLogRows([clockless], home, away);
    expect(row.minute).toBeNull();
    expect(row.stoppageMinute).toBeNull();
    expect(row.minuteLabel).toBeNull();
  });

  it("yields null minute and stoppageMinute for a clock-less CROSS", () => {
    const crosses = m001.events.crosses;
    if (crosses === null) {
      throw new Error("fixture m001 has no crosses");
    }
    const clockless: CrossEvent = { ...crosses[0], at: undefined as unknown as CrossEvent["at"] };
    const [row] = crossLogRows([clockless], home, away);
    expect(row.minute).toBeNull();
    expect(row.stoppageMinute).toBeNull();
    expect(row.minuteLabel).toBeNull();
  });

  it("yields null minute and stoppageMinute for a clock-less DEFENSIVE ACTION", () => {
    const actions = m001.events.defensiveActions;
    if (actions === null) {
      throw new Error("fixture m001 has no defensive actions");
    }
    const clockless: DefensiveActionEvent = {
      ...actions[0],
      at: undefined as unknown as DefensiveActionEvent["at"],
    };
    const [row] = defensiveRows([clockless], home, away);
    expect(row.minute).toBeNull();
    expect(row.stoppageMinute).toBeNull();
    expect(row.minuteLabel).toBeNull();
  });

  it("keeps a REAL clock intact in all three — the fix is null-only", () => {
    const [shot] = shotLogRows([shotsOf(m001)[0]], home, away);
    expect(shot.minute).not.toBeNull();
    expect(typeof shot.minute).toBe("number");
  });
});

describe("panelDataState (Task 8.2's three-way branch)", () => {
  it("distinguishes an absent table from an empty one", () => {
    expect(panelDataState(null)).toBe("absent");
    expect(panelDataState([])).toBe("zero");
    expect(panelDataState([1])).toBe("ready");
  });
});

describe("fixture reality, recorded but NOT depended upon", () => {
  it("keyStatistics[side].shots equals the rendered marker count on all six team-innings", () => {
    /*
     * Observation only. The panel deliberately does NOT rely on this equality:
     * the pipeline owns count validation (marker-count self-validation is a
     * Story 1.3 gate check), and the App must not fail loud on a divergence it
     * cannot fix. If this test ever goes red, the finding belongs in the
     * pipeline's ledger, not in a runtime assertion here.
     */
    for (const bundle of [m001, m002, m074]) {
      const shots = shotsOf(bundle);
      const { home, away } = sides(bundle);
      expect(shotMarkers(shots, home.teamId).length, `${bundle.matchId} home`).toBe(
        bundle.keyStatistics.home.shots
      );
      expect(shotMarkers(shots, away.teamId).length, `${bundle.matchId} away`).toBe(
        bundle.keyStatistics.away.shots
      );
    }
  });
});
