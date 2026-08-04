import { describe, expect, it } from "vitest";

import { compareText } from "@/lib/format";
import {
  ariaSortFor,
  clockSortValue,
  compareNumberNullLast,
  compareTextNullLast,
  nextSortState,
  sortRows,
  type SortState,
  type TableColumn,
} from "@/lib/table-sort";
import { orderByMinute } from "@/viz/marker-layout";

/*
 * The sort contract's ONLY assertable surface. The harness has no jsdom, so
 * nothing rendered can be unit-tested (see the story's Task 9) — everything the
 * shared table decides that is not a DOM decision lives in table-sort.ts and is
 * pinned here.
 */

interface Row {
  key: string;
  name: string | null;
  count: number | null;
  /** The nested-getter path: `keyof Row` cannot reach these (decision 2). */
  counts: { forward: number; backward: number };
  minute: number | null;
  stoppageMinute: number | null;
}

function row(
  key: string,
  name: string | null,
  count: number | null,
  forward = 0,
  minute: number | null = null,
  stoppageMinute: number | null = null
): Row {
  return { key, name, count, counts: { forward, backward: 0 }, minute, stoppageMinute };
}

const nameColumn: TableColumn<Row> = {
  key: "name",
  headText: "name",
  headTitle: null,
  render: (r) => r.name,
  align: "text",
  sort: { kind: "text", valueOf: (r) => r.name },
};

const countColumn: TableColumn<Row> = {
  key: "count",
  headText: "count",
  headTitle: null,
  render: (r) => r.count,
  align: "numeric",
  sort: { kind: "number", valueOf: (r) => r.count },
};

/** A generated column whose value lives two levels down (MovementRow's shape). */
const forwardColumn: TableColumn<Row> = {
  key: "forward",
  headText: "forward",
  headTitle: null,
  render: (r) => r.counts.forward,
  align: "numeric",
  sort: { kind: "number", valueOf: (r) => r.counts.forward },
};

const clockColumn: TableColumn<Row> = {
  key: "clock",
  headText: "clock",
  headTitle: null,
  render: (r) => r.minute,
  align: "clock",
  sort: { kind: "number", valueOf: (r) => clockSortValue(r.minute, r.stoppageMinute) },
};

const unsortableColumn: TableColumn<Row> = {
  key: "unsortable",
  headText: "unsortable",
  headTitle: null,
  render: (r) => r.key,
  align: "text",
  sort: null,
};

const COLUMNS = [nameColumn, countColumn, forwardColumn, clockColumn, unsortableColumn];

function keysOf(rows: readonly Row[]): string[] {
  return rows.map((r) => r.key);
}

function sorted(rows: readonly Row[], state: SortState | null): string[] {
  return keysOf(sortRows(rows, COLUMNS, state));
}

