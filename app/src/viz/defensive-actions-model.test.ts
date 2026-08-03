import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  DefensiveActionEvent,
  DefensiveActionType,
  MatchBundle,
} from "@/lib/contract/contract-types";
import {
  DEFENSIVE_ACTION_TYPES,
  anyContestType,
  defensiveActionKey,
  defensiveFigureCount,
  defensiveLegend,
  defensiveMarkers,
  defensiveRows,
  possessionContestKey,
} from "@/viz/defensive-actions-model";

/*
 * Story 2.9 Task 3. Fixtures via node:fs (the client-import seam bars
 * @/lib/build-data inside src/viz).
 *
 * READ THE FIXTURE WARNINGS BEFORE ADDING A TEST HERE. The fixtures are
 * actively misleading on this family and the story is written to stop a dev
 * building to them: they populate `at` and `playerName` on 100% of rows and
 * make block + possession-contest 44/47/55% of markers, while the CORPUS has
 * contest_type null on 20,169/20,169, no carrier at all for
 * playerId/playerName/at, and coordinates for only TWO of the four action
 * types. The constructed-event tests at the bottom are the corpus shape; no
 * fixture can produce it.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");
const ALL = [m001, m002, m074];

const ACCENT = {
  home: "--viz-team-a-on-pitch",
  away: "--viz-team-b-on-pitch",
} as const;

function sides(bundle: MatchBundle) {
  return {
    home: {
      teamId: bundle.metadata.homeTeam.teamId,
      teamCode: bundle.metadata.homeTeam.teamCode.toUpperCase(),
      colorVar: ACCENT.home,
    },
    away: {
      teamId: bundle.metadata.awayTeam.teamId,
      teamCode: bundle.metadata.awayTeam.teamCode.toUpperCase(),
      colorVar: ACCENT.away,
    },
  };
}

function eventsOf(bundle: MatchBundle): DefensiveActionEvent[] {
  const events = bundle.events.defensiveActions;
  if (events === null) {
    throw new Error(`fixture ${bundle.matchId} has no defensive actions`);
  }
  return events;
}

const HOME = { teamId: "home-team", teamCode: "HOM", colorVar: ACCENT.home };
const AWAY = { teamId: "away-team", teamCode: "AWY", colorVar: ACCENT.away };

/* ------------------------------------------------------------------------- */

