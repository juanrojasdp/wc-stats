import { describe, expect, it } from "vitest";

import { composeRouteTitle } from "@/lib/route-title";

/*
 * `composeRouteTitle` exists for ONE reason and the test says it out loud:
 * `eslint.config.mjs:207-221` gates `title|description|default|template|
 * absolute|alt|siteName` inside `metadata`/`generateMetadata`, and
 * `--max-warnings 0` makes a bare template literal there a BUILD ERROR. So the
 * four routes story 3.9 mints cannot write `` `${a} · ${b}` `` at their call
 * site. They call this.
 *
 * It is deliberately NOT `composeHubTitle`. That helper's docblock states its
 * first argument is "a proper noun, not a translated label (AD-7)" —
 * `tournamentName`. `/tops`, `/players` and `/teams` compose from TRANSLATED
 * surface labels, so reusing it would falsify a docblock that is currently
 * true.
 */
describe("composeRouteTitle", () => {
  it("joins the surface label to the site name with the separator, in that order", () => {
    expect(
      composeRouteTitle({
        surfaceLabel: "Líderes del torneo",
        siteName: "Mundial Stats",
        separator: " · ",
      })
    ).toBe("Líderes del torneo · Mundial Stats");
  });

  it("does not translate, trim or reorder what it is given", () => {
    // A proper noun with an accent and a label with trailing punctuation both
    // survive byte-for-byte: this helper composes, it does not normalize.
    expect(
      composeRouteTitle({
        surfaceLabel: "Jugadores",
        siteName: "Mundial Stats",
        separator: " — ",
      })
    ).toBe("Jugadores — Mundial Stats");
  });

  it("is the SAME shape composeHubTitle produces, so the four routes match the Hub", () => {
    // Not a tautology: it pins the ORDER. A helper that emitted
    // "Mundial Stats · Equipos" would make the site name the first thing a
    // 60-character search result truncates toward, and every shipped route
    // leads with the surface.
    const composed = composeRouteTitle({
      surfaceLabel: "Equipos",
      siteName: "Mundial Stats",
      separator: " · ",
    });
    expect(composed.startsWith("Equipos")).toBe(true);
    expect(composed.endsWith("Mundial Stats")).toBe(true);
  });
});
