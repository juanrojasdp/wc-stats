"use client";

import { formatCompareValue } from "@/lib/compare-format";
import { useLocale, useT } from "@/lib/i18n-provider";
import { leaderboardUnitKey } from "@/lib/leaderboard-format";
import { composeMetricLabel } from "@/lib/player-profile-format";
import { cn } from "@/lib/utils";
import type { CompareRow } from "@/viz/compare-model";

/*
 * ═══════════ THE MIRRORED STAT ROWS (Story 2.17, ruled D10 / D14) ═══════════
 *
 * `DESIGN.md:338` is the spec: "Entity header (name, crest placeholder, meta)
 * top-bordered 2px in its entity accent; mirrored stat rows share a centered
 * label. THE ACCENT BORDER IS THE ONLY ENTITY COLOR — no full-tinted columns."
 *
 * ═══ DOM ORDER IS label → A → B; VISUAL ORDER IS A → label → B (ruled D10) ═══
 *
 * The reading order was a genuine spec gap and is ruled here. A screen reader
 * hears "Posesión — 54 % líder — 46 %", which is the meaningful sequence
 * (WCAG 1.3.2 Meaningful Sequence); a sighted reader sees the mirrored layout.
 * The split is achieved with explicit grid-column placement, NOT with `order-*`
 * or with `flex-row-reverse`, so the DOM sequence and the focus sequence are the
 * same thing.
 *
 * Focus order is unaffected either way: a row's only focusable child is the
 * `GlossaryTerm` trigger inside the LABEL, which correctly comes first.
 *
 * 🔴 NOT A `<table>`, AND NOT ARIA TABLE ROLES. These are PAIRED SCALARS under a
 * shared label, not a grid of records: there is no column to sort, no row header
 * in the tabular sense, and `DataTable` is do-not-touch with a sort contract that
 * means nothing here. A table would also force a header row naming two "columns"
 * that are really two entities — which is precisely the full-tinted-column
 * presentation `DESIGN.md:338` bans.
 *
 * ═══════════ THE LEADER TREATMENT IS ENTIRELY REUSED (ruled D14) ═══════════
 *
 * `review-accessibility.md:26` filed this as [high], naming this surface: leading
 * values encoded "by color alone — a direct 1.4.1 fail". The fix already shipped
 * for the Hero and is reused verbatim: `resolveLeader` upstream in the model (one
 * comparator, never a second), the ▲ glyph `aria-hidden`, and an `sr-only` span
 * carrying `match.hero.leader` = «líder», WHICH ALREADY SHIPS. Ties get no marks.
 *
 * `StoryStatTiles` is deliberately NOT widened: `ProfileStatTiles` already ruled
 * why — "widening it would mean making `awayValue`, `homeCode`, `awayCode` and
 * `leader` optional on a component whose whole job is comparing two of them,
 * which is how a comparison component quietly becomes a component that sometimes
 * compares." This is the third case in that trio.
 */

/** Rendered `aria-hidden` — a const so it is never a literal JSX child (gate). */
const LEADER_GLYPH = "▲";

/**
 * 12 px, and it is the design system's only gap token that fits.
 *
 * NO COLUMN-GAP TOKEN EXISTS. `tile-gap` is nominally a tile gap; `section-gap`
 * (48) and `layer-gap` (64) are vertical rhythm and are far too wide between a
 * value and its label. Recorded rather than minted: a new spacing token is a
 * design-system change this story does not own.
 */
const ROW_GAP_CLASS = "gap-tile-gap";

/**
 * One side's header: the entity name over a 2px accent top border.
 *
 * THE BORDER IS THE ONLY ENTITY COLOUR ON THE WHOLE ROW GRID. No tinted column,
 * no tinted background, no coloured label — `DESIGN.md:338` held exactly.
 *
 * THE HEADING LEVEL IS `<h2>`, WHICH IS RULED RATHER THAN INFERRED. Route
 * Composition names it: *"Header row (`<h2>` per side, `sr-only` where the visual
 * header carries the name)"*, alongside the Statistics and Charts sections at the
 * same level.
 *
 * 🔴 THIS SHIPPED AS `<h3>` ON THE ARGUMENT THAT A SIDE HEADER MUST NOT OUTRANK
 * THE SECTIONS IT SITS ABOVE — and that argument reads the layout backwards. The
 * side headers do not CONTAIN the Statistics and Charts sections; they are the
 * comparison's own second-level blocks, siblings of those sections under the
 * route's one `<h1>`. The `<h3>` made the outline run h2 → h3 → h2, which is a
 * skipped-then-restored level, and with no `<h1>` above it (fixed in
 * `ComparePicker`) the whole document began at depth two.
 *
 * The resulting outline is deliberately FLAT — h1, then every comparison block at
 * h2 — because on a mirrored two-entity page there is no containment to express:
 * the sides and the sections are four peers, not a hierarchy.
 */
