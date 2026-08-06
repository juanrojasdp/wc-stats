"use client";

import { useEffect, useMemo, useState } from "react";

import { useSortAnnounce } from "@/components/SortAnnouncer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n-provider";
import {
  composeSortAnnouncement,
  nextSortState,
  type SortState,
  type TableColumn,
} from "@/lib/table-sort";

/*
 * THE `<md` HUB SORT MENU (Story 2.12, AC 4) and the controller that lets it
 * exist. EXPERIENCE.md names both: "On `<md` Hub tables the sort menu is a
 * shadcn DropdownMenu listing all columns and mirroring `aria-sort`." Story
 * 2.11a parked that clause for the Hub, so this is its first implementation.
 *
 * ONE SORT STATE, TWO CONTROLS. The header buttons inside `DataTable` and the
 * items in this menu drive the SAME `SortState` through the SAME
 * `nextSortState` cycle and announce through the SAME
 * `composeSortAnnouncement`. That is the whole reason `DataTable` grew an
 * optional controlled-sort API rather than this file growing a private copy of
 * the table — 2.11a decision 1 bans private copies, and a fourth sort contract
 * is exactly what D7 exists to prevent.
 *
 * WHY THE MENU EXISTS AT ALL: below `md` the disclosure hides columns, and a
 * hidden column has no header button to sort by. AC 4's clause is "sort still
 * available on ALL columns via the sort menu", so the menu lists the FULL
 * column set — including the hidden ones — and is rendered only while some
 * column is actually hidden. When everything is visible the header buttons
 * already reach every column and a second control would be redundant weight.
 */

/** Separates the trigger's action word from the table it belongs to. */
const NAME_SEPARATOR = ": ";
/** The cleared announcement names no column, so it needs no head text. */
const NO_HEAD_TEXT = "";
/**
 * Joins column keys into a scalar effect dependency. Written as an ESCAPE, not
 * as the literal character: a raw U+0000 in the source makes git classify this
 * whole file as BINARY (`Bin 0 -> 10393 bytes`, no diff, no blame) and makes
 * ripgrep skip its contents, which silently exempts it from every grep-based
 * i18n self-check this project runs. The joiner stays NUL because no column key
 * can contain one.
 */
const KEY_JOINER = "\u0000";

export interface TableSortController {
  sortState: SortState | null;
  /**
   * `DataTable`'s `onSortChange`. It does NOT announce: `DataTable` already
   * owns the announcement for a header click, and announcing here too would
   * speak every sort twice.
   */
  setSortState: (next: SortState | null) => void;
  /** The menu's path: advance the cycle for one column AND announce. */
  sortByColumn: (columnKey: string) => void;
  /** The menu's "original order" item: clear AND announce. */
  clearSort: () => void;
}

/**
 * Hoists one table's sort state out of `DataTable` so an external control can
 * drive it (D7), and rules what happens when the visible column set changes
 * underneath an active sort (Task 6.7).
 *
 * `columns` is the VISIBLE column list — what the table is rendering right now,
 * not the full set.
 */
export function useTableSort(input: {
  columns: readonly TableColumn<never>[];
  tableName: string;
}): TableSortController {
  const { columns, tableName } = input;
  const t = useT();
  const announce = useSortAnnounce();
  const [sortState, setSortState] = useState<SortState | null>(null);

  const labels = useMemo(
    () => ({
      sortedBy: t("viz.table.sortedBy"),
      ascending: t("viz.table.sortAscending"),
      descending: t("viz.table.sortDescending"),
      cleared: t("viz.table.sortCleared"),
    }),
    [t]
  );

  /*
   * A SCALAR dependency, not the array. `columns` is rebuilt on every render at
   * the call site (its `render` closures capture `t`), so it can never be a
   * stable dep; the joined key list changes only when the column SET does.
   */
  const columnKeys = columns.map((column) => column.key).join(KEY_JOINER);

  /*
   * TASK 6.7's BACKSTOP: if the active column ever leaves the model, the sort
   * is CLEARED AND ANNOUNCED — never silently dropped.
   *
   * Two open ledger entries describe exactly this shape and neither was owned:
   * "sort state is silently destroyed by the disclosure toggle" and "a gated
   * column disappearing while active reverts rows with no announcement". Doing
   * nothing is worse than it sounds: `sortRows` falls back to artifact order
   * for an unknown `columnKey`, so the rows visibly re-order, every `aria-sort`
   * reads "none", and the sort RE-APPLIES itself the moment the column comes
   * back. That is 2.11b's ledgered defect, and why Task 6.5 forbids the re-key
   * idiom that produced it.
   *
   * ON THE HUB THIS NEVER FIRES, BY DESIGN. `HubTable` hides a column with
   * `display: none` rather than dropping it from the list, precisely so the
   * sort menu can offer every column (AC 4) without the sort evaporating —
   * see the ruling in that file. This guard is for a column set that genuinely
   * shrinks (a presence gate, the shape the Expert Layer has), and it keeps
   * that case honest for the next consumer of the controlled-sort API.
   *
   * An effect is the right shape even though the codebase prefers event
   * handlers: a `md` crossover is not an event this component owns — it
   * arrives through `useMediaQuery`'s external store — so handling only a
   * click would cover one cause and leave the other silent.
   * `set-state-in-effect` is disabled with the same justification
   * i18n-provider.tsx records for its own single deliberate use.
   */
  useEffect(() => {
    if (sortState === null) {
      return;
    }
    if (columnKeys.split(KEY_JOINER).includes(sortState.columnKey)) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSortState(null);
    announce(
      composeSortAnnouncement({ state: null, headText: NO_HEAD_TEXT, labels, tableName })
    );
  }, [columnKeys, sortState, announce, labels, tableName]);

  return useMemo<TableSortController>(
    () => ({
      sortState,
      setSortState,
      sortByColumn: (columnKey) => {
        const column = columns.find((candidate) => candidate.key === columnKey);
        const next = nextSortState(sortState, columnKey);
        setSortState(next);
        announce(
          composeSortAnnouncement({
            state: next,
            headText: column?.headText ?? NO_HEAD_TEXT,
            labels,
            tableName,
          })
        );
      },
      clearSort: () => {
        setSortState(null);
        announce(
          composeSortAnnouncement({ state: null, headText: NO_HEAD_TEXT, labels, tableName })
        );
      },
    }),
    [sortState, columns, announce, labels, tableName]
  );
}