describe("sortRows — text columns", () => {
  it("collates accents and case through compareText, never string compare", () => {
    const rows = [
      row("a", "Zapata", 1),
      row("b", "álvarez", 2),
      row("c", "Alvarez", 3),
      row("d", "Ñandú", 4),
    ];
    /*
     * A bare `<`/`>` or localeCompare() would put every capital before every
     * lowercase (ASCII order), so "Zapata" would precede "álvarez". Base
     * sensitivity folds case AND accent, so the two Alvarez spellings are equal
     * and fall back to artifact order (decision 8).
     */
    expect(sorted(rows, { columnKey: "name", direction: "ascending" })).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
  });

  it("keeps equal keys in artifact order — the sort is STABLE", () => {
    // Base sensitivity makes all four equal; only the original index separates them.
    const rows = [
      row("first", "Álvarez", 1),
      row("second", "alvarez", 2),
      row("third", "ALVAREZ", 3),
      row("fourth", "Alvarez", 4),
    ];
    expect(sorted(rows, { columnKey: "name", direction: "ascending" })).toEqual([
      "first",
      "second",
      "third",
      "fourth",
    ]);
    // Descending reverses the COMPARISON, never the tiebreak: equal rows must
    // not flip, or the two directions would disagree about identical data.
    expect(sorted(rows, { columnKey: "name", direction: "descending" })).toEqual([
      "first",
      "second",
      "third",
      "fourth",
    ]);
  });

  /*
   * THE COLLATION CHOICE IS PINNED HERE BECAUSE NOTHING ELSE CAN PIN IT.
   *
   * Measured at story creation across all 96 fixture player names: the `es` and
   * `en` orders are IDENTICAL (0 disagreements in 9,216 pairs, 0 non-ASCII
   * characters), so locale-keyed collation is unobservable in the browser on
   * shipped fixtures. These are constructed strings, not fixture names.
   */
  it("uses the 'es' collator, where ñ is its OWN LETTER after n", () => {
    const words = ["nino", "ñino", "nunez", "nuñez"];
    const es = [...words].sort((a, b) => compareText(a, b));
    const en = [...words].sort((a, b) => compareText(a, b, "en"));

    expect(es).toEqual(["nino", "nunez", "nuñez", "ñino"]);
    expect(en).toEqual(["nino", "ñino", "nunez", "nuñez"]);
    expect(es).not.toEqual(en);

    // `en` at base sensitivity collapses ñ into n, so these two collide — an
    // unstable tiebreak on exactly the names most likely to appear.
    expect(compareText("nunez", "nuñez", "en")).toBe(0);
    expect(compareText("nunez", "nuñez")).not.toBe(0);

    // And the shipped sort takes the 'es' default: same order as `es` above.
    const rows = words.map((word, index) => row(`w${index}`, word, index));
    expect(sorted(rows, { columnKey: "name", direction: "ascending" })).toEqual([
      "w0",
      "w2",
      "w3",
      "w1",
    ]);
  });
});

describe("sortRows — nulls sort to the END OF THE ARRAY in BOTH directions", () => {
  const rows = [
    row("null-a", null, null),
    row("low", "aaa", 1),
    row("null-b", null, null),
    row("high", "zzz", 9),
  ];

  it("puts nulls last ascending", () => {
    expect(sorted(rows, { columnKey: "count", direction: "ascending" })).toEqual([
      "low",
      "high",
      "null-a",
      "null-b",
    ]);
    expect(sorted(rows, { columnKey: "name", direction: "ascending" })).toEqual([
      "low",
      "high",
      "null-a",
      "null-b",
    ]);
  });

  it("puts nulls last DESCENDING TOO — descending does not flip them to the top", () => {
    expect(sorted(rows, { columnKey: "count", direction: "descending" })).toEqual([
      "high",
      "low",
      "null-a",
      "null-b",
    ]);
    expect(sorted(rows, { columnKey: "name", direction: "descending" })).toEqual([
      "high",
      "low",
      "null-a",
      "null-b",
    ]);
  });

  it("keeps null rows among themselves in artifact order", () => {
    const allNull = [row("x", null, null), row("y", null, null), row("z", null, null)];
    expect(sorted(allNull, { columnKey: "count", direction: "ascending" })).toEqual([
      "x",
      "y",
      "z",
    ]);
    expect(sorted(allNull, { columnKey: "count", direction: "descending" })).toEqual([
      "x",
      "y",
      "z",
    ]);
  });
});