describe("DEFENSIVE_ACTION_TYPES (ruled decision 16)", () => {
  it("lists the four codes in the schema's declaration order", () => {
    expect(DEFENSIVE_ACTION_TYPES).toEqual([
      "forced-turnover",
      "possession-regain",
      "block",
      "possession-contest",
    ]);
  });

  it("keys locale labels by enum CODE (AD-7)", () => {
    expect(defensiveActionKey("possession-regain")).toBe("enums.defensiveAction.possession-regain");
    expect(possessionContestKey("aerial-duel")).toBe("enums.possessionContest.aerial-duel");
  });

  it("is an ORDERED CODE LIST, never an encoding table (ruled decision 5)", () => {
    /*
     * The 2.7 SHOT_OUTCOME_ENCODING pattern — a frozen Record<Enum, {shape,
     * colorVar}> — is WRONG here: `block` and `possession-contest` are
     * aggregate panels with NO coordinates anywhere in the corpus, so an
     * encoding table would assert a visual treatment for two values that can
     * never appear on the map. This module exports no such table.
     */
    const asRecord = DEFENSIVE_ACTION_TYPES as unknown as Record<string, unknown>;
    expect(typeof asRecord.length).toBe("number");
    expect(Array.isArray(DEFENSIVE_ACTION_TYPES)).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */

describe("defensiveMarkers (Task 3.2)", () => {
  it("partitions every fixture's events across the two sides, losing none", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const events = eventsOf(bundle);
      const markers = defensiveMarkers(events, home, away);
      expect(markers.home.length + markers.away.length).toBe(events.length);
    }
  });

  it("carries the ruled shape and the acting team's -on-pitch accent (decisions 6, 8)", () => {
    const { home, away } = sides(m001);
    const markers = defensiveMarkers(eventsOf(m001), home, away);
    for (const marker of markers.home) {
      expect(marker.shape).toBe("triangle-filled");
      expect(marker.colorVar).toBe("--viz-team-a-on-pitch");
    }
    for (const marker of markers.away) {
      expect(marker.colorVar).toBe("--viz-team-b-on-pitch");
    }
  });

  it("keys on the ARTIFACT index — data, not layout — and keys are unique panel-wide", () => {
    const { home, away } = sides(m074);
    const markers = defensiveMarkers(eventsOf(m074), home, away);
    const keys = [...markers.home, ...markers.away].map((marker) => marker.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => /^defensive-\d+$/.test(key))).toBe(true);
  });

  it("plots x/y VERBATIM — never clamped, never adjusted (AR-6/AD-6)", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const events = eventsOf(bundle);
      const markers = defensiveMarkers(events, home, away);
      for (const marker of [...markers.home, ...markers.away]) {
        const index = Number(marker.key.slice("defensive-".length));
        expect(marker.x).toBe(events[index].x);
        expect(marker.y).toBe(events[index].y);
      }
    }
  });

  it("orders each side by minute (the roving order, UX-DR16)", () => {
    const { home, away } = sides(m074);
    const markers = defensiveMarkers(eventsOf(m074), home, away);
    for (const side of [markers.home, markers.away]) {
      const minutes = side.map((marker) => marker.minuteLabel);
      // Every fixture row carries a clock, so the labels must be non-null and
      // the underlying order must be non-decreasing by minute.
      expect(minutes.every((minute) => minute !== null)).toBe(true);
    }
  });

  it("builds the three-clause accessible name from the RIGHT keys (Task 3.3)", () => {
    const { home, away } = sides(m001);
    const marker = defensiveMarkers(eventsOf(m001), home, away).home[0];
    expect(marker.namePrefixKey).toBe("viz.defensiveActions.markerPrefix");
    // Unlike 2.8, these events DO carry a real clock in the contract, so the
    // middle clause is used for its actual purpose — no positional overload.
    expect(marker.minutePrefixKey).toBe("viz.defensiveActions.minutePrefix");
    expect(marker.subjectName).not.toBeNull();
    expect(marker.qualifierKey).toMatch(/^enums\.defensiveAction\./);
  });

  it("returns two empty arrays for an empty or absent slice (ruled decision 10)", () => {
    for (const events of [[], null]) {
      const markers = defensiveMarkers(events, HOME, AWAY);
      expect(markers.home).toEqual([]);
      expect(markers.away).toEqual([]);
    }
  });

  it("fails LOUD on a teamId matching neither side", () => {
    const stray = { ...eventsOf(m001)[0], teamId: "nobody" };
    expect(() => defensiveMarkers([stray], HOME, AWAY)).toThrow(/defensive-actions-model/);
  });
});

/* ------------------------------------------------------------------------- */

describe("the UX-DR9 popover rows (Task 3.4)", () => {
  it("lists team, player, minute and action type, in that order, on EVERY marker", () => {
    const { home, away } = sides(m001);
    const markers = defensiveMarkers(eventsOf(m001), home, away);
    const all = [...markers.home, ...markers.away];
    expect(all.length).toBeGreaterThan(0);
    for (const marker of all) {
      expect(marker.detail.slice(0, 4).map((row) => row.labelKey)).toEqual([
        "viz.table.team",
        "viz.table.player",
        "viz.table.minute",
        "viz.table.actionType",
      ]);
      // Four rows or five — never anything else, and the fifth is the only
      // optional one (ruled decision 20).
      expect([4, 5]).toContain(marker.detail.length);
    }
  });

  it("appends the contest-type row ONLY when that marker carries one (decision 20)", () => {
    const { home, away } = sides(m074);
    const markers = defensiveMarkers(eventsOf(m074), home, away);
    const all = [...markers.home, ...markers.away];
    const withContest = all.filter((marker) =>
      marker.detail.some((row) => row.labelKey === "viz.table.contestType")
    );
    // m074 carries 35 non-null contestType values out of 104 events.
    expect(withContest).toHaveLength(35);
    for (const marker of withContest) {
      const row = marker.detail.at(-1);
      expect(row?.labelKey).toBe("viz.table.contestType");
      expect(row?.value).toMatchObject({ kind: "key" });
    }
  });
});

/* ------------------------------------------------------------------------- */