/**
 * The menu itself. `columns` here is the FULL set — hidden columns included,
 * which is the point (AC 4).
 */
export function TableSortMenu<Row>({
  columns,
  controller,
  tableName,
}: {
  columns: readonly TableColumn<Row>[];
  controller: TableSortController;
  tableName: string;
}) {
  const t = useT();
  const { sortState } = controller;

  /*
   * Composed into identifiers: t() has no interpolation and `aria-label` is one
   * of the sixteen gated prop names.
   *
   * THE TRIGGER IS DISAMBIGUATED BY ITS TABLE (Task 6.3c). The Hub renders up
   * to THIRTY tables on one route (12 group standings + 12 group results + up
   * to 6 knockout stages), so thirty buttons all named "Ordenar"
   * would be indistinguishable in a screen reader's button list — the same
   * problem `ViewDataDisclosure`'s `panelTitle` already solves, solved the same
   * way. The VISIBLE text stays the one canonical word, so WCAG 2.5.3 Label in
   * Name holds: the visible label is contained in the accessible name.
   */
  const triggerLabel = t("hub.sortMenu.trigger");
  const triggerName = `${triggerLabel}${NAME_SEPARATOR}${tableName}`;
  const ascendingLabel = t("viz.table.sortAscending");
  const descendingLabel = t("viz.table.sortDescending");

  /*
   * NO `aria-pressed` and no `aria-sort` HERE (2.11a decision 10, re-affirmed
   * by 2.11c ruling 9). `aria-sort` belongs on the `<th>` and is already there;
   * restating it on a menu item would announce two competing states for one
   * control. The menu MIRRORS that state by naming the active column's
   * direction in the item's own text, which is spoken as part of the item.
   *
   * `role="menuitemradio"` was the obvious alternative and does not fit: the
   * sort cycle has THREE states per column (ascending, descending, none) and a
   * radio group cannot express re-selecting its current value, which is exactly
   * the ascending -> descending step.
   */
  const sortable = columns.filter((column) => column.sort !== null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={triggerName}
        /*
         * `type-stat-label`, not `type-label-caps`. The two are byte-identical
         * except that only `type-stat-label` carries `text-transform:
         * uppercase` — which is why every one of `type-label-caps`'s other
         * consumers passes already-uppercase content (team codes, chip
         * letters). This trigger passes the WORD "Ordenar", so it rendered in
         * sentence case beside the `type-stat-label` column heads it drives.
         * The transform is CSS, so the accessible name and the DOM text are
         * untouched and Label in Name holds.
         */
        className="flex min-h-11 items-center rounded-sm border border-hairline px-3 type-stat-label text-ink-secondary"
      >
        {triggerLabel}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {sortable.map((column) => {
          const isActive = sortState !== null && sortState.columnKey === column.key;
          const direction = !isActive
            ? null
            : sortState.direction === "ascending"
              ? ascendingLabel
              : descendingLabel;
          return (
            <DropdownMenuItem
              key={column.key}
              onSelect={() => controller.sortByColumn(column.key)}
            >
              <span>{column.headText}</span>
              {/*
               * The active column's direction, as a WORD rather than a glyph:
               * this is a text menu and the glyph would need an sr-only word
               * beside it anyway. Rendered inside the item, so it is part of
               * the item's own accessible name.
               */}
              {direction === null ? null : (
                <span className="type-caption text-ink-secondary">{direction}</span>
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          // Disabled rather than hidden: a control that appears and disappears
          // as the reader sorts is harder to find than one that greys out.
          disabled={sortState === null}
          onSelect={() => controller.clearSort()}
        >
          <span>{t("hub.sortMenu.clear")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
