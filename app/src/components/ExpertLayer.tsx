"use client";

import { useEffect, useRef, useState } from "react";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MatchBundle } from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import {
  FIELD_UNIT,
  IN_POSSESSION_COLUMNS,
  OUT_OF_POSSESSION_FIELDS,
  PHYSICAL_FIELDS,
  buildExpertRows,
  expertFieldKey,
  expertFieldTitleKey,
  type ExpertField,
  type ExpertRow,
  type FieldUnit,
} from "@/viz/expert-model";
import { OFFER_MOVEMENT_PROPERTY, offerMovementKey } from "@/viz/receiving-model";

/*
 * THE EXPERT LAYER (Story 2.11b, FR-23 / UJ-2 / SM-C2). Every Domain G field
 * the bundle carries, per player, both teams — 50 rendered columns over up to
 * 34 rows, with no "lite" variant.
 *
 * A SIBLING OF THE TACTICAL LAYER, NEVER A TWELFTH SectionId (ruled decision
 * 2). `lib/tactical-sections.ts` is untouched: `SectionId` is a closed union of
 * eleven, `sectionDataState`'s default branch carries a `never` exhaustiveness
 * check, and tactical-sections.test.ts already asserts that
 * `sectionDataState(m001, "expert" as SectionId)` THROWS — it literally uses
 * "expert" as its out-of-union id. `TacticalSection` cannot be reused for the
 * same reason (its `id` prop is typed `SectionId`), so the focus/nonce contract
 * below is COPIED from it rather than imported, deliberately.
 *
 * COLLAPSED BY DEFAULT AT EVERY WIDTH (UX-DR6, EXPERIENCE.md:72) — there is no
 * `isLg` branch here, unlike the Tactical Layer, and the content lazy-mounts on
 * expand. That is also the whole performance defence for ~1,700 cells: none of
 * it renders on first load. No skeleton and no `next/dynamic` (decision 15).
 */

/** aria-hidden glyph — a module const, never a bare JSX literal (i18n gate). */
const CHEVRON = "▸";
/** Composed into the head text, so the unit never rides the label (AD-7). */
const UNIT_OPEN = " (";
const UNIT_CLOSE = ")";

const SECTION_ID = "expert";
const HEADING_ID = "expert-heading";
const CONTENT_ID = "expert-content";
const SUMMARY_ID = "expert-summary";
const EXPERT_HASH = "#expert";

/** The three column groups, in the order the `<md` tabs present them. */
type ColumnGroup = "inPossession" | "outOfPossession" | "physical";

const GROUP_ORDER: readonly ColumnGroup[] = ["inPossession", "outOfPossession", "physical"];

const GROUP_LABEL_KEY: Record<ColumnGroup, DictionaryKey> = {
  inPossession: "expert.group.inPossession",
  outOfPossession: "expert.group.outOfPossession",
  physical: "expert.group.physical",
};

/*
 * THE STICKY COLUMN RUN (ruled decision 5): team + shirt + player, in that
 * order and as a LEFTMOST RUN — sticking `player` alone while `team` and
 * `shirt` scroll underneath it is simply broken. `position` scrolls with the
 * data.
 *
 * Each column needs an EXPLICIT `left`, because a sticky run cannot compute one
 * from its neighbours' class strings. The offsets are the running sum of the
 * widths above them: 0 → 3.5rem → 3.5 + 2.75 = 6.25rem.
 *
 * THE FILL MUST BE OPAQUE. `bg-surface-raised` is the surface these tables sit
 * on; without it the scrolled columns show straight through the sticky ones.
 *
 * `headClass: z-30` is the top of the ladder (Task 1.4): body sticky cells sit
 * at z-10, header cells at z-20, and the CORNER cells — header AND sticky
 * column — must beat both or the body's sticky cells paint over them on a
 * diagonal scroll, because equal z-index resolves to later-in-DOM and <tbody>
 * is later than <thead>. `bg-surface-overlay` is repeated here because
 * tailwind-merge resolves the fill to the LAST class that sets it, and
 * `cellClass`'s --surface-raised would otherwise win in the corner.
 */
