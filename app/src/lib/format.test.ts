import { describe, expect, it } from "vitest";

import {
  compareText,
  foldForSearch,
  formatDate,
  formatDecimal,
  formatInteger,
  formatKickoff,
  formatPercent,
  includesText,
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

/*
 * STORY 2.13 (Task 3.2) — the SUBSTRING counterpart to textEquals.
 *
 * `textEquals` cannot serve the leaderboard name filter: it is whole-string
 * equality built on Intl.Collator, and Intl has NO substring operation at all.
 * So `includesText` normalizes instead of collating, and it lives beside the
 * collators rather than in a second module — format.ts's own header declares it
 * "The ONLY text comparison for sorting", and a second normalization home is
 * exactly the drift that declaration exists to prevent.
 */
describe("includesText (Story 2.13)", () => {
  it("ignores accents on both sides", () => {
    expect(includesText("Núñez", "nunez")).toBe(true);
    expect(includesText("Nunez", "núñez")).toBe(true);
    expect(includesText("Álvarez", "alvarez")).toBe(true);
  });

  it("ignores case", () => {
    expect(includesText("SON Heungmin", "heung")).toBe(true);
    expect(includesText("son heungmin", "SON")).toBe(true);
  });

  it("matches everything on an empty needle", () => {
    // The filter's resting state: an empty input narrows nothing.
    expect(includesText("Núñez", "")).toBe(true);
    expect(includesText("", "")).toBe(true);
  });

  it("is a SUBSTRING filter, not a word filter — a match across a word boundary counts", () => {
    /*
     * SAY SO IN THE NAME so a later reader does not "fix" this into a
     * word-prefix matcher. A reader typing "n he" while scanning "SON
     * Heungmin" is mid-name, and narrowing the table is the whole point;
     * requiring a word boundary would make the control feel broken.
     */
    expect(includesText("SON Heungmin", "n he")).toBe(true);
    expect(includesText("Kevin De Bruyne", "in de")).toBe(true);
  });

  it("still rejects a needle that is not present", () => {
    expect(includesText("Núñez", "zzz")).toBe(false);
    expect(includesText("", "a")).toBe(false);
  });

  it("matches mid-word, which whole-string textEquals cannot", () => {
    // The one behavioural difference that made a new export necessary.
    expect(textEquals("Núñez", "nun")).toBe(false);
    expect(includesText("Núñez", "nun")).toBe(true);
  });
});

/*
 * STORY 2.14 — `foldForSearch` AS A PUBLIC FUNCTION.
 *
 * The header typeahead highlights the MATCHED SUBSTRING, which needs indices;
 * `includesText` returns a boolean and discards them. So 2.14 folds the
 * haystack itself and does the arithmetic there — and the arithmetic is only
 * sound while the fold is LENGTH-PRESERVING on the string being folded.
 *
 * That property is pinned here rather than in the search model, because it is a
 * property of THIS function: a future change to `DIACRITICS` that starts
 * dropping a character the corpus contains would silently shift every highlight
 * one column left, and the search model's own guard (fold length !== original
 * length → no highlight) would quietly swallow it instead of failing.
 */
describe("foldForSearch (Story 2.14)", () => {
  /*
   * TWO GROUPS, AND THE NAME USED TO HIDE THAT (code review 2026-08-07). The
   * comment claimed the whole array was "the real index's ENTIRE non-ASCII
   * inventory", which is true of the first three and invented of the last three
   * — the corpus inventory is exactly `ü`, `ô`, `ç`, as the sibling assertion in
   * `search-model.test.ts` proves. The last three are READER-typed forms, which
   * the test title has always covered ("the corpus and its readers") but the
   * constant's name and comment did not.
   *
   * Both groups matter and both belong here: the fold must be length-preserving
   * on the haystack (group one, or `matchSpan` silently drops every highlight)
   * and on the needle (group two, or a reader who correctly types "Quiñones"
   * gets a shifted span).
   */
  // The corpus's entire non-ASCII inventory across all 3,008 `name` fields.
  const CORPUS_ACCENTS = ["Türkiye", "Côte d'Ivoire", "Curaçao"];
  // Accented forms a reader types that the stripped corpus does not contain.
  const READER_ACCENTS = ["Núñez", "Quiñones", "Rüdiger"];

  it("is length-preserving for every accented form the corpus and its readers produce", () => {
    for (const name of [...CORPUS_ACCENTS, ...READER_ACCENTS]) {
      expect(foldForSearch(name), name).toHaveLength(name.length);
    }
  });

  it("folds accents and case so a correctly-spelled needle matches stripped data", () => {
    // The actual justification for AC 2: all 1,248 real player names arrive
    // with diacritics ALREADY stripped ("Julian QUINONES", "Darwin NUNEZ"), so
    // it is the READER who types the accent. Folding both sides is what works.
    expect(foldForSearch("Quiñones")).toBe("quinones");
    expect(foldForSearch("Núñez")).toBe("nunez");
    expect(foldForSearch("Türkiye")).toBe("turkiye");
  });

  /*
   * NOT length-preserving on the needle, and this is the property Story 2.14's
   * ruling 6 rests on. `\p{Diacritic}` covers SPACING characters that are not
   * combining marks — `^` U+005E, `´` U+00B4, `¨` U+00A8 — all of which are
   * dead-key-adjacent on a Spanish keyboard, so a reader really can type them.
   * They are DELETED rather than combined, so the fold shortens the string.
   */
  it("is NOT length-preserving for the spacing diacritics a Spanish keyboard emits", () => {
    for (const typed of ["a^b", "a´b", "a¨b"]) {
      expect(foldForSearch(typed).length, typed).toBeLessThan(typed.length);
    }
  });

  /*
   * 🔴 THE OLD ASSERTION COULD NOT FAIL (code review 2026-08-07). It read
   * `expect(includesText("Türkiye","turk")).toBe(
   * foldForSearch("Türkiye").includes("turk"))` — and `includesText` IS
   * `foldForSearch(h).includes(foldForSearch(n))`, with `foldForSearch("turk")`
   * equal to `"turk"`. Both sides were the same expression, so the test passed
   * for any implementation of either function, including a broken one.
   *
   * Replaced with assertions on LITERAL expected values, which is this repo's
   * standing rule: "an expectation built by the function under test reproduces
   * that function's bugs and can only prove it was called."
   */
  it("matches accent- and case-insensitively in both directions", () => {
    // Accent on the haystack, plain needle — the real corpus shape.
    expect(includesText("Türkiye", "turk")).toBe(true);
    // Accent on the NEEDLE, stripped haystack — the reader shape, and the one
    // that actually justifies AC 2: all 1,248 player names ship stripped.
    expect(includesText("Julian QUINONES", "quiñones")).toBe(true);
    // Case alone.
    expect(includesText("Curaçao", "CURACAO")).toBe(true);
    // A genuine non-match must stay false, or the folding is matching too much.
    expect(includesText("Türkiye", "turkmenistan")).toBe(false);
  });
});
