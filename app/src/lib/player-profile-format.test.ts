import { describe, expect, it } from "vitest";

import {
  composeMetricLabel,
  composeTrendFigureSummary,
  composeZoneFigureSummary,
  formatCount,
  formatProfileValue,
  formatTrendPointLabel,
  profileUnitKey,
  speedZoneBandKey,
  speedZoneLabelKey,
  startedLabelKey,
  trendAxisWidth,
} from "@/lib/player-profile-format";

/*
 * Task 4.2. Every expectation is a hand-written literal — never a second call
 * to the function under test, and never a template built from the same
 * fragments the function joins, which is the failure mode the shipped suites
 * name ("an expectation built by the function under test reproduces that
 * function's bugs and can only prove it was called").
 */

describe("formatProfileValue", () => {
  it("prints metres at 1 dp in es-CO — comma decimal, dot grouping", () => {
    expect(formatProfileValue(47274.9, "decimal1", "es")).toBe("47.274,9");
    expect(formatProfileValue(8832.2, "decimal1", "es")).toBe("8.832,2");
  });

  it("prints the same value in en with the separators swapped", () => {
    expect(formatProfileValue(47274.9, "decimal1", "en")).toBe("47,274.9");
  });

  it("prints a percentage with NO space before the sign (UX-DR19)", () => {
    expect(formatProfileValue(82.2, "percent", "es")).toBe("82,2%");
  });

  it("prints an honest zero for a player who attempted no passes (D4b)", () => {
    // 17 players and 52 emitted match rows: pass completion 0,0 % meaning
    // "attempted none", not "completed none of many".
    expect(formatProfileValue(0, "percent", "es")).toBe("0,0%");
  });

  it("prints integer counts with locale grouping", () => {
    expect(formatProfileValue(1157, "integer", "es")).toBe("1.157");
    expect(formatCount(0, "es")).toBe("0");
  });

  it("prints minutesPlayed 0 as a real zero, never a dash (D4a)", () => {
    // 20 players have played > 0 with minutesPlayed 0. Story 1.18: "0 is the
    // honest floor"; the em dash is this codebase's MISSING-data glyph.
    expect(formatCount(0, "es")).toBe("0");
  });
});

describe("formatTrendPointLabel", () => {
  it("is compact enough for eight ticks on a 320 px plot", () => {
    // es-CO renders its own short numeric form and declines the 2-digit
    // request; five characters is the widest either dictionary produces.
    expect(formatTrendPointLabel("2026-06-11", "es")).toBe("11/6");
    expect(formatTrendPointLabel("2026-07-05", "es")).toBe("5/7");
  });

  it("is locale-ORDERED by Intl, not by a hardcoded pattern", () => {
    // Day-first in es, month-first in en — same instant, same helper.
    expect(formatTrendPointLabel("2026-06-11", "en")).toBe("06/11");
  });

  it("throws on a malformed date rather than rendering a plausible wrong one", () => {
    expect(() => formatTrendPointLabel("2026-13-40", "es")).toThrow();
  });
});

describe("composeMetricLabel", () => {
  it("appends the unit in parentheses", () => {
    expect(composeMetricLabel("Distancia total", "m")).toBe("Distancia total (m)");
    expect(composeMetricLabel("Velocidad máxima", "km/h")).toBe("Velocidad máxima (km/h)");
  });

  it("appends NOTHING for a unit-less metric", () => {
    // A percentage carries its sign inside the formatted value, and a count has
    // no unit at all — both would print the unit twice or invent one.
    expect(composeMetricLabel("Precisión de pase", null)).toBe("Precisión de pase");
    expect(composeMetricLabel("Goles", null)).toBe("Goles");
  });
});

describe("profileUnitKey", () => {
  it("keys the three real units and null for the two that take none", () => {
    expect(profileUnitKey("m")).toBe("enums.unit.m");
    expect(profileUnitKey("kmh")).toBe("enums.unit.kmh");
    expect(profileUnitKey("km")).toBe("enums.unit.km");
    expect(profileUnitKey("count")).toBeNull();
    expect(profileUnitKey("percent")).toBeNull();
  });
});

describe("reused dictionary keys", () => {
  it("reaches the SHIPPED zone labels and band descriptors, minting neither", () => {
    expect(speedZoneLabelKey(1)).toBe("expert.field.distanceZone1");
    expect(speedZoneLabelKey(5)).toBe("expert.field.distanceZone5");
    expect(speedZoneBandKey(1)).toBe("expert.fieldTitle.distanceZone1");
    expect(speedZoneBandKey(5)).toBe("expert.fieldTitle.distanceZone5");
  });

  it("maps the started boolean onto a ruled label pair, never a raw true", () => {
    expect(startedLabelKey(true)).toBe("player.started.yes");
    expect(startedLabelKey(false)).toBe("player.started.no");
  });
});

describe("trendAxisWidth", () => {
  it("gives a short count axis its floor and a long metres axis more room", () => {
    const short = trendAxisWidth(["0", "1", "2", "3"]);
    const long = trendAxisWidth(["0,0", "5.000,0", "10.000,0", "15.000,0"]);
    expect(short).toBe(30);
    expect(long).toBeGreaterThan(short);
  });

  it("is bounded at both ends — never 0, never half a 320 px plot", () => {
    expect(trendAxisWidth([])).toBe(30);
    expect(trendAxisWidth(["1234567890123456789012345"])).toBe(72);
  });
});

describe("figure summaries", () => {
  it("names the metric and the match window without reciting the values", () => {
    expect(
      composeTrendFigureSummary({
        metricLabel: "Velocidad máxima (km/h)",
        matchCount: "5 partidos",
        firstLabel: "11/6",
        lastLabel: "5/7",
      })
    ).toBe("Velocidad máxima (km/h), 5 partidos. 11/6 – 5/7");
  });

  it("collapses the window to one date for a single-match player", () => {
    // 191 players have exactly one match; "11 jun – 11 jun" is not a range.
    expect(
      composeTrendFigureSummary({
        metricLabel: "Goles",
        matchCount: "1 partido",
        firstLabel: "11/6",
        lastLabel: "11/6",
      })
    ).toBe("Goles, 1 partido. 11/6");
  });

  it("names the zone chart by title, band count and unit", () => {
    expect(
      composeZoneFigureSummary({
        title: "Perfil físico",
        bandCount: "5 zonas de velocidad",
        unitLabel: "m",
      })
    ).toBe("Perfil físico, 5 zonas de velocidad, m");
  });
});
