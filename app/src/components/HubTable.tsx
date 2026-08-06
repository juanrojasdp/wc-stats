"use client";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { TableSortMenu, useTableSort } from "@/components/TableSortMenu";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";

/*
 * One Hub table: the shared `DataTable` plus the two things the Hub adds around
 * it — the `<md` sort menu (AC 4) and the zero state (Task 3.9).
 *
 * IT IS A WRAPPER, NEVER A FORK. Every rendering decision still belongs to
 * `DataTable`; this component owns only the sort STATE (hoisted so the menu can
 * drive it, D7), which columns are currently rendered, and what happens when
 * there are no rows at all.
 *
 * NO `key` ON THE TABLE. Story 2.11b keys its `DataTable` on the column set,
 * which remounts it and silently resets the sort — the open ledger defect Task
 * 6.7 forbids and Task 6.5 names by hand. Hoisting the state makes the re-key
 * unnecessary for correctness: React reconciles a changed `columns` array
 * fine, and `useTableSort` handles the one case that genuinely needs handling
 * (the active column disappearing) by clearing AND ANNOUNCING.
 *
 * NO STICKY HEADER — a DECLARED, SCOPED DEPARTURE from UX-DR12
 * (EXPERIENCE.md:76), recorded here rather than left to be re-discovered:
 *
 *   `DataTable`'s `sticky` is correct ONLY inside a caller-rendered
 *   HEIGHT-BOUNDED scroll container, which is why it is opt-in at all — its own
 *   docblock records that a sticky <thead> inside a height-UNBOUNDED ancestor
 *   computes as `sticky` and never offsets, shipping green and silently dead.
 *   Hub tables are SHORT: four standings rows per group, six results per group,
 *   sixteen in the largest knockout section. None of them scrolls vertically,
 *   so there is nothing for a sticky header to stick to — and bounding all
 *   THIRTY tables (12 group standings + 12 group results + up to 6 knockout
 *   stages) to a fixed height to manufacture the condition would put thirty
 *   nested vertical scrollports on a page whose natural flow is fine
 *   and would hide rows behind a scroll gesture that is currently unnecessary.
 *   The clause is aimed at long tables; the Expert Layer is where it earns its
 *   keep, and it opts in there. Filed in deferred-work.md, and it is 2.19's to
 *   revisit if the real 104-row corpus changes the premise.
 *
 * `scroll-padding-top: 4.5rem` is already set globally on <html> in
 * globals.css, so an anchored or focused section clears the sticky site header
 * without anything further here (Task 4.1b).
 */

/**
 * How a column is hidden below `md`: `display: none`, NOT removal from the
 * column list. See the ruling in `HubTable` — this one class is what makes AC
 * 4's "sort still available on all columns" implementable at all.
 */
const HIDDEN_COLUMN_CLASS = "hidden";

