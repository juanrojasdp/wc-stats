"use client";

import { useLayoutEffect, useRef, useState, type FocusEvent as ReactFocusEvent } from "react";

import { useSortAnnounce } from "@/components/SortAnnouncer";
import { useT } from "@/lib/i18n-provider";
import {
  ariaSortFor,
  nextSortState,
  sortRows,
  type SortState,
  type TableColumn,
} from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import { MIN_HIT_PX } from "@/viz/marker-layout";

/*
 * THE ONE sortable data table (Story 2.11a, UX-DR12). Ten components carried a
 * byte-near-identical private copy of this and twenty instances rendered plain;
 * all twenty now come through here and every private copy is deleted.
 *
 * It lives in src/components/, NOT src/components/ui/ — that directory is
 * vendored shadcn primitives only.
 *
 * THE API IS AN INVERSION: the caller stops writing <tr>/<td> and describes its
 * columns instead (`TableColumn<Row>`, ruled decision 2). That is what makes one
 * sort contract possible across twenty tables whose cells range from a plain
 * field read to a two-dictionary-key composition over a row boolean.
 *
 * THE TWO INK FAMILIES ARE THE `surface` PROP, mirroring ViewDataDisclosure's
 * prop of the same name and values. Getting them backwards is the exact defect
 * Story 2.7's review spent its headline finding on: --ink-on-pitch computes
 * 1.09:1 on a white card, and --border-hairline is invisible on the green.
 *
 * HEADERS ARE STICKY ONLY BEHIND THE OPT-IN `sticky` PROP (Story 2.11b closes
 * 2.11a's declared departure from UX-DR12). They stay off by default because
 * ViewDataDisclosure's region — which hosts the twenty disclosure tables — is
 * `overflow-x-auto` with NO height bound. Per CSS Overflow 3, `overflow-x:
 * auto` with `overflow-y: visible` forces the used `overflow-y` to `auto`, so
 * that div is already a two-axis scroll container and is the nearest scrolling
 * ancestor a sticky <thead> resolves against — and having no height bound, its
 * scrollport equals its content height and it never scrolls vertically.
 * `position: sticky; top: 0` inside it NEVER OFFSETS: it would ship green, pass
 * a suite with no jsdom, and silently not stick. The Expert Layer supplies its
 * own HEIGHT-BOUNDED wrapper (its `SCROLLPORT` const, a focusable region) and
 * passes `sticky`, which is the one place the rule actually does something.
 * This component still renders NO scroll container of its own.
 *
 * NO ZEBRA STRIPING (UX-DR12 and DESIGN both) — hairline row dividers only.
 * NO `aria-pressed` (decision 10): a sortable header's state is `aria-sort` on
 * the <th>, and a second state on the inner button would announce two competing
 * states for one control.
 */

/** Direction glyphs are module consts, never bare JSX literals (i18n gate). */
const ASCENDING_GLYPH = "▲";
const DESCENDING_GLYPH = "▼";
/** Reserved-space placeholder for an inactive column, so no head reflows on sort. */
const NO_GLYPH = "";
const CLAUSE_SEPARATOR = ", ";
const PERIOD = ".";
const SPACE = " ";
/** Separates a table's own name from the sort clause (Story 2.11b). */
const NAME_SEPARATOR = ": ";

/** Every focusable thing a body row could ever contain (decision 6's restore). */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SurfaceInk {
  caption: string;
  head: string;
  headActive: string;
  cell: string;
  divider: string;
  focus: string | null;
}

/*
 * PITCH vs CANVAS, the only thing the ten private copies actually differed in.
 *
 * `headActive` is a DECLARED DEPARTURE on the pitch. DESIGN's
 * `data-table.sort-active-color` is {colors.accent-cyan}, which is correct on
 * the canvas (measured 10.30 dark / 5.36 light on --card). On the theme-
 * invariant pitch the LIGHT --accent-cyan is #0e7490 and computes ~2.3:1 —
 * the same clause ViewDataDisclosure and ShotMapsSection already record for
 * their own on-pitch controls. The pitch therefore marks the active column with
 * a LIGHTNESS STEP (--ink-on-pitch over --ink-on-pitch-secondary) plus the
 * direction glyph, both theme-invariant. Direction is never carried by hue
 * alone on either surface.
 */
