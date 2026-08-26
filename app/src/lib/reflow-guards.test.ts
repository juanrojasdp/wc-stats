import { readFileSync, readdirSync } from "node:fs";
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

/**
 * Every `.tsx` under `src/`, as `SRC`-relative POSIX paths.
 *
 * Added by the 2.19 code review so the implicit-track scan below is repo-wide
 * rather than a nine-file allowlist. Node built-ins only, matching the rest of
 * this file — the suite must not grow a dependency to walk a directory.
 */
function tsxFiles(dir: string = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...tsxFiles(full));
    } else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      found.push(path.relative(SRC, full).split(path.sep).join("/"));
    }
  }
  return found;
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
      "R2 owner 1 (Story 2.2). The header row's min-content was 237 CSS px, so it " +
      "alone made the document scroll sideways at 195 on every route — including " +
      "/about, /glossary and /404. `flex-wrap` + `min-h-14` reflows it to two rows " +
      "instead of shrinking a 44px touch target or truncating the site name. " +
      "RE-MEASURED FOR THE NAV (Story 3.10, UX-DR24), because the row this case " +
      "was written against no longer exists: it held wordmark + search + ES|EN + " +
      "theme, and below `xl` it now holds wordmark + ONE 44px trigger. The " +
      "authorship caption had pushed the wrap threshold to es <=341 / en <=337, " +
      "so every phone wrapped; taking three elements out dropped it to es 215 / " +
      "en 211 — BELOW the 320px floor, so NO PHONE WRAPS ANY MORE. Measured in " +
      "headless Chromium against the built export (1px sweep per locale, " +
      "200-420): header 62px one-row at 320, 390 and 1280 in both locales and " +
      "both themes; 118px wrapped only at 195. Matrix 320/390/195 x dark+light x " +
      "es+en x 8 routes = 96 cells, document overflow 0/96 settled. " +
      "🔴 `flex-wrap` AND `min-h-14` BOTH STAY REGARDLESS. The wrap is what still " +
      "saves 195px, where the row genuinely cannot fit one line, and R2/D8 is not " +
      "negotiable at the zoom width just because the phone widths got easier.",
  },
  {
    file: "components/SiteHeader.tsx",
    needle: "flex min-w-0 flex-col",
    because:
      "The identity block (spec-sign-the-project): the wordmark <Link> and the " +
      "authorship caption stacked in a shrink-to-fit column. `min-w-0` lets the " +
      "block yield inside the flex row; it does NOT set the wrap threshold, " +
      "which is max-content driven. SCOPE, corrected at the 2026-08-26 code " +
      "review: this guard pins the COLUMN only. It does NOT detect the caption " +
      "moving inside the anchor -- that class string survives the move, which " +
      "was mutation-proved at the review -- so do not read it as the WCAG 2.5.3 " +
      "guard. The sibling relationship is asserted behaviourally in " +
      "components/SiteSignature.test.tsx (un-gated, both locales) and on the " +
      "exported markup in app/static-output.test.ts.",
  },
  {
    file: "components/SiteNav.tsx",
    needle: "flex min-h-11 min-w-11 items-center justify-center rounded-md",
    because:
      "Story 3.10 (UX-DR24), and it is load-bearing in TWO directions at once. " +
      "(1) SIZE: below `xl` this trigger is the ONLY control in the header row — " +
      "it replaces the search, the ES|EN toggle and the theme toggle — so it is " +
      "the single target UX-DR15's 44px (MIN_HIT_PX) has to hold, and the whole " +
      "width argument for the nav depends on it staying exactly 44 and not " +
      "growing. (2) DISPLAY: the mockup draws it `display:grid; " +
      "place-items:center; width:44px; height:44px`, and translating that " +
      "literally FAILS the repo-wide implicit-grid scan below — `min-h-11` and " +
      "`min-w-11` are not the FIXED `h-`/`w-` pair its exemption requires, so " +
      "`grid min-h-11 min-w-11 place-items-center` is an offender and the suite " +
      "goes red. The shipped `HeaderSearch` trigger form is copied instead. " +
      "Anyone reaching for `grid` here should read this case first.",
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
    /*
     * ═══ REPO-WIDE, AND IT REACHES INSIDE `cn(...)` (2.19 code review) ═══
     *
     * This case used to iterate a hard-coded nine-file list with the pattern
     * `/className=\{?"([^"]*\bgrid\b[^"]*)"/`, and so could not do the thing its
     * own message claims. Two blind spots, both already reachable:
     *
     *   1. `className={cn("grid …", x)}` never matched — the pattern wants a quote
     *      immediately after the optional `{`, and `cn(` supplies `c`.
     *      `CompareRows.tsx` is exactly that shape and is one of the six named
     *      reflow owners, so the scan was blind to a file it exists to protect.
     *   2. A tenth file was invisible by construction. "This scan is what stops a
     *      twelfth being added" was false for every file not on the list, which is
     *      most of them.
     *
     * So: every `.tsx` under `src/`, and class strings are harvested from any
     * double-quoted literal inside the `className` value — which reaches both
     * halves of `cn("a", cond && "b")`. Template-literal classNames still escape
     * it; that limit is stated rather than papered over, and nothing uses one today.
     */
    const files = tsxFiles();
    expect(
      files.length,
      "the repo-wide .tsx walk found nothing — the scan itself is broken"
    ).toBeGreaterThan(40);

    const offenders: string[] = [];
    for (const file of files) {
      for (const attribute of source(file).matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)) {
        const literals =
          attribute[1] !== undefined
            ? [attribute[1]]
            : [...(attribute[2] ?? "").matchAll(/"([^"]*)"/g)].map((match) => match[1]);
        for (const classes of literals) {
          if (!/\bgrid\b/.test(classes)) continue;
          if (/\bgrid-cols-/.test(classes)) continue;
          // Fixed-size boxes are exempt: `grid h-12 w-12 place-items-center` is a
          // crest, not a layout track. Arbitrary sizes (`h-[228px]`) count as fixed.
          const fixedHeight = /\bh-(?:\d+|\[[^\]]+\])/.test(classes);
          const fixedWidth = /\bw-(?:\d+|\[[^\]]+\])/.test(classes);
          if (fixedHeight && fixedWidth) continue;
          offenders.push(`${file}: ${classes}`);
        }
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