export function CompareSideHeader({
  heading,
  meta,
  side,
}: {
  heading: string;
  meta: string | null;
  side: "a" | "b";
}) {
  return (
    <div
      className={cn(
        "border-t-2 pt-3",
        side === "a" ? "border-viz-team-a" : "border-viz-team-b"
      )}
    >
      <h2 className="type-title text-ink-primary">{heading}</h2>
      {meta === null || meta === "" ? null : (
        <p className="mt-0.5 type-caption text-ink-secondary">{meta}</p>
      )}
    </div>
  );
}

/** One value cell: the number, its accent when it leads, ▲, and the sr-only word. */
function ValueCell({
  value,
  leads,
  side,
  leaderLabel,
}: {
  value: string;
  leads: boolean;
  side: "a" | "b";
  leaderLabel: string;
}) {
  const accent = side === "a" ? "text-viz-team-a" : "text-viz-team-b";
  return (
    <span
      className={cn(
        /*
         * `tabular-nums` IS MANDATORY IN COMPARISON COLUMNS (`DESIGN.md:301`).
         * Without it the two sides' digits do not align down the grid and the
         * eye cannot scan the pairs, which is the entire job of this layout.
         */
        "type-stat-value tabular-nums",
        leads ? accent : "text-ink-primary"
      )}
    >
      {leads ? (
        // type-caption (12px) rather than the value's own size — the glyph is an
        // annotation on the number, not part of it.
        <span aria-hidden="true" className="mr-0.5 align-top type-caption">
          {LEADER_GLYPH}
        </span>
      ) : null}
      {value}
      {leads ? <span className="sr-only">{leaderLabel}</span> : null}
    </span>
  );
}

/**
 * The mirrored rows for one comparison (or, for `type=matches`, for one side's
 * own home/away block — see `matchCompareRows`).
 *
 * EVERY VALUE IS THE ARTIFACT'S OWN NUMBER, formatted and nothing else (AR-5).
 * There is no difference column, no ratio, no combined total and no "+3 more"
 * anywhere in this component — the only thing it adds to a row is the accent, the
 * glyph and the word, all of which are the leader determination AD-5 licenses by
 * name.
 */
/**
 * The two column heads, when the pair needs naming. Code review 2026-08-07, D2a.
 *
 * 🔴 `type=matches` IS THE CASE THIS EXISTS FOR, AND WITHOUT IT THE BLOCK IS
 * UNREADABLE. For `players` and `teams` the two columns are named by the
 * `CompareSideHeader` directly above them, so heads would be a second home for one
 * name and are correctly absent. For `matches` those headers name the two MATCHES,
 * not the four team-innings the rows actually pair — so nineteen rows of
 * "Posesión — 57,1% — 36,1%" carried nothing at all naming México or Sudáfrica,
 * while the chart's own data table beneath them did carry the codes.
 *
 * IT ALSO RESOLVES THE ACCENT COLLISION, which is why it is one patch and not two.
 * Inside a match block `viz-team-a` means HOME and `viz-team-b` means AWAY (D5's
 * corollary, `DESIGN.md:260`'s "one color means one thing per visualization") —
 * but side B's block paints those accents under a `viz-team-b` side-header border,
 * so on side B the same colour carried two meanings twenty pixels apart with
 * nothing on screen to disambiguate them. Naming the heads IN THEIR OWN ACCENTS
 * states the local meaning where the reader meets it, which is exactly how the
 * charts already discharge the same corollary.
 */