/*
 * MEASURED DEPARTURE from the story's ruled widths (3.5 / 2.75 / 6.25rem),
 * taken because those numbers do not survive contact with the layout and their
 * failure is SILENT — the columns still stick, at the wrong offsets.
 *
 * A `left` offset is absolute, but under AUTO table layout `width` on a cell is
 * only a SUGGESTION — the algorithm is free to land on the column's max-content
 * instead, in EITHER direction. Measured in Chrome at the shipped type scale,
 * the three heads want 79 / 82 / 141px: at the story's widths the run rendered
 * 161px wide while `player` was pinned at 100px (each sticky column overlapping
 * and clipping the head before it), and at widths chosen to clear them, `w-88`
 * still rendered 82 and opened a 6px gap for scrolled data to slide through.
 *
 * `min-width` DOES bind on a table cell in Chrome (verified: a cell whose
 * max-content is 82px renders at exactly 88px under min-w-[5.5rem]), so the run
 * is declared with `min-w-*` and every value clears the widest of the two
 * locales' head text. That is what makes declared == used, and the offsets
 * exact: 0 -> 5.5rem -> 11rem with the team column, 0 -> 5.5rem without it.
 *
 * The 141px was the `player` column and had a second cause worth naming:
 * `truncate` includes `white-space: nowrap`, which makes a cell's min-content
 * the WHOLE name — so inside a table it does not truncate at all, it WIDENS the
 * column. Truncation has to happen in a fixed-width block INSIDE the cell,
 * hence PLAYER_TRUNCATE. Its width is the cell's minus `px-2`, because Tailwind
 * preflight sets `box-sizing: border-box`: 6rem + 0.5rem = 7rem.
 *
 * THE OFFSETS ARE PER-LAYOUT, not responsive variants of one class: below md
 * the `team` column is not rendered at all (see the escape hatch), so `shirt`
 * becomes the leftmost column and must pin at 0, not at 5.5rem. A `md:left-*`
 * pair would be wrong in exactly the half of the story that needs it most.
 */
const STICKY_CORNER = "z-30 bg-surface-overlay";
const STICKY_TEAM = "sticky left-0 z-10 min-w-[5.5rem] bg-surface-raised";
const STICKY_SHIRT_WIDE = "sticky left-[5.5rem] z-10 min-w-[5.5rem] bg-surface-raised";
const STICKY_SHIRT_NARROW = "sticky left-0 z-10 min-w-[5.5rem] bg-surface-raised";
const STICKY_PLAYER_WIDE = "sticky left-[11rem] z-10 min-w-[12rem] bg-surface-raised";
const STICKY_PLAYER_NARROW = "sticky left-[5.5rem] z-10 min-w-[7rem] bg-surface-raised";
const PLAYER_TRUNCATE_WIDE = "block w-[11rem] truncate";
const PLAYER_TRUNCATE_NARROW = "block w-[6rem] truncate";