const INK: Record<"pitch" | "canvas", SurfaceInk> = {
  pitch: {
    caption: "text-ink-on-pitch-secondary",
    head: "text-ink-on-pitch-secondary",
    headActive: "text-ink-on-pitch",
    cell: "text-ink-on-pitch",
    divider: "border-pitch-line/40",
    focus: "focus-on-pitch",
  },
  canvas: {
    caption: "text-ink-secondary",
    head: "text-ink-secondary",
    headActive: "text-accent-cyan",
    cell: "text-ink-primary",
    divider: "border-hairline",
    focus: null,
  },
};

function cellClassFor(align: TableColumn<never>["align"], ink: string): string {
  if (align === "numeric") {
    return cn("px-2 py-1.5 text-right type-table-numeric", ink);
  }
  /*
   * `clock` is LEFT-aligned tabular figures — MomentumSection's minute column
   * needs exactly this, and right-aligning it would move a column that has read
   * left-aligned since Story 2.6. `text` is plain caption type.
   */
  return cn("px-2 py-1.5 type-caption", align === "clock" ? "tabular-nums" : null, ink);
}

export interface DataTableProps<Row> {
  /**
   * The table's already-composed caption. `caption` is one of the sixteen
   * gated prop names, so it takes a resolved identifier — exactly as the ten
   * private copies did.
   *
   * IT STATES THE DEFAULT ORDER AND NEVER MUTATES (decision 7). A caption that
   * rewrote itself on every sort would make the one durable statement of
   * canonical order unreadable. Sort state lives in `aria-sort` plus one polite
   * announcement.
   */
  caption: string;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  surface: "pitch" | "canvas";
  /**
   * Sticky-header mode (Story 2.11b, UX-DR12). OPT-IN, because it is only
   * correct inside a HEIGHT-BOUNDED scroll container — which this component
   * still does not render (that is the caller's wrapper, deliberately: see the
   * departure recorded at the top of this file).
   *
   * It switches the table to `border-separate`, and that switch is MANDATORY
   * rather than cosmetic: under `border-collapse` the TABLE paints the cell
   * borders, so a sticky <th>'s bottom border scrolls away underneath the rows
   * while the cell text stays put. With `border-separate` (+ zero spacing, so
   * the geometry is unchanged) each cell paints its own border and it travels
   * with the sticky cell.
   *
   * The row divider therefore MOVES from the <tr> to the individual cells in
   * this mode — `border-separate` does not paint a <tr> border at all.
   */
  sticky?: boolean;
  /**
   * Names this table in the polite sort announcement (Story 2.11b, routed here
   * by 2.11a review D4). ONE live region serves the page's tables and cannot
   * otherwise say which one moved. `undefined` produces the pre-2.11b string
   * byte for byte.
   */
  tableName?: string;
}

/**
 * `Row extends { key: string }` because decision 6's focus restore needs a
 * stable per-row identity, and every row model in src/viz/ already carries one
 * (`shot-row-3`, `defensive-row-12`, `momentum-row-44`, …). It is also the
 * React key, so a keyed reorder reuses the DOM nodes rather than recreating
 * them.
 */