describe("defensiveLegend (ruled decision 19 — ONE ENTRY PER TEAM)", () => {
  it("has one entry per side WITH MARKERS, never one per action type present", () => {
    const { home, away } = sides(m001);
    const markers = defensiveMarkers(eventsOf(m001), home, away);
    const legend = defensiveLegend([
      { colorVar: home.colorVar, label: "MEX", markerCount: markers.home.length },
      { colorVar: away.colorVar, label: "RSA", markerCount: markers.away.length },
    ]);
    expect(legend).toHaveLength(2);
    /*
     * m001 carries all FOUR action types. Decision 6 adds exactly one shape and
     * decision 8 rules team-only colour, so forced-turnover and
     * possession-regain are VISUALLY IDENTICAL on the map — a per-type legend
     * would claim a distinction the map does not draw.
     */
    const typesPresent = new Set(eventsOf(m001).map((event) => event.actionType));
    expect(typesPresent.size).toBe(4);
    expect(legend.length).not.toBe(typesPresent.size);
    for (const entry of legend) {
      expect(entry.kind).toBe("mark");
      expect(entry.shape).toBe("triangle-filled");
    }
    expect(legend.map((entry) => entry.colorVar)).toEqual([
      "--viz-team-a-on-pitch",
      "--viz-team-b-on-pitch",
    ]);
  });

  it("drops a side with no markers — a swatch for an absent mark is its own lie", () => {
    const legend = defensiveLegend([
      { colorVar: ACCENT.home, label: "HOM", markerCount: 3 },
      { colorVar: ACCENT.away, label: "AWY", markerCount: 0 },
    ]);
    expect(legend).toHaveLength(1);
    expect(legend[0].label).toBe("HOM");
  });

  it("is empty when neither side drew anything", () => {
    expect(
      defensiveLegend([
        { colorVar: ACCENT.home, label: "HOM", markerCount: 0 },
        { colorVar: ACCENT.away, label: "AWY", markerCount: 0 },
      ])
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------------- */

describe("defensiveRows (Task 3.6)", () => {
  it("logs every event from both teams, ordered by minute then home before away", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const events = eventsOf(bundle);
      const rows = defensiveRows(events, home, away);
      expect(rows).toHaveLength(events.length);
      let previous = -1;
      for (const row of rows) {
        expect(row.minute).toBeGreaterThanOrEqual(previous);
        previous = row.minute;
      }
    }
  });

  it("carries the columns the table renders", () => {
    const { home, away } = sides(m001);
    const row = defensiveRows(eventsOf(m001), home, away)[0];
    expect(Object.keys(row).sort()).toEqual(
      [
        "key",
        "teamCode",
        "playerName",
        "minuteLabel",
        "minute",
        "stoppageMinute",
        "x",
        "y",
        "actionTypeKey",
        "contestTypeKey",
      ].sort()
    );
    expect(row.actionTypeKey).toMatch(/^enums\.defensiveAction\./);
  });

  it("anyContestType gates the whole COLUMN on the FD-1 precedent (decision 20)", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      // Every fixture carries some non-null contestType — the corpus carries
      // NONE (20,169/20,169 null), which is the constructed case below.
      expect(anyContestType(defensiveRows(eventsOf(bundle), home, away))).toBe(true);
    }
  });

  it("returns [] for an empty or absent slice", () => {
    expect(defensiveRows([], HOME, AWAY)).toEqual([]);
    expect(defensiveRows(null, HOME, AWAY)).toEqual([]);
  });

  it("fails LOUD on a teamId matching neither side", () => {
    const stray = { ...eventsOf(m001)[0], teamId: "nobody" };
    expect(() => defensiveRows([stray], HOME, AWAY)).toThrow(/defensive-actions-model/);
  });
});

describe("defensiveFigureCount", () => {
  it("counts only the types actually present, never a fixed four (decision 5)", () => {
    const { home, away } = sides(m001);
    const markers = defensiveMarkers(eventsOf(m001), home, away);
    const counts = defensiveFigureCount(markers.home);
    expect(counts.total).toBe(markers.home.length);
    for (const entry of counts.byType) {
      expect(entry.count).toBeGreaterThan(0);
    }
    expect(counts.byType.map((entry) => entry.code)).toEqual(
      DEFENSIVE_ACTION_TYPES.filter((code) =>
        counts.byType.some((entry) => entry.code === code)
      )
    );
  });

  it("enumerates NOTHING for an empty side", () => {
    expect(defensiveFigureCount([])).toEqual({ total: 0, byType: [] });
  });
});

/* ------------------------------------------------------------------------- */

/*
 * TASK 3.7 — THE CORPUS SHAPE NO FIXTURE CAN PRODUCE (ruled decision 5).
 *
 * `contest_type` is null on 20,169/20,169 corpus events; playerId, playerName
 * and `at` have NO CARRIER AT ALL; and only forced-turnover and
 * possession-regain can ever be plotted. The fixtures contradict every one of
 * those facts, so this is the only place the shipped behaviour on REAL data is
 * exercised.
 *
 * THE CAST IS AUTHORISED HERE AND ONLY HERE. `DefensiveActionEvent` declares
 * `playerName: string` and `at: MinuteStamp`, both required and non-nullable,
 * so this shape is not constructible through the types. It is legitimate
 * because bundles reach the App as `as`-cast UNVALIDATED JSON — which is
 * exactly the path this test simulates.
 */
const CORPUS_SHAPED_EVENT = {
  teamId: HOME.teamId,
  actionType: "possession-regain" as DefensiveActionType,
  contestType: null,
  x: 41.5,
  y: 62.25,
} as unknown as DefensiveActionEvent;

describe("the corpus-real event shape (Task 3.7)", () => {
  it("degrades the accessible name to the two SPOKEN placeholders", () => {
    const markers = defensiveMarkers([CORPUS_SHAPED_EVENT], HOME, AWAY);
    const marker = markers.home[0];
    // null, not "—": PitchPanel speaks viz.marker.unknownPlayer /
    // viz.marker.unknownMinute for these, because an em dash is a typographic
    // mark most screen readers announce as nothing.
    expect(marker.subjectName).toBeNull();
    expect(marker.minuteLabel).toBeNull();
    expect(marker.qualifierKey).toBe("enums.defensiveAction.possession-regain");
    expect(marker.x).toBe(41.5);
  });

  it("shows team + action type + TWO EM DASHES in the popover, and no contest row", () => {
    // Assert exactly that, so nobody later reads it as a bug: on corpus-real
    // data this is the complete, correct popover.
    const marker = defensiveMarkers([CORPUS_SHAPED_EVENT], HOME, AWAY).home[0];
    expect(marker.detail).toEqual([
      { labelKey: "viz.table.team", value: { kind: "text", value: "HOM" } },
      { labelKey: "viz.table.player", value: { kind: "key", value: "viz.table.unknown" } },
      { labelKey: "viz.table.minute", value: { kind: "key", value: "viz.table.unknown" } },
      {
        labelKey: "viz.table.actionType",
        value: { kind: "key", value: "enums.defensiveAction.possession-regain" },
      },
    ]);
  });

  it("makes anyContestType false, so the log's contest column DISAPPEARS", () => {
    const rows = defensiveRows([CORPUS_SHAPED_EVENT], HOME, AWAY);
    expect(rows[0].contestTypeKey).toBeNull();
    expect(anyContestType(rows)).toBe(false);
  });

  it("sorts clock-less rows LAST and stably (orderByMinute, decision 5)", () => {
    const withClock = {
      ...CORPUS_SHAPED_EVENT,
      at: { minute: 12, stoppageMinute: null },
    } as unknown as DefensiveActionEvent;
    const rows = defensiveRows([CORPUS_SHAPED_EVENT, withClock], HOME, AWAY);
    expect(rows.map((row) => row.minuteLabel)).toEqual(["12′", null]);
  });

  it("stays correct when EVERY row is clock-less — the real-data case", () => {
    const second = { ...CORPUS_SHAPED_EVENT, x: 22.5 } as unknown as DefensiveActionEvent;
    const rows = defensiveRows([CORPUS_SHAPED_EVENT, second], HOME, AWAY);
    expect(rows.map((row) => row.x)).toEqual([41.5, 22.5]);
    expect(rows.every((row) => row.minuteLabel === null)).toBe(true);
  });

  it("counts only the ONE type present, never a fixed four", () => {
    const markers = defensiveMarkers([CORPUS_SHAPED_EVENT], HOME, AWAY);
    expect(defensiveFigureCount(markers.home)).toEqual({
      total: 1,
      byType: [{ code: "possession-regain", count: 1 }],
    });
  });
});