export function HubTable<Row extends { key: string }>({
  caption,
  columns,
  visibleKeys,
  rows,
  tableName,
  emptyHeadline,
  emptyExplanation,
  showSortMenu = false,
  onRevealColumns,
}: {
  caption: string;
  /** The FULL column set, in render order. */
  columns: readonly TableColumn<Row>[];
  /** Which of them are on screen right now (the `<md` disclosure's output). */
  visibleKeys: readonly string[];
  rows: readonly Row[];
  tableName: string;
  emptyHeadline: string;
  emptyExplanation: string;
  /** `true` below `md` — the breakpoint, NOT the hidden-column count. */
  showSortMenu?: boolean;
  /**
   * Expands the surface's "Más columnas" disclosure. Called when the reader
   * sorts by a column that is currently off screen, so the column they just
   * sorted by becomes visible rather than the rows re-ordering for no reason
   * they can see.
   */
  onRevealColumns?: () => void;
}) {
  /*
   * TASK 6.7, RULED — AND THE RULING IS "THE SORT IS NEVER REVERTED", because
   * the column is never removed.
   *
   * A hidden column is hidden with `display: none`, not filtered out of the
   * column list. That is not a shortcut, it is the only way AC 4 is coherent:
   * the sort menu offers EVERY column including the hidden ones, so a reader
   * can and will sort by one — and `sortRows` resolves the active `columnKey`
   * against the list `DataTable` is given. Filter the hidden ones out and
   * `sortRows` finds nothing, falls back to artifact order, and the rows
   * silently un-sort the instant the reader picks a hidden column. That is
   * verbatim the open ledger defect ("a gated column disappearing while active
   * reverts rows with no announcement"), reached by the exact route AC 4
   * requires. It was caught in the browser, not by a test — no test in this
   * jsdom-less harness could see it.
   *
   * So: hidden columns stay in the model, out of the layout, and out of the
   * accessibility tree (`display: none` removes them from both, and takes
   * their header buttons out of the tab order with them). Toggling the
   * disclosure changes what is PAINTED and nothing else — SM-C2's "hides
   * columns, never removes data", literally.
   *
   * The reversion guard inside `useTableSort` therefore never fires on this
   * surface, and is correct that it does not: it exists for a column that
   * genuinely leaves the model, and this one never does.
   */
  const hiddenKeys = new Set(
    columns.filter((column) => !visibleKeys.includes(column.key)).map((column) => column.key)
  );
  const renderedColumns = columns.map((column) =>
    hiddenKeys.has(column.key)
      ? { ...column, cellClass: cn(column.cellClass, HIDDEN_COLUMN_CLASS) }
      : column
  );

  const controller = useTableSort({
    columns: renderedColumns as readonly TableColumn<never>[],
    tableName,
  });

  /*
   * ZERO ROWS ⇒ ZERO LIVE SORT CONTROLS (Task 3.9), which fires an open ledger
   * entry: "zero-row tables render live sort controls". A group with no played
   * matches yet would otherwise present eleven sortable headers and a sort menu
   * over an empty <tbody> — controls that provably do nothing.
   *
   * `[]` gets a REAL zero state rather than a bare absence. `[]` and "absent"
   * are distinct states by contract, and `rows` is typed non-nullable here
   * because `standingsSections`/`resultsSections` normalize the third state
   * (`undefined`) away at the model boundary — a section always carries an
   * array, empty or not.
   */
  if (rows.length === 0) {
    return <EmptyStatePanel headline={emptyHeadline} explanation={emptyExplanation} />;
  }

  /*
   * THE MENU IS THE NARROW-LAYOUT SORT CONTROL, so it tracks the BREAKPOINT and
   * not the hidden-column count. Ruled at code review, reversing this file's
   * first ruling ("renders only while something is hidden"), for two reasons:
   *
   * 1. THE FIRST RULING UNMOUNTED THE MENU MID-INTERACTION. Selecting a hidden
   *    column calls `onRevealColumns`, which expands the surface, which empties
   *    `hiddenKeys` — so the menu, its trigger and the node Radix returns focus
   *    to all left the DOM in the same commit as the close. Focus landed on
   *    <body>, at the top of a thirty-table document, on the exact path AC 4
   *    exists for.
   * 2. THE "REDUNDANT ONCE EXPANDED" PREMISE WAS WRONG. An expanded eleven-
   *    column standings table at 390px lives inside `overflow-x-auto`, so
   *    reaching the `DG` header button means scrolling the table sideways to
   *    hunt for it. The menu is MORE useful expanded, not less.
   *
   * It lists the FULL set, hidden columns included, in both states.
   */

  /*
   * Sorting a hidden column REVEALS it. Without this the rows would re-order
   * with no visible cause on the narrowest layout the site supports — the
   * announcement names the column, but a sighted reader who cannot see it has
   * only the movement. Revealing keeps the promise ("sort any column") and the
   * feedback (you can see the column you sorted by) at the same time.
   */
  const menuController = {
    ...controller,
    sortByColumn: (columnKey: string) => {
      if (hiddenKeys.has(columnKey)) {
        onRevealColumns?.();
      }
      controller.sortByColumn(columnKey);
    },
  };

  return (
    <div>
      {showSortMenu ? (
        <div className="mb-tile-gap flex justify-end">
          <TableSortMenu columns={columns} controller={menuController} tableName={tableName} />
        </div>
      ) : null}
      {/*
       * The table scrolls INSIDE its own container, never the page — UX-DR16's
       * data-table exception, and the wrapper `DataTable` deliberately does not
       * render (its docblock explains why it must not).
       */}
      <div className="w-full overflow-x-auto">
        <DataTable
          caption={caption}
          columns={renderedColumns}
          rows={rows}
          // The card, never the pitch. Getting this backwards is the defect
          // Story 2.7's review headlined.
          surface="canvas"
          tableName={tableName}
          sortState={controller.sortState}
          onSortChange={controller.setSortState}
          /*
           * D9's containing block: the row-header cell's anchor stretches over
           * the whole row with `after:inset-0`, which resolves against the
           * nearest positioned ancestor. Without this the pseudo-element would
           * cover the page.
           */
          rowClass="relative"
        />
      </div>
    </div>
  );
}
