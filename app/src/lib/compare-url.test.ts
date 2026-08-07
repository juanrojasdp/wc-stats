import { describe, expect, it } from "vitest";

import {
  COMPARE_PATH,
  COMPARE_TYPES,
  DEFAULT_COMPARE_TYPE,
  compareHref,
  compareSearch,
  isCompareType,
  parseCompareQuery,
  swapSides,
} from "@/lib/compare-url";

/*
 * Every expectation here is a HAND-WRITTEN LITERAL. An expectation built by
 * calling `compareSearch` back over the parser's output reproduces both
 * functions' bugs at once and can only prove they were called.
 */

describe("compareHref (ruled D2)", () => {
  /*
   * 🔴 THE TWO STRINGS `players/static-output.test.ts:201,204` PIN GREEN.
   * This story repoints `PlayerHero` at this helper; if these literals change,
   * a shipped assertion has been broken rather than improved.
   */
  it("emits the exact href the shipped player pages already carry", () => {
    expect(compareHref("players", "quinones-julian-mex")).toBe(
      "/compare/?type=players&a=quinones-julian-mex"
    );
    expect(compareHref("players", "acevedo-carlos-mex")).toBe(
      "/compare/?type=players&a=acevedo-carlos-mex"
    );
  });

  /*
   * The team href the same build emits. `compareTeamHref` returned this WITHOUT
   * the slash while its docblock claimed otherwise; `trailingSlash: true`
   * rewrote it at render, so the exported HTML always carried the slash form.
   */
  it("emits the slash before the query for teams and matches", () => {
    expect(compareHref("teams", "mexico")).toBe("/compare/?type=teams&a=mexico");
    expect(compareHref("matches", "m074-germany-paraguay")).toBe(
      "/compare/?type=matches&a=m074-germany-paraguay"
    );
  });

  it("appends b only when a second side is given", () => {
    expect(compareHref("teams", "mexico", "argentina")).toBe(
      "/compare/?type=teams&a=mexico&b=argentina"
    );
    expect(compareHref("teams", "mexico", undefined)).toBe("/compare/?type=teams&a=mexico");
  });

  it("starts at the route path, which carries its own trailing slash", () => {
    expect(COMPARE_PATH).toBe("/compare/");
    expect(compareHref("players", "x").startsWith("/compare/?")).toBe(true);
  });
});

describe("parseCompareQuery", () => {
  it("reads a full comparison", () => {
    expect(parseCompareQuery("?type=teams&a=mexico&b=argentina")).toEqual({
      type: "teams",
      a: "mexico",
      b: "argentina",
      droppedType: false,
    });
  });

  it("accepts a query string with no leading question mark", () => {
    expect(parseCompareQuery("type=matches&a=m074-germany-paraguay")).toEqual({
      type: "matches",
      a: "m074-germany-paraguay",
      b: null,
      droppedType: false,
    });
  });

  /*
   * The server snapshot. `out/compare/index.html` is one document served for
   * every query string, so this is what the exported document renders under —
   * and it must be the picker-first empty state, not a crash.
   */
  it("reads the empty query as the default type with no sides", () => {
    expect(parseCompareQuery("")).toEqual({
      type: DEFAULT_COMPARE_TYPE,
      a: null,
      b: null,
      droppedType: false,
    });
    expect(DEFAULT_COMPARE_TYPE).toBe("players");
  });

  /*
   * URL Contract step 1. `droppedType` separates "no type yet" (a first visit —
   * leave the URL alone) from "a bad type" (AC 5 — drop the param). Both fall
   * back to `players`, but only one of them writes.
   */
  it("falls back to players on an unknown type and flags the drop", () => {
    expect(parseCompareQuery("?type=stadiums&a=mexico")).toEqual({
      type: "players",
      a: "mexico",
      b: null,
      droppedType: true,
    });
  });

  it("does not flag a drop when type is merely absent", () => {
    expect(parseCompareQuery("?a=mexico").droppedType).toBe(false);
  });

  /*
   * `?a=&b=mexico` is what a half-filled picker and a hand-edited URL both
   * produce. Treating "" as a slug would send it to the manifest check and paint
   * the invalid state over what is really the partial state.
   */
  it("treats a blank or whitespace-only side as absent", () => {
    expect(parseCompareQuery("?type=teams&a=&b=mexico").a).toBe(null);
    expect(parseCompareQuery("?type=teams&a=%20%20&b=mexico").a).toBe(null);
    expect(parseCompareQuery("?type=teams&a=&b=mexico").b).toBe("mexico");
  });

  it("keeps a b-only comparison one-sided rather than promoting it", () => {
    expect(parseCompareQuery("?type=teams&b=mexico")).toEqual({
      type: "teams",
      a: null,
      b: "mexico",
      droppedType: false,
    });
  });
});