export function ExpertLayer({ bundle }: { bundle: MatchBundle }) {
  /*
   * TAKES THE WHOLE BUNDLE — a DECLARED EXCEPTION to the house rule that props
   * are narrow and explicit (Story 2.5 Task 5.1), stated here as decision 14
   * requires. It genuinely needs `players` AND `metadata`: Domain G's
   * `PlayerRecord` carries a `teamId` and no team code, so the code every row
   * displays can only come from the metadata's two TeamRefs. (Story 2.11c adds
   * the five `events` slices to the same prop.)
   */
  const t = useT();
  const { locale } = useLocale();
  const isMd = useMediaQuery(MD_MEDIA_QUERY);

  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<ColumnGroup>("inPossession");
  /** Increments when focus should move to the heading; 0 = never (mount). */
  const [focusNonce, setFocusNonce] = useState(0);
  const [focusScroll, setFocusScroll] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /*
   * ITS OWN HASH LISTENER. `TacticalLayer`'s `sectionIdFromHash` returns null
   * for "#expert" BY DESIGN — do not extend it; that function is keyed on the
   * eleven-member registry this layer is deliberately not in.
   *
   * The MOUNT-TIME READ is load-bearing, not belt-and-braces: this layer is
   * client-only under AR-11 and mounts inside MatchBundleRegion's loaded
   * branch, so the browser has already abandoned a "#expert" deep link by the
   * time the target exists. The subscription then serves in-page anchor
   * navigation.
   */
  useEffect(() => {
    function openFromHash() {
      if (window.location.hash !== EXPERT_HASH) {
        return;
      }
      setOpen(true);
      setFocusScroll(true);
      setFocusNonce((previous) => previous + 1);
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  /*
   * Copied from TacticalSection.tsx:86-97 rather than imported (decision 2).
   * Driven by an explicit nonce rather than by `open`, so it fires on a user
   * toggle and on anchor auto-expand and NEVER on the initial render.
   * `preventScroll` only when scrollIntoView already positioned the section —
   * the browser's own focus scroll would otherwise pull the heading off the top
   * of the viewport.
   */
  useEffect(() => {
    if (focusNonce === 0) {
      return;
    }
    if (focusScroll) {
      sectionRef.current?.scrollIntoView();
    }
    headingRef.current?.focus({ preventScroll: focusScroll });
  }, [focusNonce, focusScroll]);

  function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      // Focus moves into what was revealed; closing leaves it on the trigger.
      setFocusScroll(false);
      setFocusNonce((previous) => previous + 1);
    }
  }

  /*
   * ROWS ARE BUILT EAGERLY, outside the lazily-mounted content
   * (ShotMapsSection's precedent): a player whose teamId matches neither side
   * throws from `resolveSide` NAMING the id, on load rather than on expand, and
   * the sibling TacticalErrorBoundary contains it. A silent drop is the class
   * of finding prior reviews flagged on groupScorers and composeMatchTitle.
   */
  const rows = buildExpertRows(bundle);

  function formatValue(value: number, unit: FieldUnit): string {
    /*
     * Driven off the FIELD LISTS, never off inspection: Count, Percentage,
     * Metres and KmPerHour all erase to `number`, so the compiler cannot catch
     * a mix-up here and nothing on screen would look wrong.
     *
     * The two percentages are STORED and rendered as stored (AD-5) — never
     * recomputed from attempted/completed.
     */
    if (unit === "percentage") {
      return formatPercent(value, locale, 1);
    }
    if (unit === "count") {
      return formatInteger(value, locale);
    }
    return formatDecimal(value, locale, 1);
  }

  function unitSuffix(unit: FieldUnit): string {
    if (unit === "metres") {
      return `${UNIT_OPEN}${t("enums.unit.m")}${UNIT_CLOSE}`;
    }
    if (unit === "kmh") {
      return `${UNIT_OPEN}${t("enums.unit.kmh")}${UNIT_CLOSE}`;
    }
    return "";
  }

  /** One keyed Domain G column. The unit rides the HEAD, never the cell. */
  function dataColumn(field: ExpertField, read: (row: ExpertRow) => number): TableColumn<ExpertRow> {
    const unit = FIELD_UNIT[field];
    const titleKey = expertFieldTitleKey(field);
    return {
      key: field,
      headText: `${t(expertFieldKey(field))}${unitSuffix(unit)}`,
      headTitle: titleKey === null ? null : t(titleKey),
      /*
       * NO PRESENCE GATE AND NO EM DASH, ever. Domain G has zero nullable
       * leaves — not one `?` or `| null` inside PlayerRecord or its sub-blocks
       * — so absence is unreachable here by construction and a zero is a real,
       * dense measurement (`goals` is 0 on 90 of 96 fixture rows). Print it.
       */
      render: (row) => formatValue(read(row), unit),
      align: "numeric",
      // The RAW numeric, never the formatted string: "1.234" collates before
      // "9" and a thousands separator would make the order nonsense.
      sort: { kind: "number", valueOf: read },
    };
  }

  /**
   * One of the six `offersByMovementType` columns. They reuse the shipped
   * `enums.offerMovement` labels through `OFFER_MOVEMENT_PROPERTY` rather than
   * minting a seventh set — i18n.test.ts pins that namespace's key set to
   * `OFFER_MOVEMENT_TYPES` exactly, so a duplicate here would turn it red.
   */
  function movementColumn(code: Parameters<typeof offerMovementKey>[0]): TableColumn<ExpertRow> {
    const property = OFFER_MOVEMENT_PROPERTY[code];
    const read = (row: ExpertRow) => row.inPossession.offersByMovementType[property];
    return {
      key: `movement-${code}`,
      headText: t(offerMovementKey(code)),
      headTitle: null,
      render: (row) => formatInteger(read(row), locale),
      align: "numeric",
      sort: { kind: "number", valueOf: read },
    };
  }

  /*
   * THE `<md` ESCAPE HATCH — TAKEN, on the measurement Task 5.4 demanded
   * rather than pre-emptively.
   *
   * MEASURED at a 390px viewport: the scrollport is 345px and the three-column
   * sticky run renders 289px of it (79 + 82 + 128), leaving 55.7px — LESS THAN
   * ONE data column, since the Spanish heads run 102-126px wide. The table
   * would open showing identity columns and no data at all until the reader
   * scrolled sideways.
   *
   * So below md the `team` COLUMN is replaced by a team SELECTOR (the exact
   * PitchPanel precedent), which returns ~88px and filters the rows to one
   * side: run 200px, ~145px of data, one full column visible on open. Density
   * moves behind a control, never deleted (SM-C2) — every field and every
   * player stays reachable, and at >=md nothing changes: all 34 rows, all 50
   * columns, one table.
   */
  const sideCodes = [
    bundle.metadata.homeTeam.teamCode.toUpperCase(),
    bundle.metadata.awayTeam.teamCode.toUpperCase(),
  ];
  const [side, setSide] = useState(sideCodes[0]);
  const visibleRows = isMd ? rows : rows.filter((row) => row.teamCode === side);

  const teamColumn: TableColumn<ExpertRow> = {
    key: "team",
    headText: t("viz.table.team"),
    headTitle: null,
    // The resolved team CODE, uppercased by the model — never a translated
    // team name, which would not fit the run and is not what the row is keyed
    // on.
    render: (row) => row.teamCode,
    align: "text",
    sort: { kind: "text", valueOf: (row) => row.teamCode },
    cellClass: STICKY_TEAM,
    headClass: STICKY_CORNER,
  };

  const identityColumns: TableColumn<ExpertRow>[] = [
    // Below md the rows are one team's already, so the column would repeat the
    // selector's answer on all 17 of them.
    ...(isMd ? [teamColumn] : []),
    {
      key: "shirt",
      headText: t("viz.table.shirt"),
      headTitle: null,
      render: (row) => formatInteger(row.shirtNumber, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.shirtNumber },
      cellClass: isMd ? STICKY_SHIRT_WIDE : STICKY_SHIRT_NARROW,
      headClass: STICKY_CORNER,
    },
    {
      key: "player",
      headText: t("viz.table.player"),
      headTitle: null,
      /*
       * `title` carries the full name for the truncated `<md` case. It is a
       * GATED prop name, but `row.playerName` is a VARIABLE — the gate bans
       * literals and template literals, so this passes it honestly.
       *
       * Plain text, never a link (decision 12): UX-DR22's cross-link rule is
       * scoped to LINEUP names, and /players/{slug} ships in Story 2.15.
       */
      render: (row) => (
        <span
          title={row.playerName}
          className={isMd ? PLAYER_TRUNCATE_WIDE : PLAYER_TRUNCATE_NARROW}
        >
          {row.playerName}
        </span>
      ),
      align: "text",
      // The one <th scope="row"> per row — this makes 2.11b the first consumer
      // of `rowHeader`, which shipped in 2.11a without one.
      rowHeader: true,
      sort: { kind: "text", valueOf: (row) => row.playerName },
      cellClass: isMd ? STICKY_PLAYER_WIDE : STICKY_PLAYER_NARROW,
      headClass: STICKY_CORNER,
    },
    {
      key: "position",
      headText: t("viz.table.position"),
      headTitle: null,
      // A template literal into t(), no cast needed (LineupsDisclosure's
      // precedent) — `Position` is a four-member union, so tsc checks it.
      render: (row) => t(`enums.position.${row.position}`),
      align: "text",
      // The RESOLVED label, so the order follows the EN toggle.
      sort: { kind: "text", valueOf: (row) => t(`enums.position.${row.position}`) },
    },
  ];

  const groupColumns: Record<ColumnGroup, TableColumn<ExpertRow>[]> = {
    inPossession: IN_POSSESSION_COLUMNS.map((column) =>
      column.kind === "movement"
        ? movementColumn(column.code)
        : dataColumn(column.field, (row) => row.inPossession[column.field])
    ),
    outOfPossession: OUT_OF_POSSESSION_FIELDS.map((field) =>
      dataColumn(field, (row) => row.outOfPossession[field])
    ),
    physical: PHYSICAL_FIELDS.map((field) => dataColumn(field, (row) => row.physical[field])),
  };

  /*
   * ONE <DataTable> INSTANCE serves both layouts (EXPERIENCE.md:133). At >=md
   * all three groups are concatenated — 46 data + 4 identity = 50 columns, with
   * horizontal scroll inside the container; below md the ToggleGroup selects
   * one group (16 / 15 / 9). Rows are always every player of both teams.
   */
  const dataColumns = isMd
    ? [...groupColumns.inPossession, ...groupColumns.outOfPossession, ...groupColumns.physical]
    : groupColumns[group];
  const columns = [...identityColumns, ...dataColumns];

  /*
   * `players: null` is the report-does-not-carry-Domain-G state (decision 10).
   * `[]` is NOT this state — it is ready, with zero rows.
   *
   * Both halves are HOISTED TO PLAIN IDENTIFIERS: a ternary inside `headline=`
   * or `explanation=` trips the i18n gate, which reaches into conditional
   * expressions inside a gated prop (TacticalLayer.tsx records this).
   */
  const isAbsent = bundle.players === null;
  const emptyHeadline = t("expert.empty.headline");
  const emptyExplanation = t("expert.empty.explanation");

  return (
    <section
      ref={sectionRef}
      id={SECTION_ID}
      aria-labelledby={HEADING_ID}
      className="mt-layer-gap border-t border-hairline pt-5"
    >
      {/*
       * The EXPERTO pill sits ABOVE the heading row, not inline — the mockup's
       * `.pill-expert` is a block-level lead-in with its own 10px gap.
       * --ink-secondary on --surface-overlay measures 7.03 dark / 6.65 light.
       */}
      <span className="mb-2.5 inline-block rounded-full bg-surface-overlay px-3 py-1 type-label-caps text-ink-secondary">
        {t("expert.pill")}
      </span>
      <h2 ref={headingRef} id={HEADING_ID} tabIndex={-1} className="type-headline text-ink-primary">
        {/*
         * A real <button>, not the mockup's `role="button"` <div> — the same
         * ruled departure TacticalSection records (its decision 6). min-h-11
         * is on the trigger ITSELF, not a wrapper.
         *
         * aria-controls is CONDITIONAL because the content lazy-mounts: a
         * static one would point at an absent id in the collapsed state, which
         * is the default at every width here.
         */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? CONTENT_ID : undefined}
          aria-describedby={SUMMARY_ID}
          onClick={toggle}
          className="flex min-h-11 w-full items-center justify-between gap-tile-gap text-left"
        >
          {t("expert.heading")}
          <span
            aria-hidden="true"
            className={cn("type-body text-ink-secondary", open && "rotate-90")}
          >
            {CHEVRON}
          </span>
        </button>
      </h2>
      {/* A <div>, never a <p>: Story 2.18's nesting ruling on the same slot. */}
      <div id={SUMMARY_ID} className="mt-1 type-body text-ink-secondary">
        {t("expert.summary")}
      </div>

      {open ? (
        <div id={CONTENT_ID} className="mt-4">
          {isAbsent ? (
            <EmptyStatePanel headline={emptyHeadline} explanation={emptyExplanation} />
          ) : (
            <>
              {isMd ? null : (
                <ToggleGroup
                  type="single"
                  value={side}
                  onValueChange={(value) => {
                    // Radix reports "" when the active segment is re-clicked;
                    // the active team must not be deselectable.
                    if (value !== "") {
                      setSide(value);
                    }
                  }}
                  aria-label={t("viz.teamSelector")}
                  className="mb-tile-gap rounded-full border border-hairline p-0.5"
                >
                  {sideCodes.map((code) => (
                    <ToggleGroupItem
                      key={code}
                      value={code}
                      className="min-h-11 min-w-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
                    >
                      {code}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
              {isMd ? null : (
                <ToggleGroup
                  type="single"
                  value={group}
                  onValueChange={(value) => {
                    // Radix reports "" when the active segment is re-clicked;
                    // the active group must not be deselectable.
                    if (value !== "") {
                      setGroup(value as ColumnGroup);
                    }
                  }}
                  aria-label={t("expert.group.label")}
                  className="mb-tile-gap rounded-full border border-hairline p-0.5"
                >
                  {GROUP_ORDER.map((candidate) => (
                    <ToggleGroupItem
                      key={candidate}
                      value={candidate}
                      className="min-h-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
                    >
                      {t(GROUP_LABEL_KEY[candidate])}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
              {/*
               * THE BOUNDED SCROLLPORT, and the reason AC 2 is reachable at
               * all. `DataTable` renders no scroll container and must not: the
               * sticky header resolves against its NEAREST SCROLLING ANCESTOR,
               * and 2.11a's declared departure was precisely a sticky rule
               * inside a height-UNBOUNDED ancestor, which computed correctly
               * and silently did nothing.
               *
               * `scroll-pt-11` is UX-DR12's scroll-padding-top: 44px, equal to
               * the sticky header's own MIN_HIT_PX floor, so a row focused by
               * keyboard is never scrolled under the header.
               *
               * These tables are PRIMARY content and deliberately NOT behind a
               * "Ver los datos" disclosure (decision 9) — the layer is already
               * collapsed by default, and a disclosure would put them two taps
               * deep.
               */}
              <div className="max-h-[70vh] overflow-auto scroll-pt-11">
                <DataTable
                  caption={t("expert.tableCaption")}
                  columns={columns}
                  rows={visibleRows}
                  // The card, never the pitch. Getting this backwards is the
                  // defect Story 2.7's review headlined.
                  surface="canvas"
                  sticky
                  tableName={t("expert.tableName")}
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
