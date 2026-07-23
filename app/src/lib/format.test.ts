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
});

describe("formatKickoff", () => {
  // Wall clock 21:00 at a +02:00 venue: any timezone conversion bug would
  // surface a different hour (19:00 UTC, 14:00 Bogotá, ...).
  it("keeps the venue-local wall-clock time", () => {
    expect(formatKickoff("2026-06-11T21:00:00+02:00", "es")).toContain("9:00");
    expect(formatKickoff("2026-06-11T21:00:00+02:00", "en")).toContain("9:00");
  });

  it("accepts Z-offset datetimes", () => {
    expect(formatKickoff("2026-06-11T15:00:00Z", "en")).toContain("3:00");
  });

  it("rejects datetimes without a UTC offset", () => {
    expect(() => formatKickoff("2026-06-11T21:00:00", "es")).toThrow();
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