function ColumnHeads({ heads }: { heads: { a: string; b: string } }) {
  return (
    <div
      className={cn(
        // One column below 304 CSS px — see the row below it (Task 6.2).
        "grid grid-cols-1 items-baseline px-3 min-[19rem]:grid-cols-2 md:grid-cols-[1fr_auto_1fr]",
        ROW_GAP_CLASS
      )}
    >
      {/* DOM order matches the rows below it exactly: label slot, A, B. */}
      <div className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1" />
      <div className="type-label-caps text-viz-team-a md:col-start-1 md:row-start-1 md:text-right">
        {heads.a}
      </div>
      <div className="type-label-caps text-right text-viz-team-b md:col-start-3 md:row-start-1 md:text-left">
        {heads.b}
      </div>
    </div>
  );
}

export function CompareStatRows({
  rows,
  heads = null,
}: {
  rows: readonly CompareRow[];
  /** Column heads naming the pair, or `null` when the side header already does. */
  heads?: { a: string; b: string } | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const leaderLabel = t("match.hero.leader");

  return (
    <div className="mt-tile-gap flex flex-col gap-2">
      {heads === null ? null : <ColumnHeads heads={heads} />}
      {rows.map((row) => {
        /*
         * `== null`, NOT `=== null`. `row.unit` is typed `LeaderboardUnit | null`,
         * but it arrives from a model that reads a metric code off an artifact —
         * an out-of-union code yields `undefined`, which `=== null` waves through
         * into `leaderboardUnitKey` to build `enums.unit.undefined` and render a
         * raw key beside the number. One character covers both empty cases.
         */
        const unitKey = row.unit == null ? null : leaderboardUnitKey(row.unit);
        const label = composeMetricLabel(
          t(row.labelKey),
          unitKey === null ? null : t(unitKey)
        );
        /*
         * 🔴 NO GLOSSARY MARKING ON THESE LABELS, AND THAT IS A RULING RATHER
         * THAN AN OVERSIGHT (UX-DR20). Marking is governed by the PER-TERM POLICY
         * TABLE, which assigns terms to surfaces one row at a time — 2.16 spent a
         * whole decision establishing that its tile label was "the ONLY safe host
         * on this route", and no row of that table names `/compare`. There is
         * also no key→`GlossaryTermId` map anywhere in the codebase: every
         * shipped mark names its `termId` at the call site, and the labels here
         * are BUILT (`leaderboardMetricKey`, `hub.standings.columnTitle.*`,
         * `enums.metric.*`), so marking them would mean minting that map and
         * ruling nineteen new policy rows this story does not own.
         *
         * 2.5 decision 8 makes the cost of guessing explicit: "a dotted underline
         * with no popover behind it is a broken promise." Filed, not faked.
         */
        return (
          <div
            key={row.key}
            className={cn(
              /*
               * TWO COLUMNS BELOW `md` WITH THE LABEL SPANNING BOTH, three at and
               * above it. The label stays FIRST IN THE DOM either way, so nothing
               * about the announcement changes across the breakpoint — only where
               * the label is painted does.
               */
              /*
               * ONE column below 304 CSS px (Story 2.19 Task 6.2): at a 195 px
               * viewport each of the two tracks is ~78 px and a
               * `type-stat-value` figure measures up to 109, which pushed
               * `/compare` to a document scrollWidth of 213. Stacking label, A
               * and B is the same DOM in the same order — only where they are
               * painted changes, exactly as the `md:` step already does.
               */
              "grid grid-cols-1 items-baseline rounded-md bg-surface-raised px-3 py-2 min-[19rem]:grid-cols-2 md:grid-cols-[1fr_auto_1fr]",
              ROW_GAP_CLASS
            )}
          >
            {/* DOM position 1. Painted in the MIDDLE column at ≥md. */}
            <div className="col-span-2 type-stat-label text-ink-secondary md:col-span-1 md:col-start-2 md:row-start-1 md:text-center">
              {label}
            </div>
            {/* DOM position 2 — side A. Painted in the FIRST column at ≥md. */}
            <div className="md:col-start-1 md:row-start-1 md:text-right">
              <ValueCell
                value={formatCompareValue(row.a, row.format, locale)}
                leads={row.leader === "home"}
                side="a"
                leaderLabel={leaderLabel}
              />
            </div>
            {/* DOM position 3 — side B. Painted in the THIRD column at ≥md. */}
            <div className="text-right md:col-start-3 md:row-start-1 md:text-left">
              <ValueCell
                value={formatCompareValue(row.b, row.format, locale)}
                leads={row.leader === "away"}
                side="b"
                leaderLabel={leaderLabel}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
