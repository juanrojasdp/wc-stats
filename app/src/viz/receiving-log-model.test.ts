import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MatchBundle, ReceivingEvent } from "@/lib/contract/contract-types";
import { anyMinute, anyPlayerName } from "@/viz/defensive-actions-model";
import {
  RECEIVING_EVENT_TYPES,
  anyMovementType,
  anyReceivingEvents,
  receivingEventTypeKey,
  receivingLogRows,
} from "@/viz/receiving-log-model";

/*
 * Story 2.11c Task 4. Fixtures via node:fs — the client-import seam bars
 * @/lib/build-data inside src/viz, so this is the harness every sibling model
 * test uses.
 *
 * THE FIXTURE / CORPUS SPLIT, WHICH IS THIS FAMILY'S WHOLE STORY. Story 1.13
 * measured `ReceivingEvent` unfulfillable across 104 reports / 416 pages, so on
 * corpus data `events.receiving` is null and the whole log SELF-REMOVES behind
 * `anyReceivingEvents` (ruled decision 4). The fixtures are the opposite: 270
 * events with all eight fields non-null on 270/270. Every number below is
 * MEASURED against those fixtures and hard-coded on purpose — a drifting fixture
 * must turn this suite red.
 *
 * The consequence for coverage is that three real branches are unreachable from
 * any fixture and are only exercised by the constructed block at the bottom:
 * `movementType: null` (non-null on 270/270), an absent `at` (present on
 * 270/270) and a non-null `stoppageMinute` (null on 270/270).
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");
const ALL = [m001, m002, m074];

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

function eventsOf(bundle: MatchBundle): ReceivingEvent[] {
  const events = bundle.events.receiving;
  if (events === null) {
    throw new Error(`fixture ${bundle.matchId} has no receiving events`);
  }
  return events;
}

const HOME = { teamId: "home-team", teamCode: "HOM" };
const AWAY = { teamId: "away-team", teamCode: "AWY" };

/** The ten field names ruled in Task 1.2 — the pin that catches a stray column. */
const ROW_FIELDS = [
  "key",
  "teamCode",
  "playerName",
  "minuteLabel",
  "minute",
  "stoppageMinute",
  "x",
  "y",
  "eventTypeKey",
  "movementTypeKey",
];

/* ------------------------------------------------------------------------- */

describe("RECEIVING_EVENT_TYPES (the discriminator, ruling 3)", () => {
  it("lists the two codes in the schema's declaration order", () => {
    expect(RECEIVING_EVENT_TYPES).toEqual(["offer", "movement"]);
  });

  it("keys locale labels by enum CODE (AD-7)", () => {
    expect(receivingEventTypeKey("offer")).toBe("enums.receivingEventType.offer");
    expect(receivingEventTypeKey("movement")).toBe("enums.receivingEventType.movement");
  });
});

/* ------------------------------------------------------------------------- */