describe("compareSearch", () => {
  /*
   * 🔴 KEY ORDER IS THE CONTRACT. `replaceUrlQuery`'s re-entry guard is a string
   * equality check against `window.location.search`; an unstable key order would
   * make a freshly written URL compare unequal to itself and spin the page.
   */
  it("always orders type, then a, then b", () => {
    expect(compareSearch({ type: "teams", a: "mexico", b: "argentina" })).toBe(
      "type=teams&a=mexico&b=argentina"
    );
  });

  it("omits absent sides entirely rather than emitting them empty", () => {
    expect(compareSearch({ type: "players", a: null, b: null })).toBe("type=players");
    expect(compareSearch({ type: "players", a: null, b: "x" })).toBe("type=players&b=x");
  });

  /* Entity ids are ASCII slugs (AD-3), so encoding is a no-op on real input. */
  it("leaves a real slug byte-identical", () => {
    expect(compareSearch({ type: "players", a: "quinones-julian-mex", b: null })).toBe(
      "type=players&a=quinones-julian-mex"
    );
  });

  /*
   * A hand-edited URL must not be able to inject a second parameter into the
   * next href this route emits.
   */
  it("encodes separators a hand-edited URL could smuggle in", () => {
    expect(compareSearch({ type: "players", a: "x&type=teams", b: null })).toBe(
      "type=players&a=x%26type%3Dteams"
    );
  });

  /* The round trip a pasted URL depends on (AC 6). */
  it("round-trips through the parser", () => {
    const parsed = parseCompareQuery("?type=matches&a=m074-germany-paraguay&b=m082-belgium-senegal");
    expect(compareSearch(parsed)).toBe(
      "type=matches&a=m074-germany-paraguay&b=m082-belgium-senegal"
    );
  });
});

describe("swapSides (AC 2)", () => {
  it("exchanges the two sides", () => {
    expect(swapSides({ type: "teams", a: "mexico", b: "argentina", droppedType: false })).toEqual({
      type: "teams",
      a: "argentina",
      b: "mexico",
      droppedType: false,
    });
  });

  /*
   * A reader who has picked one entity and presses swap means "put it on the
   * other side", not "do nothing".
   */
  it("moves a single pick across rather than no-oping", () => {
    expect(swapSides({ type: "players", a: "solo", b: null, droppedType: false })).toEqual({
      type: "players",
      a: null,
      b: "solo",
      droppedType: false,
    });
  });

  it("is its own inverse", () => {
    const start = { type: "teams", a: "mexico", b: "argentina", droppedType: false } as const;
    expect(swapSides(swapSides(start))).toEqual(start);
  });
});

describe("the type vocabulary", () => {
  /* Declaration order IS the selector's segment order (AC 1). */
  it("lists the three types in selector order", () => {
    expect(COMPARE_TYPES).toEqual(["players", "teams", "matches"]);
  });

  it("recognises exactly those three", () => {
    expect(isCompareType("players")).toBe(true);
    expect(isCompareType("teams")).toBe(true);
    expect(isCompareType("matches")).toBe(true);
    expect(isCompareType("Players")).toBe(false);
    expect(isCompareType("stadiums")).toBe(false);
    expect(isCompareType(null)).toBe(false);
  });

  /*
   * 🔴 THE URL CARRIES ENGLISH ENUM CODES, THE LABELS ARE SPANISH
   * (`EXPERIENCE.md:43`, AD-7). If a display string ever reaches this array the
   * locale layer has leaked into the URL.
   */
  it("carries enum codes, never display strings", () => {
    for (const type of COMPARE_TYPES) {
      expect(type).toMatch(/^[a-z]+$/);
    }
  });
});
