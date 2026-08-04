"use client";

import { useLayoutEffect, useRef, useState } from "react";

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
 * HEADERS ARE NOT STICKY, and that is a DECLARED DEPARTURE from UX-DR12 filed
 * in deferred-work.md and routed to Story 2.11b. ViewDataDisclosure's region —
 * which hosts every one of the twenty tables — is `overflow-x-auto` with NO
 * height bound. Per CSS Overflow 3, `overflow-x: auto` with `overflow-y:
 * visible` forces the used `overflow-y` to `auto`, so that div is already a
 * two-axis scroll container and is the nearest scrolling ancestor a sticky
 * <thead> resolves against — and having no height bound, its scrollport equals
 * its content height and it never scrolls vertically. `position: sticky; top: 0`
 * inside it NEVER OFFSETS. A sticky header here would ship green, pass a suite
 * with no jsdom, and silently not stick. 2.11b introduces sticky headers in the
 * Expert Layer's own bounded container, where they work.
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
  /** The row key that owned focus when the last sort was requested, if any. */
  const pendingFocusKey = useRef<string | null>(null);

  /*
   * DECISION 6: A STABLE KEY IS NECESSARY AND NOT SUFFICIENT.
   *
   * React 19 reconciles a keyed reorder with `Node.insertBefore`, whose
   * *removing steps* blur the focused element — `Node.moveBefore()` exists
   * precisely because `insertBefore` does not preserve focus, and React 19.2
   * does not use it in stable. So the key alone does not satisfy AC 2's
   * "sorting never loses row focus".
   *
   * THIS IS UNOBSERVABLE TODAY and is the FORWARD guarantee (AC 2 BINDING (c)):
   * no body-row content in any of the twenty tables is focusable — every cell
   * is plain text, and Story 2.9 Task 6.7 ruled player names plain text because
   * /players/{slug} does not exist. The clause is satisfied by construction
   * now; this is what keeps it satisfied when 2.15 makes those names links.
   */
  useLayoutEffect(() => {
    const key = pendingFocusKey.current;
    pendingFocusKey.current = null;
    if (key === null) {
      // Mount, or a re-render that was not a sort. Nothing was captured.
      return;
    }
    // Focus survived the reorder — do not move it.
    if (document.activeElement !== document.body) {
      return;
    }
    const row = bodyRef.current?.querySelector(`tr[data-row-key="${CSS.escape(key)}"]`);
    row?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [sortState]);

  const ink = INK[surface];
  const sortActionLabel = t("viz.table.sortAction");
  const sortedByLabel = t("viz.table.sortedBy");
  const ascendingLabel = t("viz.table.sortAscending");
  const descendingLabel = t("viz.table.sortDescending");
  const clearedLabel = t("viz.table.sortCleared");

  function announcementFor(next: SortState | null, headText: string): string {
    if (next === null) {
      // The cycle's third state names no column, because none is active.
      return clearedLabel;
    }
    const direction = next.direction === "ascending" ? ascendingLabel : descendingLabel;
    return `${sortedByLabel}${SPACE}${headText}${CLAUSE_SEPARATOR}${direction}${PERIOD}`;
  }

  function handleSort(column: TableColumn<Row>): void {
    /*
     * Captured BEFORE the state change, while the pre-sort DOM is still live:
     * walk from document.activeElement up to its own <tr> and keep that row's
     * key. After the commit the element may be gone.
     */
    const active = document.activeElement;
    pendingFocusKey.current =
      active instanceof Element
        ? (active.closest("tr[data-row-key]")?.getAttribute("data-row-key") ?? null)
        : null;

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

  return (
    <table className="w-full border-collapse text-left">
      <caption className={cn("mb-2 text-left type-caption", ink.caption)}>{caption}</caption>
      <thead>
        <tr className={cn("border-b", ink.divider)}>
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
                  className={cn("type-stat-label", ink.head, isNumeric ? "text-right" : "text-left")}
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
                className={cn("type-stat-label", isNumeric ? "text-right" : "text-left")}
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
      <tbody ref={bodyRef}>
        {ordered.map((row) => (
          <tr key={row.key} data-row-key={row.key} className={cn("border-b", ink.divider)}>
            {columns.map((column) =>
              column.rowHeader === true ? (
                <th
                  key={column.key}
                  scope="row"
                  className={cn(cellClassFor(column.align, ink.cell), "font-normal")}
                >
                  {column.render(row)}
                </th>
              ) : (
                <td key={column.key} className={cellClassFor(column.align, ink.cell)}>
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