describe("receivingLogRows over the fixtures", () => {
  it("logs every event of both teams — 87 / 87 / 96, 270 in total", () => {
    const counts = ALL.map((bundle) => {
      const { home, away } = sides(bundle);
      return receivingLogRows(eventsOf(bundle), home, away).length;
    });
    expect(counts).toEqual([87, 87, 96]);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(270);
  });

  it("carries every contract field non-null on 270/270 rows", () => {
    /*
     * `ReceivingEvent` has exactly ONE nullable field, `movementType`, and the
     * fixtures populate even that on every row. `stoppageMinute` is the
     * exception and is asserted separately below: it is null on 270/270, which
     * is why the "90+2′" branch of formatGoalMinute is constructed-test-only.
     */
    let rowCount = 0;
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      for (const row of receivingLogRows(eventsOf(bundle), home, away)) {
        rowCount += 1;
        expect(row.teamCode).not.toBe("");
        expect(row.playerName).not.toBeNull();
        expect(row.minuteLabel).not.toBeNull();
        expect(row.minute).not.toBeNull();
        expect(Number.isFinite(row.x)).toBe(true);
        expect(Number.isFinite(row.y)).toBe(true);
        expect(row.eventTypeKey).toMatch(/^enums\.receivingEventType\./);
        expect(row.movementTypeKey).not.toBeNull();
        expect(row.movementTypeKey).toMatch(/^enums\.offerMovement\./);
      }
    }
    expect(rowCount).toBe(270);
  });

  it("leaves stoppageMinute null on 270/270 — the stoppage branch is fixture-unreachable", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const rows = receivingLogRows(eventsOf(bundle), home, away);
      expect(rows.every((row) => row.stoppageMinute === null)).toBe(true);
    }
  });

  it("splits the discriminator 44/43, 44/43, 48/48", () => {
    const split = ALL.map((bundle) => {
      const { home, away } = sides(bundle);
      const rows = receivingLogRows(eventsOf(bundle), home, away);
      return [
        rows.filter((row) => row.eventTypeKey === "enums.receivingEventType.offer").length,
        rows.filter((row) => row.eventTypeKey === "enums.receivingEventType.movement").length,
      ];
    });
    expect(split).toEqual([
      [44, 43],
      [44, 43],
      [48, 48],
    ]);
  });

  it("covers 29 / 29 / 32 distinct players — the fixtures' distinct playerId count", () => {
    // `playerId` is deliberately NOT a row field (Task 1.2's ten names are
    // fixed), and the fixtures carry one name per id, so the name count is the
    // measurable proxy: 29 / 29 / 32 in both.
    const distinct = ALL.map((bundle) => {
      const { home, away } = sides(bundle);
      const rows = receivingLogRows(eventsOf(bundle), home, away);
      return new Set(rows.map((row) => row.playerName)).size;
    });
    expect(distinct).toEqual([29, 29, 32]);
  });

  it("renders m074's extra time — minutes span 5 to 118, and 118 is not an error", () => {
    const { home, away } = sides(m074);
    const rows = receivingLogRows(eventsOf(m074), home, away);
    const minutes = rows.map((row) => row.minute).filter((minute): minute is number => minute !== null);
    expect(Math.min(...minutes)).toBe(5);
    expect(Math.max(...minutes)).toBe(118);
    // A plain minute with no stoppage field — the label carries no "+".
    expect(rows.at(-1)?.minuteLabel).toBe("118′");
  });

  it("pins the row's field set to the ten ruled names", () => {
    const { home, away } = sides(m001);
    const row = receivingLogRows(eventsOf(m001), home, away)[0];
    expect(Object.keys(row).sort()).toEqual([...ROW_FIELDS].sort());
  });

  it("keys on the ARTIFACT index, and the keys are unique table-wide", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const keys = receivingLogRows(eventsOf(bundle), home, away).map((row) => row.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((key) => /^receiving-row-\d+$/.test(key))).toBe(true);
    }
  });

  it("copies x/y VERBATIM — never clamped, never adjusted (AR-6/AD-6)", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const events = eventsOf(bundle);
      for (const row of receivingLogRows(events, home, away)) {
        const index = Number(row.key.slice("receiving-row-".length));
        expect(row.x).toBe(events[index].x);
        expect(row.y).toBe(events[index].y);
      }
    }
  });

  it("orders by minute major, home before away minor, artifact order last", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const rows = receivingLogRows(eventsOf(bundle), home, away);
      let previousMinute = -1;
      let previousRank = -1;
      let seenNull = false;
      for (const row of rows) {
        if (row.minute === null) {
          seenNull = true;
          continue;
        }
        expect(seenNull, "a clock-less row must never precede a clocked one").toBe(false);
        expect(row.minute).toBeGreaterThanOrEqual(previousMinute);
        const rank = row.teamCode === home.teamCode ? 0 : 1;
        if (row.minute === previousMinute) {
          // Same minute: home block before away block (sideRank is the tiebreak).
          expect(rank).toBeGreaterThanOrEqual(previousRank);
        }
        previousMinute = row.minute;
        previousRank = rank;
      }
    }
  });

  it("resolves both teams' codes, uppercased, and loses no event to either side", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const rows = receivingLogRows(eventsOf(bundle), home, away);
      const codes = new Set(rows.map((row) => row.teamCode));
      expect([...codes].sort()).toEqual([home.teamCode, away.teamCode].sort());
      for (const code of codes) {
        expect(code).toBe(code.toUpperCase());
      }
    }
  });
});

