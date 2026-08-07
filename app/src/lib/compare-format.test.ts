import { describe, expect, it } from "vitest";

import {
  composeCompareFigureSummary,
  composeEmptyHeadline,
  composeInvalidHeadline,
  composeSideHeading,
  composeSidesLabel,
  formatCompareValue,
} from "@/lib/compare-format";
import { es } from "@/locales/es";
import { en } from "@/locales/en";

/*
 * Story 2.17 Task 5.2. The format and composition layer, held against the SHIPPED
 * locale values rather than against invented fragments — these sentences exist to
 * be assembled from `es.compare.*`, and assembling them from stand-ins would
 * prove the joiner works while leaving the actual output untested.
 *
 * 🔴 THE COMPOSED FORM IS THE POINT (ruled D11). `t()` takes `(key, locale)` and
 * nothing else, so `{t(a)} {value} {t(b)}` in JSX emits the two spaces as LITERAL
 * children and fails the i18n gate. Every sentence below is built into a `const`
 * instead, and these tests pin the spacing and punctuation that composition has
 * to get right — the one thing a per-fragment locale test can never see.
 */

describe("formatCompareValue", () => {
  it("delegates to the ONE leaderboard formatter, so a metric cannot print two ways", () => {
    /*
     * The percent form keeps ONE decimal and appends "%" with NO space before it
     * — a deliberate, logged choice against RAE spacing that `composeMetricLabel`
     * also depends on (a "(%)" suffix would then print the sign twice).
     */
    expect(formatCompareValue(57.1, "percent", "es")).toBe("57,1%");
    expect(formatCompareValue(213, "decimal1", "es")).toBe("213,0");
    expect(formatCompareValue(1235.1, "integer", "es")).toBe("1.235");
  });

  it("follows the LOCALE, not the build — the grouping and the decimal mark move", () => {
    // The same number, two conventions: "1.235" in Spanish and "1,235" in
    // English. Both are the shipped `Intl` behaviour, and pinning both is what
    // makes a mid-session toggle a tested property rather than an assumption.
    expect(formatCompareValue(1235.1, "integer", "en")).toBe("1,235");
    expect(formatCompareValue(213, "decimal1", "en")).toBe("213.0");
    expect(formatCompareValue(57.1, "percent", "en")).toBe("57.1%");
  });

  it("THROWS on a non-finite value rather than printing NaN", () => {
    /*
     * This is why `compare-model.ts` guards at model entry: by the time the
     * formatter holds a bare number it can no longer name the entity or the
     * field, so the loud failure has to happen upstream.
     */
    expect(() => formatCompareValue(Number.NaN, "integer", "es")).toThrow();
  });
});

describe("composeEmptyHeadline — the picker-first state (AC 5)", () => {
  it("reads 'Elige dos jugadores para comparar.' from the shipped fragments", () => {
    expect(
      composeEmptyHeadline({
        before: es.compare.empty.headlineBefore,
        typeWord: es.compare.word.players,
        after: es.compare.empty.headlineAfter,
      })
    ).toBe("Elige dos jugadores para comparar.");
  });

  it("swaps only the type word across the three types", () => {
    const build = (typeWord: string) =>
      composeEmptyHeadline({
        before: es.compare.empty.headlineBefore,
        typeWord,
        after: es.compare.empty.headlineAfter,
      });
    expect(build(es.compare.word.teams)).toBe("Elige dos equipos para comparar.");
    expect(build(es.compare.word.matches)).toBe("Elige dos partidos para comparar.");
  });

  it("composes the English half on the same terms", () => {
    expect(
      composeEmptyHeadline({
        before: en.compare.empty.headlineBefore,
        typeWord: en.compare.word.players,
        after: en.compare.empty.headlineAfter,
      })
    ).toBe("Pick two players to compare.");
  });
});

describe("composeInvalidHeadline — the invalid-slug state (AC 5)", () => {
  it("closes TIGHT against the slug, with no space before the period", () => {
    /*
     * `headlineAfter` OPENS WITH THE PERIOD and is joined WITHOUT a space. This
     * is the assertion that catches the obvious mistake — a uniform
     * space-separated join would render "brasil-99 . Elige de la lista." and no
     * per-fragment test would see it.
     */
    expect(
      composeInvalidHeadline({
        before: es.compare.invalid.headlineBefore,
        slug: "brasil-99",
        after: es.compare.invalid.headlineAfter,
      })
    ).toBe("No encontramos brasil-99. Elige de la lista.");
  });

  it("SHIPS THE SECOND SENTENCE, which AC 5's quote truncates", () => {
    // `EXPERIENCE.md:94` carries "Elige de la lista." in full. An invalid state
    // that names the failure without naming the recovery is half a message.
    expect(es.compare.invalid.headlineAfter).toContain("Elige de la lista.");
    expect(en.compare.invalid.headlineAfter).toContain("Pick one from the list.");
  });

  it("echoes an arbitrary reader-supplied slug back as plain text", () => {
    // Rendered through React as a text child, never as markup — an injected
    // string cannot become an element. This pins the passthrough.
    expect(
      composeInvalidHeadline({
        before: es.compare.invalid.headlineBefore,
        slug: "<script>",
        after: es.compare.invalid.headlineAfter,
      })
    ).toBe("No encontramos <script>. Elige de la lista.");
  });
});

describe("composeSideHeading", () => {
  it("joins the entity and its detail with the clause separator", () => {
    expect(composeSideHeading("Julian QUINONES", "México")).toBe("Julian QUINONES — México");
  });

  it("collapses the clause entirely rather than dangling the separator", () => {
    expect(composeSideHeading("México", null)).toBe("México");
    expect(composeSideHeading("México", "")).toBe("México");
  });
});

describe("composeCompareFigureSummary", () => {
  it("NAMES the figure and whose it is; it does not read the values out", () => {
    /*
     * A screen-reader user's route to the numbers is the data-table alternative
     * behind "Ver los datos". A summary reciting sixteen figures would duplicate
     * it badly and still not be sortable — `composeTrendFigureSummary` takes the
     * same position for the same reason.
     */
    expect(
      composeCompareFigureSummary({
        title: "Perfil físico",
        entityName: "Julian QUINONES",
        unitLabel: "m",
      })
    ).toBe("Perfil físico — Julian QUINONES — m");
  });

  it("drops the unit clause when the family has no unit label", () => {
    expect(
      composeCompareFigureSummary({
        title: "En posesión",
        entityName: "México",
        unitLabel: null,
      })
    ).toBe("En posesión — México");
  });
});

describe("composeSidesLabel", () => {
  it("joins the two sides neutrally — they have no home/away relationship", () => {
    expect(composeSidesLabel("México", "Brasil")).toBe("México / Brasil");
  });
});