describe("the shared null-last comparators", () => {
  it("compareNumberNullLast ranks nulls after every present value", () => {
    expect(compareNumberNullLast(1, 2)).toBeLessThan(0);
    expect(compareNumberNullLast(2, 1)).toBeGreaterThan(0);
    expect(compareNumberNullLast(1, 1)).toBe(0);
    expect(compareNumberNullLast(null, 1)).toBe(1);
    expect(compareNumberNullLast(1, null)).toBe(-1);
    expect(compareNumberNullLast(null, null)).toBe(0);
  });

  it("compareTextNullLast collates through compareText and ranks nulls last", () => {
    expect(compareTextNullLast("álvarez", "Alvarez")).toBe(0);
    expect(compareTextNullLast(null, "a")).toBe(1);
    expect(compareTextNullLast("a", null)).toBe(-1);
    expect(compareTextNullLast(null, null)).toBe(0);
  });

  /*
   * REVIEW PATCH (Story 2.11a code review). `undefined` must rank exactly as
   * `null` does, even though the `valueOf` signatures promise `Value | null`.
   *
   * A getter reading an index off a `Record<Code, number>` is typed `number`
   * whether or not the key is present, so a record built as `{} as Record<…>`
   * can hand the comparator `undefined` with no type error. Ranking it as
   * PRESENT sends it into `a - b` -> `NaN`, and `Array.prototype.sort` coerces a
   * `NaN` result to `+0` — which silently discards the index tiebreak, so the
   * sort stops being stable as well as ordering wrongly. `clockSortValue`
   * already normalized `undefined`; this pins the rest of the module to agree.
   */
  it("ranks undefined exactly as null, so a missing Record key cannot poison the sort", () => {
    const undefinedValue = undefined as unknown as number | null;
    expect(compareNumberNullLast(undefinedValue, 1)).toBe(1);
    expect(compareNumberNullLast(1, undefinedValue)).toBe(-1);
    expect(compareNumberNullLast(undefinedValue, undefinedValue)).toBe(0);
    expect(compareNumberNullLast(undefinedValue, null)).toBe(0);

    const rows = [
      { key: "present", count: 2 },
      { key: "missing", count: undefined as unknown as number },
      { key: "small", count: 1 },
    ];
    const column: TableColumn<(typeof rows)[number]> = {
      key: "count",
      headText: "Count",
      headTitle: null,
      render: (row) => row.count,
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.count },
    };
    // Absent goes LAST in both directions, and the present values still order.
    expect(
      sortRows(rows, [column], { columnKey: "count", direction: "ascending" }).map((r) => r.key)
    ).toEqual(["small", "present", "missing"]);
    expect(
      sortRows(rows, [column], { columnKey: "count", direction: "descending" }).map((r) => r.key)
    ).toEqual(["present", "small", "missing"]);
  });

  /*
   * EQUIVALENT TO orderByMinute'S NULL HANDLING (Task 2.4). marker-layout's
   * `left == null ? 1 : -1` defines only ASCENDING; the module above states the
   * rest. This asserts the two agree wherever orderByMinute has an opinion, so
   * the roving-tabindex order and the table sort can never disagree.
   */
  it("agrees with orderByMinute on ascending clock order", () => {
    const events = [
      { key: "e-none-1", at: null },
      { key: "e-45-2", at: { minute: 45, stoppageMinute: 2 } },
      { key: "e-9", at: { minute: 9, stoppageMinute: null } },
      { key: "e-none-2", at: null },
      { key: "e-45", at: { minute: 45, stoppageMinute: null } },
    ];
    const viaMarkerLayout = orderByMinute(events).map((e) => e.key);

    const clockRows = events.map((e, index) =>
      row(e.key, null, index, 0, e.at === null ? null : e.at.minute, e.at?.stoppageMinute ?? null)
    );
    const viaSortRows = sorted(clockRows, { columnKey: "clock", direction: "ascending" });

    expect(viaSortRows).toEqual(viaMarkerLayout);
    expect(viaSortRows).toEqual(["e-9", "e-45", "e-45-2", "e-none-1", "e-none-2"]);
  });
});

describe("sortRows — clock columns sort on the STAMP, never the rendered label", () => {
  it('orders 9′ before 45+2′, which string collation would invert', () => {
    const rows = [
      row("45+2", null, 0, 0, 45, 2),
      row("9", null, 0, 0, 9, null),
      row("45", null, 0, 0, 45, null),
      row("90+11", null, 0, 0, 90, 11),
      row("90+2", null, 0, 0, 90, 2),
    ];
    expect(sorted(rows, { columnKey: "clock", direction: "ascending" })).toEqual([
      "9",
      "45",
      "45+2",
      "90+2",
      "90+11",
    ]);
    /*
     * The rendered labels sort the other way: "45+2′" collates before "9′",
     * and "90+11′" before "90+2′". That is exactly the defect this column
     * shape exists to prevent.
     */
    const labels = ["45+2′", "9′", "45′", "90+11′", "90+2′"];
    expect([...labels].sort((a, b) => compareText(a, b))[0]).toBe("45′");
  });

  it("scales the minute so no stoppage value can overtake the next minute", () => {
    // 45+99 must still precede minute 46 — hence minute * 1000, not * 10.
    expect(clockSortValue(45, 99)).toBeLessThan(clockSortValue(46, null) as number);
    expect(clockSortValue(45, null)).toBe(45_000);
    expect(clockSortValue(45, 2)).toBe(45_002);
  });

  it("returns null for an absent clock rather than minute 0", () => {
    expect(clockSortValue(null, null)).toBeNull();
    expect(clockSortValue(null, 3)).toBeNull();
    expect(clockSortValue(undefined, undefined)).toBeNull();
    // The `?? 0` this story closes would have made a clock-less row sort FIRST.
    expect(clockSortValue(0, null)).toBe(0);
  });
});