/* ------------------------------------------------------------------------- */

describe("the presence gates", () => {
  it("anyReceivingEvents is true on every fixture — the log renders", () => {
    for (const bundle of ALL) {
      expect(anyReceivingEvents(bundle.events.receiving)).toBe(true);
    }
  });

  it("anyReceivingEvents is false for null AND for [] — both are 'no log'", () => {
    // `[]` is `ready` with zero rows, not absence (match-bundle.schema.json:
    // "Empty array and null are distinct states"), but a zero-row event log has
    // nothing to render either way.
    expect(anyReceivingEvents(null)).toBe(false);
    expect(anyReceivingEvents([])).toBe(false);
  });

  it("anyMovementType is true on every fixture — the column stays", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      expect(anyMovementType(receivingLogRows(eventsOf(bundle), home, away))).toBe(true);
    }
  });

  it("reuses defensive-actions-model's anyPlayerName / anyMinute UNMODIFIED", () => {
    /*
     * Task 1.5: both are declared with STRUCTURAL parameters, so they accept
     * `ReceivingLogRow[]` with no change at all. That is the whole reason the
     * first seven field names in Task 1.2 are fixed rather than chosen.
     */
    const { home, away } = sides(m001);
    const rows = receivingLogRows(eventsOf(m001), home, away);
    expect(anyPlayerName(rows)).toBe(true);
    expect(anyMinute(rows)).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */

describe("the failure modes (Task 4.3)", () => {
  it("returns [] for an empty or absent slice", () => {
    expect(receivingLogRows([], HOME, AWAY)).toEqual([]);
    expect(receivingLogRows(null, HOME, AWAY)).toEqual([]);
  });

  it("fails LOUD on a teamId matching neither side, NAMING the module", () => {
    const stray = { ...eventsOf(m001)[0], teamId: "nobody" };
    expect(() => receivingLogRows([stray], HOME, AWAY)).toThrow(/receiving-log-model/);
    expect(() => receivingLogRows([stray], HOME, AWAY)).toThrow(/nobody/);
  });

  it("fails LOUD at model entry on a non-finite coordinate, not lazily in the table", () => {
    /*
     * `undefined`, not just NaN: the bundle arrives as `as`-cast unvalidated
     * JSON, so an ABSENT coordinate is the realistic shape. Left unguarded it
     * would reach `formatDecimal`, whose `assertFinite` throws — inside the
     * table, far from the cause. Ruling 11.
     */
    const base = eventsOf(m001)[0];
    const noX = { ...base, x: undefined } as unknown as ReceivingEvent;
    const nanY = { ...base, y: Number.NaN } as unknown as ReceivingEvent;
    expect(() => receivingLogRows([noX], HOME, AWAY)).toThrow(/non-finite coordinate/);
    expect(() => receivingLogRows([noX], HOME, AWAY)).toThrow(/receiving-log-model/);
    expect(() => receivingLogRows([noX], HOME, AWAY)).toThrow(/artifact index 0/);
    expect(() => receivingLogRows([nanY], HOME, AWAY)).toThrow(/non-finite coordinate/);
  });
});

/* ------------------------------------------------------------------------- */

/*
 * TASK 4.2 — THE THREE BRANCHES NO FIXTURE CAN PRODUCE.
 *
 * THE CAST IS AUTHORISED HERE AND ONLY HERE, on the precedent
 * defensive-actions-model.test.ts sets: `ReceivingEvent` declares `at` and
 * `playerName` required and non-nullable, so these shapes are not constructible
 * through the types — but bundles reach the App as `as`-cast UNVALIDATED JSON,
 * which is exactly the path these simulate.
 */
const BASE_EVENT = {
  teamId: HOME.teamId,
  playerId: "p-1",
  playerName: "Alguien",
  type: "offer",
  movementType: "in-front",
  at: { minute: 33, stoppageMinute: null },
  x: 55.25,
  y: 40.5,
} as unknown as ReceivingEvent;

describe("the constructed shapes (Task 4.2)", () => {
  it("drops the movement column when movementType is null on every row", () => {
    // Non-null on 270/270 fixture rows: this branch is unreachable from any
    // fixture render, and it is the contract's ONLY nullable field.
    const unclassified = { ...BASE_EVENT, movementType: null } as unknown as ReceivingEvent;
    const rows = receivingLogRows([unclassified], HOME, AWAY);
    expect(rows[0].movementTypeKey).toBeNull();
    expect(anyMovementType(rows)).toBe(false);
  });

  it("treats an undefined movementType as unclassified too", () => {
    const { movementType: _dropped, ...withoutField } = BASE_EVENT as unknown as Record<
      string,
      unknown
    >;
    const rows = receivingLogRows([withoutField as unknown as ReceivingEvent], HOME, AWAY);
    expect(rows[0].movementTypeKey).toBeNull();
    expect(anyMovementType(rows)).toBe(false);
  });

  it("keeps the movement column the moment ONE row carries a classification", () => {
    const unclassified = { ...BASE_EVENT, movementType: null } as unknown as ReceivingEvent;
    expect(anyMovementType(receivingLogRows([unclassified, BASE_EVENT], HOME, AWAY))).toBe(true);
  });

  it("nulls the clock when `at` is absent, and sorts that row LAST", () => {
    const { at: _dropped, ...clockless } = BASE_EVENT as unknown as Record<string, unknown>;
    const clocklessEvent = clockless as unknown as ReceivingEvent;
    const alone = receivingLogRows([clocklessEvent], HOME, AWAY);
    expect(alone[0].minuteLabel).toBeNull();
    expect(alone[0].minute).toBeNull();
    expect(alone[0].stoppageMinute).toBeNull();
    // NULL, never 0 — 2.11a decision 3. A `?? 0` would claim minute 0 while
    // `orderByMinute` sorted the same row last.
    expect(anyMinute(alone)).toBe(false);

    const mixed = receivingLogRows([clocklessEvent, BASE_EVENT], HOME, AWAY);
    expect(mixed.map((row) => row.minuteLabel)).toEqual(["33′", null]);
    expect(anyMinute(mixed)).toBe(true);
  });

  it("labels a stoppage-time event '90+2′' — null on 270/270 fixtures", () => {
    const stoppage = {
      ...BASE_EVENT,
      at: { minute: 90, stoppageMinute: 2 },
    } as unknown as ReceivingEvent;
    const [row] = receivingLogRows([stoppage], HOME, AWAY);
    expect(row.minuteLabel).toBe("90+2′");
    expect(row.minute).toBe(90);
    expect(row.stoppageMinute).toBe(2);
  });

  it("treats an absent AND an empty playerName as null, matching playerNameOf", () => {
    const { playerName: _dropped, ...nameless } = BASE_EVENT as unknown as Record<string, unknown>;
    const empty = { ...BASE_EVENT, playerName: "" } as unknown as ReceivingEvent;
    const rows = receivingLogRows(
      [nameless as unknown as ReceivingEvent, empty],
      HOME,
      AWAY
    );
    expect(rows.map((row) => row.playerName)).toEqual([null, null]);
    expect(anyPlayerName(rows)).toBe(false);
  });
});
