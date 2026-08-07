import { describe, expect, it } from "vitest";

import {
  composeGoalPair,
  composeGroupLabel,
  composeRateFigureSummary,
  composeRecordTriple,
  formatGoalDifference,
  formatKilometres,
  formatMetres,
  formatPressingIntensity,
  formatRateTick,
  formatRateValue,
  formatTeamCount,
} from "@/lib/team-profile-format";

/*
 * Task 4.3. EVERY EXPECTATION IS A LITERAL, never a second call to the function
 * under test — the shipped suites' rule, learned when Story 1.17's precision
 * gate graded itself and 553 leaves shipped truncated behind 41 green tests.
 *
 * BOTH LOCALES ARE MEASURED. es-CO uses a COMMA decimal separator and a DOT
 * thousands separator, en uses the inverse, and a formatter tested in one locale
 * only is a formatter that will collate wrongly in the other — which is also why
 * the sort contract forbids sorting a numeric column on its formatted string.
 */

describe("team-profile-format — rates (AC 2)", () => {
  it("prints axis ticks at 0 dp and table values at 1 dp", () => {
    /*
     * The two precisions the shipped tactical sections use
     * (PhasesSection.tsx:148 vs :218). A tick set at 1 dp reads as a wall of
     * decimals; a table value at 0 dp would ROUND a precomputed number, which
     * AR-5 forbids.
     */
    expect(formatRateTick(38, "es")).toBe("38%");
    expect(formatRateValue(38, "es")).toBe("38,0%");
    expect(formatRateValue(13.4, "es")).toBe("13,4%");
    expect(formatRateValue(13.4, "en")).toBe("13.4%");
  });

  it("prints a ZERO rate verbatim, never an em dash (D9)", () => {
    /*
     * Mexico's `phasesOutOfPossession.lowPress` is 0.0 — "a zero is a real,
     * dense measurement … Print it" (ExpertLayer.tsx:392-397). There is no
     * presence gate on this route because there is no null to gate on.
     */
    expect(formatRateValue(0, "es")).toBe("0,0%");
    expect(formatRateValue(0, "en")).toBe("0.0%");
    expect(formatRateTick(0, "es")).toBe("0%");
  });
});

describe("team-profile-format — distances (D12)", () => {
  it("prints shapeByPhase metres at 1 dp in both locales", () => {
    expect(formatMetres(19.4, "es")).toBe("19,4");
    expect(formatMetres(19.4, "en")).toBe("19.4");
    expect(formatMetres(53.4, "es")).toBe("53,4");
  });

  it("prints distanceCovered as KILOMETRES at 2 dp, never metres", () => {
    /*
     * THE BOUNDARY STORY 1.10 RULES MUST NEVER BE CROSSED. A team match reads
     * ~107 km; a player match reads ~10,000 m. Two decimals is the team field's
     * contracted precision.
     */
    expect(formatKilometres(107.3, "es")).toBe("107,30");
    expect(formatKilometres(107.3, "en")).toBe("107.30");
    expect(formatKilometres(116.5, "es")).toBe("116,50");
  });
});

describe("team-profile-format — pressingIntensity is NOT a percentage (D12)", () => {
  it("prints a count-valued mean at 1 dp with no percent sign", () => {
    /*
     * "Mean defensive pressures applied per match", `x-decimals: 1`. Mexico is
     * 213.0. The adjacent tile carries `possession`, which IS a percentage — so
     * a stray "%" here would sit beside a real one and read as correct.
     */
    expect(formatPressingIntensity(213, "es")).toBe("213,0");
    expect(formatPressingIntensity(213, "en")).toBe("213.0");
    expect(formatPressingIntensity(213, "es")).not.toContain("%");
    expect(formatPressingIntensity(213, "en")).not.toContain("%");
  });
});

describe("team-profile-format — counts and goal difference", () => {
  it("groups counts by locale", () => {
    expect(formatTeamCount(5, "es")).toBe("5");
    expect(formatTeamCount(1248, "es")).toBe("1.248");
    expect(formatTeamCount(1248, "en")).toBe("1,248");
  });

  it("prints a signed goal difference verbatim, negative included", () => {
    /*
     * `record.goalDifference` SHIPS SIGNED and is never recomputed from
     * `goalsFor - goalsAgainst` (D12). Mexico is +7; a group-stage exit can be
     * negative, and the locale's own minus sign is what renders it.
     */
    expect(formatGoalDifference(7, "es")).toBe("7");
    expect(formatGoalDifference(-4, "es")).toBe("-4");
    expect(formatGoalDifference(0, "es")).toBe("0");
  });
});

describe("team-profile-format — label composition", () => {
  it("uppercases the contract's lowercase group letter in the view layer", () => {
    // The enum is lowercase "a".."l"; the transform belongs in presentation
    // (TournamentHub.tsx:572's shipped ruling).
    expect(composeGroupLabel("Grupo", "a")).toBe("Grupo A");
    expect(composeGroupLabel("Group", "l")).toBe("Group L");
  });

  it("composes the record triple and the goal pair as single tile values", () => {
    expect(composeRecordTriple({ won: "4", drawn: "0", lost: "1", separator: "-" })).toBe("4-0-1");
    expect(composeGoalPair({ goalsFor: "10", goalsAgainst: "3", separator: "-" })).toBe("10-3");
  });

  it("composes a figure summary from already-resolved fragments only", () => {
    /*
     * t() HAS NO INTERPOLATION, so the summary is assembled from identifiers and
     * hoisted to a const before it reaches the gated `figureSummary` prop. The
     * JSX form `{t(a)} ({t(b)})` emits literal " (" children and fails the i18n
     * gate outright.
     */
    /*
     * The three fragments mirror `PhasesSection`'s own figureSummary shape —
     * prefix + state, the entity, then the independent-rates note — with the
     * two-team clause collapsed to one name because every chart here is
     * single-series (D1).
     */
    expect(
      composeRateFigureSummary({
        headline: "Fases de juego: En posesión",
        entityName: "Mexico",
        note: "Son tasas independientes por fase: no suman 100 y no son partes de un total.",
      })
    ).toBe(
      "Fases de juego: En posesión, Mexico, " +
        "Son tasas independientes por fase: no suman 100 y no son partes de un total."
    );
  });
});
