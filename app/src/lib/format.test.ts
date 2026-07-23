import { describe, expect, it } from "vitest";

import {
  compareText,
  formatDate,
  formatDecimal,
  formatInteger,
  formatKickoff,
  formatPercent,
  textEquals,
} from "@/lib/format";

describe("formatDecimal", () => {
  it("uses comma decimals for es (es-CO)", () => {
    expect(formatDecimal(1.24, "es")).toBe("1,24");
    expect(formatDecimal(10.4, "es", 1)).toBe("10,4");
  });

  it("uses point decimals for en", () => {
    expect(formatDecimal(1.24, "en")).toBe("1.24");
  });

  it("pads to the requested precision", () => {
    expect(formatDecimal(2, "es")).toBe("2,00");
  });

  it("rejects non-finite values instead of rendering NaN/Infinity/0", () => {
    expect(() => formatDecimal(Number.NaN, "es")).toThrow();
    expect(() => formatDecimal(Number.POSITIVE_INFINITY, "es")).toThrow();
    // A nullable artifact field erased at a boundary: Intl would coerce to "0".
    expect(() => formatDecimal(null as unknown as number, "es")).toThrow();
    expect(() => formatInteger(Number.NaN, "en")).toThrow();
  });
});

describe("formatInteger", () => {
  it("formats whole numbers without decimals", () => {
    expect(formatInteger(7, "es")).toBe("7");
    expect(formatInteger(7, "en")).toBe("7");
  });
});

describe("formatPercent", () => {
  it("joins the sign with NO space in Spanish (deliberate choice vs RAE)", () => {
    expect(formatPercent(62, "es")).toBe("62%");
  });

  it("formats en percent", () => {
    expect(formatPercent(62, "en")).toBe("62%");
  });

  it("keeps comma decimals inside a fractional Spanish percent", () => {
    expect(formatPercent(62.5, "es", 1)).toBe("62,5%");
  });
});

describe("formatDate", () => {
  it("renders Spanish long dates with lowercase months", () => {
    expect(formatDate("2026-07-21", "es")).toBe("21 de julio de 2026");
  });

  it("renders English long dates", () => {
    expect(formatDate("2026-07-21", "en")).toBe("July 21, 2026");
  });

  it("accepts a full ISO datetime and reads only the date part", () => {
    expect(formatDate("2026-07-21T23:30:00-05:00", "es")).toBe("21 de julio de 2026");
  });

  it("rejects non-ISO input", () => {
    expect(() => formatDate("21/07/2026", "es")).toThrow();
  });

  it("rejects a date with trailing garbage after the day", () => {
    expect(() => formatDate("2026-07-219", "es")).toThrow();
  });

  it("rejects impossible calendar dates instead of rolling them over", () => {
    // Date.UTC would silently turn 2026-13-45 into 2027-02-14.
    expect(() => formatDate("2026-13-45", "es")).toThrow();
    expect(() => formatDate("2026-02-30", "es")).toThrow();
  });
});

describe("formatKickoff", () => {
  // Wall clock 21:00 at a +02:00 venue. Exact-match assertions on purpose:
  // toContain("9:00") would also pass for an AM/PM bug ("9:00 a. m.") and for
  // a 24-hour rendering of the UTC instant ("19:00" contains "9:00").
  it("keeps the venue-local wall-clock time, day period included", () => {
    expect(formatKickoff("2026-06-11T21:00:00+02:00", "es")).toBe("9:00 p. m.");
    expect(formatKickoff("2026-06-11T21:00:00+02:00", "en")).toBe("9:00 PM");
  });

  it("rejects datetimes without a UTC offset", () => {
    expect(() => formatKickoff("2026-06-11T21:00:00", "es")).toThrow();
  });

  it("rejects Z-suffixed datetimes — UTC is by definition not venue-local", () => {
    // The contract carries venue-local time WITH its offset; no 2026 venue is
    // at UTC, so a Z timestamp is a pipeline bug that must fail loudly.
    expect(() => formatKickoff("2026-06-11T15:00:00Z", "en")).toThrow();
  });

  it("rejects out-of-range times instead of rolling them over", () => {
    expect(() => formatKickoff("2026-06-11T25:00:00+02:00", "es")).toThrow();
    expect(() => formatKickoff("2026-06-11T21:99:00+02:00", "es")).toThrow();
  });
});

describe("collation", () => {
  it("treats accents and case as the same base letter", () => {
    expect(textEquals("Álvarez", "alvarez")).toBe(true);
    expect(compareText("Á", "a")).toBe(0);
  });

  it("sorts accented names into their base-letter position", () => {
    const names = ["Zamora", "Álvarez", "Ñíguez"];
    expect([...names].sort((a, b) => compareText(a, b))).toEqual(["Álvarez", "Ñíguez", "Zamora"]);
  });
});
