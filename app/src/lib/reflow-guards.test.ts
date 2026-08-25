import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/*
 * ═════════ THE REFLOW GUARDS — Story 2.19 R2 / D8 / D9, Task 6.2-6.3 ═════════
 *
 * WCAG 2.1 AA 1.4.10 at a 195 CSS px layout viewport — a 390 px device at 200%
 * zoom — was failing on ALL EIGHT ROUTES, including `/about`, `/glossary` and
 * `/404`, which contain nothing but chrome. The measured document scrollWidths
 * before the fix were 237 (the universal floor, `SiteHeader`), 295 (`/`), 278
 * (`/matches/{slug}`), 237 (`/players`, `/teams`, `/compare`). After it, all
 * sixteen locale x route cells report a document scrollWidth of exactly 195,
 * and 320 and 390 hold with EVERY disclosure open in both locales.
 *
 * WHY A SOURCE-LEVEL GUARD AND NOT A RENDER TEST. Every number above is a
 * LAYOUT fact and jsdom implements no layout, so no test in this suite can
 * measure it — the matrix is produced by the CDP harness against the served
 * export and lives in the story's Dev Agent Record. What this file can do is
 * make the fix impossible to delete SILENTLY: each assertion below names one
 * class, the owner it belongs to, and the pixels it was worth. A change that
 * removes one fails here with the reason attached, and whoever removes it
 * deliberately updates this file and re-runs the matrix.
 *
 * D8 IS THE POINT: "the three surfaces move in ONE change. Do not land a
 * partial fix; a tree where only one is narrowed still overflows and reads as
 * done." The measurement found SIX owners rather than three, and all six are
 * pinned here together for exactly that reason.
 */

const SRC = path.join(process.cwd(), "src");

function source(relative: string): string {
  return readFileSync(path.join(SRC, relative), "utf8");
}

interface Guard {
  /** Where the fix lives. */
  file: string;
  /** The exact class string that carries it. */
  needle: string;
  /** Which owner, and what the measurement said. */
  because: string;
}

const GUARDS: Guard[] = [
  {
    file: "components/SiteHeader.tsx",
    needle: "flex min-h-14 max-w-6xl flex-wrap items-center",
    because:
      "R2 owner 1 (Story 2.2). The header row's min-content is 237 CSS px, so it " +
      "alone made the document scroll sideways at 195 on every route — including " +
      "/about, /glossary and /404. `flex-wrap` + `min-h-14` reflows it to two rows " +
      "instead of shrinking a 44px touch target or truncating the site name; the " +
      "row height is unchanged at 320, 390, 412, 768, 1440 and 1920.",
  },
  {
    file: "components/MatchHero.tsx",
    needle: "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
    because:
      "R2 owner 2 (Story 2.4), the Hero score row. A bare `1fr` is " +
      "`minmax(auto, 1fr)`, so each team column was floored by its own min-content " +
      "— a 48px crest beside a team name — and the row could not narrow past ~230. " +
      "The `auto` centre column is deliberate: the scoreline must never shrink.",
  },
  {
    file: "components/KeyStatisticsSection.tsx",
    needle: "grid-cols-[minmax(0,76px)_minmax(0,1fr)_minmax(0,76px)]",
    because:
      "R2 owner 3 (Story 2.5). A tile's min-content was 247px — two FIXED 76px " +
      "value tracks plus px-4 plus the label. R2 asks for a documented " +
      "narrow-width track change in preference to a type-ramp departure, and this " +
      "is it: identical at every width with room for 76px, yielding below it. " +
      "`type-stat-value` keeps its 26px DESIGN size and UX-DR2's 11px floor holds.",
  },
  {
    file: "components/StoryStatTiles.tsx",
    needle: "grid grid-cols-1 gap-tile-gap min-[19rem]:grid-cols-2",
    because:
      "Owner 4, which R2 did not name and the matrix found. Two fixed columns of " +
      "a Hero stat tile cannot fit 195px. 19rem sits below the 320px floor AC 3 " +
      "names, so the two-column arrival state is unchanged at every shipped width.",
  },
  {
    file: "components/LeaderboardsSection.tsx",
    needle: "grid grid-cols-1 gap-tile-gap sm:grid-cols-2 lg:grid-cols-3",
    because:
      "Owner 5, the worst cell in the matrix (`/` at doc 295). With no " +
      "`grid-template-columns` below `sm` the cards landed in an IMPLICIT auto " +
      "track, which is floored by the card's max-content rather than clamped to " +
      "the container: a 163px container resolved a 278.5px track.",
  },
  {
    file: "components/LeaderboardsSection.tsx",
    needle: "mt-2 grid grid-cols-1 gap-1",
    because:
      "The same implicit-track defect one level down, inside the teaser card's " +
      "<ol>. Fixing only the outer grid left `/` at 278 — which is precisely the " +
      "partial fix D8 forbids.",
  },
  {
    file: "components/CompareRows.tsx",
    needle: "grid grid-cols-1 items-baseline rounded-md bg-surface-raised px-3 py-2 min-[19rem]:grid-cols-2",
    because:
      "Owner 6 (`/compare` at doc 213). At 195 each of the two tracks is ~78px " +
      "and a `type-stat-value` figure measures up to 109. Stacking label, A and B " +
      "is the same DOM in the same order — only where they are painted changes, " +
      "exactly as the `md:` step already does.",
  },
  {
    file: "components/ExpertLayer.tsx",
    needle: "mb-tile-gap flex-wrap rounded-full border border-hairline p-0.5",
    because:
      "D9, and a TRUE 320px failure distinct from R2's 195px question: the " +
      "five-segment column-group ToggleGroup measured 339 against a 305px content " +
      "box at 320 in BOTH locales, and 412 against 375 at 390 in EN.",
  },
  {
    file: "components/TrendsSection.tsx",
    needle: "min-h-11 max-w-full min-w-11 whitespace-normal",
    because:
      "The last cell to fall. The vendored Toggle base carries `whitespace-nowrap` " +
      "and `shrink-0`, so the ES label “Progresiones de balón” held " +
      "`/players/{slug}` at a 218px document width even with the group wrapping. " +
      "`whitespace-normal` lets it wrap; `max-w-full` caps the box that `shrink-0` " +
      "would otherwise keep at max-content.",
  },
];