describe("sortRows — the nested-getter path", () => {
  it("sorts on a value two levels down, unreachable by keyof Row", () => {
    const rows = [row("a", null, 0, 5), row("b", null, 0, 1), row("c", null, 0, 3)];
    expect(sorted(rows, { columnKey: "forward", direction: "ascending" })).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("sortRows — 'none' restores the artifact order EXACTLY", () => {
  const rows = [
    row("z", "zulu", 3),
    row("a", "alfa", 1),
    row("m", null, null),
    row("k", "kilo", 2),
  ];

  it("returns the rows verbatim when no column is active", () => {
    expect(sorted(rows, null)).toEqual(["z", "a", "m", "k"]);
  });

  it("restores the artifact order after a full none -> asc -> desc -> none cycle", () => {
    const before = sorted(rows, null);
    let state = nextSortState(null, "name");
    expect(state).toEqual({ columnKey: "name", direction: "ascending" });
    state = nextSortState(state, "name");
    expect(state).toEqual({ columnKey: "name", direction: "descending" });
    state = nextSortState(state, "name");
    expect(state).toBeNull();
    expect(sorted(rows, state)).toEqual(before);
  });

  it("does not mutate the caller's array", () => {
    const original = [...rows];
    sortRows(rows, COLUMNS, { columnKey: "name", direction: "descending" });
    expect(rows).toEqual(original);
  });

  it("falls back to artifact order for an unknown or unsortable column", () => {
    expect(sorted(rows, { columnKey: "unsortable", direction: "ascending" })).toEqual([
      "z",
      "a",
      "m",
      "k",
    ]);
    expect(sorted(rows, { columnKey: "no-such-column", direction: "ascending" })).toEqual([
      "z",
      "a",
      "m",
      "k",
    ]);
  });
});

describe("nextSortState — the none -> asc -> desc -> none cycle", () => {
  it("starts a fresh column ascending", () => {
    expect(nextSortState(null, "count")).toEqual({
      columnKey: "count",
      direction: "ascending",
    });
  });

  it("switching columns starts the NEW column ascending, not at the old direction", () => {
    const state: SortState = { columnKey: "name", direction: "descending" };
    expect(nextSortState(state, "count")).toEqual({
      columnKey: "count",
      direction: "ascending",
    });
  });

  it("cycles the active column and then clears it", () => {
    const asc: SortState = { columnKey: "count", direction: "ascending" };
    expect(nextSortState(asc, "count")).toEqual({
      columnKey: "count",
      direction: "descending",
    });
    expect(nextSortState({ columnKey: "count", direction: "descending" }, "count")).toBeNull();
  });
});

describe("ariaSortFor", () => {
  it("reports 'none' on EVERY column while no column is active (decision 5)", () => {
    for (const column of COLUMNS) {
      expect(ariaSortFor(null, column.key)).toBe("none");
    }
  });

  it("reports the direction on the active column and 'none' on all others", () => {
    const state: SortState = { columnKey: "count", direction: "descending" };
    expect(ariaSortFor(state, "count")).toBe("descending");
    expect(ariaSortFor(state, "name")).toBe("none");
    expect(ariaSortFor({ columnKey: "name", direction: "ascending" }, "name")).toBe("ascending");
  });
});