export function DataTable<Row extends { key: string }>({
  caption,
  columns,
  rows,
  surface,
  sticky = false,
  tableName,
}: DataTableProps<Row>) {
  const t = useT();
  const announce = useSortAnnounce();

  /*
   * Ephemeral component state (AR-10) — not the URL, not Context, not
   * localStorage. THERE IS NO `defaultSort` PROP and no sorted-on-mount column
   * (decision 5): `null` IS the artifact order, which AD-5 reserves to the
   * artifact ("user-initiated re-ordering only").
   */
  const [sortState, setSortState] = useState<SortState | null>(null);

  const bodyRef = useRef<HTMLTableSectionElement>(null);
  /**
   * Where focus last sat INSIDE THIS TABLE'S BODY — row and column both, so the
   * restore can land on the same cell rather than the row's first focusable.
   */
  const lastFocusedCell = useRef<{ rowKey: string; columnKey: string | null } | null>(null);

  /*
   * DECISION 6: A STABLE KEY IS NECESSARY AND NOT SUFFICIENT.
   *
   * React 19 reconciles a keyed reorder with `Node.insertBefore`, whose
   * *removing steps* blur the focused element — `Node.moveBefore()` exists
   * precisely because `insertBefore` does not preserve focus, and React 19.2
   * does not use it in stable. So the key alone does not satisfy AC 2's
   * "sorting never loses row focus".
   *
   * REVIEW PATCH (Story 2.11a code review, ruled by Juan). The original capture
   * read `document.activeElement` inside the click handler and walked up from
   * it. That could never fire: the ONLY path to a sort is the <button> in the
   * <thead> row, which holds focus at that moment in Chrome and on every
   * keyboard path, so `closest("tr[data-row-key]")` always returned null and
   * this effect always early-returned. Three further defects rode along — the
   * walk was not scoped to this table (Safari does not focus buttons on click,
   * so another table's row key could be captured), the "focus survived" guard
   * missed `null` and `documentElement`, and the restore targeted the row's
   * FIRST focusable rather than the one that had focus.
   *
   * The capture is now a `focusin` on <tbody> (React's onFocus bubbles), which
   * is scoped to this table BY CONSTRUCTION and records the cell, not just the
   * row.
   *
   * STILL UNOBSERVABLE IN CHROME TODAY, and honestly so (AC 2 BINDING (c)): no
   * body-row content in any of the twenty tables is focusable — every cell is
   * plain text, and Story 2.9 Task 6.7 ruled player names plain text because
   * /players/{slug} does not exist. The clause is satisfied by construction
   * now; this is what keeps it satisfied when 2.15 makes those names links.
   */
  useLayoutEffect(() => {
    const captured = lastFocusedCell.current;
    if (captured === null) {
      // Mount, or a table whose body has never held focus.
      return;
    }
    /*
     * Focus survived the reorder — do not move it. `activeElement` is `null`
     * when the document is not fully active, and Firefox and Safari have parked
     * it on <html> rather than <body>; treating either as "survived" would
     * discard the capture in exactly the case the restore exists for.
     */
    const active = document.activeElement;
    const focusIsLost =
      active === null || active === document.body || active === document.documentElement;
    if (!focusIsLost) {
      return;
    }
    const row = bodyRef.current?.querySelector(`tr[data-row-key="${CSS.escape(captured.rowKey)}"]`);
    if (row === null || row === undefined) {
      // The row left the table entirely; there is nothing to restore to.
      return;
    }
    const sameCell =
      captured.columnKey === null
        ? null
        : row.querySelector<HTMLElement>(
            `[data-column-key="${CSS.escape(captured.columnKey)}"] ${FOCUSABLE_SELECTOR}`
          );
    (sameCell ?? row.querySelector<HTMLElement>(FOCUSABLE_SELECTOR))?.focus();
  }, [sortState]);

  /**
   * Records the cell focus is entering. Bubbles from the cell's own focusable
   * content, and is bound to <tbody>, so it can only ever see this table.
   */
  function handleBodyFocus(event: ReactFocusEvent<HTMLTableSectionElement>): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const rowKey = target.closest("tr[data-row-key]")?.getAttribute("data-row-key") ?? null;
    if (rowKey === null) {
      return;
    }
    lastFocusedCell.current = {
      rowKey,
      columnKey: target.closest("[data-column-key]")?.getAttribute("data-column-key") ?? null,
    };
  }

  const ink = INK[surface];
  const sortActionLabel = t("viz.table.sortAction");
  const sortedByLabel = t("viz.table.sortedBy");
  const ascendingLabel = t("viz.table.sortAscending");
  const descendingLabel = t("viz.table.sortDescending");
  const clearedLabel = t("viz.table.sortCleared");

  /**
   * Prefixes the table's own name when it has one (Story 2.11b). BOTH states
   * take the prefix, the cleared one included: "the table's original order was
   * restored" is exactly as ambiguous across 26 tables as the sorted form.
   * With no `tableName` this returns the identity, so the shipped string is
   * unchanged at every call site that does not pass one.
   */
  function withTableName(clause: string): string {
    return tableName === undefined ? clause : `${tableName}${NAME_SEPARATOR}${clause}`;
  }

  function announcementFor(next: SortState | null, headText: string): string {
    if (next === null) {
      // The cycle's third state names no column, because none is active.
      return withTableName(clearedLabel);
    }
    const direction = next.direction === "ascending" ? ascendingLabel : descendingLabel;
    return withTableName(
      `${sortedByLabel}${SPACE}${headText}${CLAUSE_SEPARATOR}${direction}${PERIOD}`
    );
  }

  function handleSort(column: TableColumn<Row>): void {
    /*
     * No capture here — `handleBodyFocus` already holds the last cell focused
     * inside this table's body, recorded when focus ARRIVED rather than read
     * from `document.activeElement` at click time (by which point focus is on
     * this button, not on a row). See the useLayoutEffect above.
     */
    const next = nextSortState(sortState, column.key);
    setSortState(next);
    announce(announcementFor(next, column.headText));
  }

  /*
   * Sorted DURING RENDER, never memoised on a stale `columns` identity. That is
   * load-bearing for the EN toggle: a DictionaryKey column's `sort.valueOf`
   * returns the label RESOLVED AT THE CALL SITE, so switching language rebuilds
   * the columns with new labels and the active sort must re-order to match. A
   * memo keyed on anything coarser would leave the rows in the old language's
   * order under the new language's labels.
   */
  const ordered = sortRows(rows, columns, sortState);

  /*
   * STICKY MODE'S FOUR CLASS SWITCHES (Story 2.11b). Every one of them is
   * `null` when `sticky` is false, and `cn()` drops a null — so the default
   * path emits exactly the class strings it emitted before this prop existed.
   *
   * The row divider MOVES from the <tr> to the cells: `border-separate` paints
   * no <tr> border at all, so leaving it there would silently delete every
   * hairline in the one mode that needs them most (50 columns of dense
   * numerics).
   *
   * The head fill is --surface-overlay PLUS a doubled bottom border (ruled
   * decision 8). Neither alone reads: --surface-raised against the card is
   * 1.00:1 — byte-identical tokens in both themes — and a single hairline is
   * 1.31:1. The doubled border is the carrier; the fill is what keeps the
   * scrolled-under rows from showing through.
   *
   * NOTE (2.11b code review): the only caller passing `sticky` is the Expert
   * Layer, whose table is NOT on a card — its backdrop is --surface-base, and
   * its sticky column run is filled to match. The head-to-body step there is
   * --surface-overlay against --surface-base, which is wider than the figures
   * above, so decision 8's conclusion holds a fortiori. Restate these numbers
   * against the actual backdrop if a card-mounted table ever opts in.
   */
  const tableClass = sticky
    ? "w-full border-separate border-spacing-0 text-left"
    : "w-full border-collapse text-left";
  const rowDividerClass = sticky ? null : cn("border-b", ink.divider);
  const cellDividerClass = sticky ? cn("border-b", ink.divider) : null;
  const stickyHeadClass = sticky
    ? cn("sticky top-0 z-20 border-b-2 bg-surface-overlay", ink.divider)
    : null;

  return (
    <table className={tableClass}>
      <caption className={cn("mb-2 text-left type-caption", ink.caption)}>{caption}</caption>
      <thead>
        <tr className={rowDividerClass ?? undefined}>
          {columns.map((column) => {
            const state = ariaSortFor(sortState, column.key);
            const isActive = state !== "none";
            const isNumeric = column.align === "numeric";
            const glyph =
              state === "ascending"
                ? ASCENDING_GLYPH
                : state === "descending"
                  ? DESCENDING_GLYPH
                  : NO_GLYPH;
            // Composed into identifiers: t() has no interpolation, and both
            // `aria-label` and `title` are gated prop names.
            const accessibleName = `${sortActionLabel}${SPACE}${column.headText}`;
            const headTitle = column.headTitle ?? undefined;

            if (column.sort === null) {
              /*
               * An unsortable column carries NO `aria-sort` at all — announcing
               * "none" on a head that can never sort claims a capability that
               * does not exist. It still reserves the 44 px row height so the
               * header row does not become ragged.
               */
              return (
                <th
                  key={column.key}
                  scope="col"
                  title={headTitle}
                  className={cn(
                    "type-stat-label",
                    ink.head,
                    isNumeric ? "text-right" : "text-left",
                    column.cellClass,
                    stickyHeadClass,
                    column.headClass
                  )}
                >
                  <span
                    className="flex items-center px-2"
                    style={{ minHeight: MIN_HIT_PX }}
                  >
                    {column.headText}
                  </span>
                </th>
              );
            }

            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={state}
                /*
                 * ORDER IS LOAD-BEARING: `column.cellClass` carries the sticky
                 * RUN's own fill (--surface-raised, the body's surface) and
                 * `z-10`; `stickyHeadClass` must beat both here, because a
                 * header cell is a header cell whichever column it sits in —
                 * and `column.headClass` beats everything, which is where the
                 * corner cells' `z-30` comes from. tailwind-merge resolves each
                 * conflicting utility to the LAST one, so this ordering IS the
                 * z-index ladder: body sticky 10, header 20, corners 30.
                 */
                className={cn(
                  "type-stat-label",
                  isNumeric ? "text-right" : "text-left",
                  column.cellClass,
                  stickyHeadClass,
                  column.headClass
                )}
              >
                {/*
                 * The >=44 px floor is on the BUTTON ITSELF, not a wrapper —
                 * the Story 2.4 patch. MIN_HIT_PX is IMPORTED from
                 * viz/marker-layout rather than re-declared, so UX-DR15's floor
                 * has exactly one definition in the codebase.
                 *
                 * A <button> inside the <th> is what makes the head reachable
                 * by Tab and operable by BOTH Enter and Space for free; a
                 * click handler on the <th> would need a tabIndex, a role and
                 * a hand-written key handler, and would still not be a button.
                 */}
                <button
                  type="button"
                  onClick={() => handleSort(column)}
                  aria-label={accessibleName}
                  title={headTitle}
                  style={{ minHeight: MIN_HIT_PX }}
                  className={cn(
                    "flex w-full items-center gap-1 px-2 type-stat-label",
                    isNumeric ? "justify-end" : "justify-start",
                    isActive ? ink.headActive : ink.head,
                    ink.focus
                  )}
                >
                  {column.headText}
                  {/*
                   * Fixed width so the head does not reflow when the glyph
                   * appears. aria-hidden because the state is already on the
                   * <th> as `aria-sort` and in the polite announcement —
                   * speaking a triangle would be a third, redundant carrier.
                   */}
                  <span aria-hidden="true" className="w-3 shrink-0 text-center type-caption">
                    {glyph}
                  </span>
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      {/*
       * onFocus (React implements it with focusin, so it BUBBLES) is what
       * records the cell for decision 6's restore. Binding it here rather than
       * walking document.activeElement is what scopes the capture to this table.
       */}
      <tbody ref={bodyRef} onFocus={handleBodyFocus}>
        {ordered.map((row) => (
          <tr key={row.key} data-row-key={row.key} className={rowDividerClass ?? undefined}>
            {columns.map((column) =>
              column.rowHeader === true ? (
                <th
                  key={column.key}
                  scope="row"
                  data-column-key={column.key}
                  className={cn(
                    cellClassFor(column.align, ink.cell),
                    "font-normal",
                    cellDividerClass,
                    column.cellClass
                  )}
                >
                  {column.render(row)}
                </th>
              ) : (
                <td
                  key={column.key}
                  data-column-key={column.key}
                  className={cn(
                    cellClassFor(column.align, ink.cell),
                    cellDividerClass,
                    column.cellClass
                  )}
                >
                  {column.render(row)}
                </td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