describe("reflow guards (AC 3, WCAG 1.4.10) — R2/D8's one change, pinned", () => {
  for (const guard of GUARDS) {
    it(`${guard.file} keeps "${guard.needle}"`, () => {
      const text = source(guard.file);
      expect(
        text.includes(guard.needle),
        `${guard.file} no longer contains "${guard.needle}".\n\n${guard.because}\n\n` +
          "If this is deliberate, re-run the reflow matrix (320/390/195 x dark/light x " +
          "es/en x 8 routes) against the served export and update this guard with the " +
          "new numbers. Do not simply delete the case."
      ).toBe(true);
    });
  }

  it("keeps every single-column grid CLAMPED — the systemic half of the fix", () => {
    /*
     * `grid` with no `grid-template-columns` puts children in an IMPLICIT auto
     * track that is sized by their max-content and NOT clamped to the container.
     * Two of the six owners were this exact defect, and the app had eleven more
     * instances of the shape. This scan is what stops a twelfth being added.
     *
     * Fixed-size boxes are exempt: `grid h-12 w-12 place-items-center` is a
     * crest, not a layout track.
     */
    const files = [
      "components/CompareRegion.tsx",
      "components/LeaderboardsRegion.tsx",
      "components/LeaderboardsSection.tsx",
      "components/LineupsDisclosure.tsx",
      "components/MatchBundleRegion.tsx",
      "components/PlayerProfileRegion.tsx",
      "components/TeamProfileRegion.tsx",
      "components/TournamentHub.tsx",
      "components/TournamentHubRegion.tsx",
    ];
    const offenders: string[] = [];
    for (const file of files) {
      for (const match of source(file).matchAll(/className=\{?"([^"]*\bgrid\b[^"]*)"/g)) {
        const classes = match[1];
        if (/\bgrid-cols-/.test(classes)) continue;
        if (/\bh-\d+\b/.test(classes) && /\bw-\d+\b/.test(classes)) continue;
        offenders.push(`${file}: ${classes}`);
      }
    }
    expect(
      offenders,
      "A `grid` container with no `grid-cols-*` was added. Its implicit track is " +
        "sized by content, not clamped to the container, and it will overflow the " +
        "document at a narrow layout viewport. Add `grid-cols-1`."
    ).toEqual([]);
  });
});
