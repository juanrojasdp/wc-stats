"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { useSortAnnounce } from "@/components/SortAnnouncer";
import { Button } from "@/components/ui/button";
import type { Leaderboard, Leaderboards } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { fetchArtifact } from "@/lib/data";
import { includesText, formatInteger } from "@/lib/format";
import { playerHref, teamHref } from "@/lib/hub-model";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  formatLeaderboardValue,
  leaderboardUnitKey,
  perMatchFormat,
} from "@/lib/leaderboard-format";
import type { SortState, TableColumn } from "@/lib/table-sort";
import {
  LEADERBOARD_FORMAT,
  LEADERBOARD_UNIT,
  anyDistinctTeam,
  anyPerMatch,
  leaderboardMetricAbbrKey,
  leaderboardMetricKey,
  leaderboardRows,
  type LeaderboardTableRow,
} from "@/viz/leaderboard-model";

/*
 * THE RUNTIME HALF of Líderes del torneo (Story 2.13, AC 1 / AC 4). Mirrors
 * `MatchBundleRegion`: the server page renders the hero-altitude teasers from a
 * build-time read, and this fetches the artifact on mount for the full sortable
 * tables.
 *
 * THIS FETCH IS "THE INITIALLY LOADED INDEX" FR-26 PERMITS, and it is the ONLY
 * network this surface may ever do. Everything after it — every sort, every
 * keystroke in every filter — is client-side over the held payload. Task 10.2
 * measures that rather than asserting it.
 *
 * THE STATUS MACHINE IS `MatchBundleRegion`'s, deliberately UNCHANGED: Story
 * 2.12's D1 rules the same machine for the sibling results/standings region on
 * this same route, and two regions on one page answering a failed fetch
 * differently is a defect the reader meets and neither story would see alone.
 * "error" and "invalid" stay distinct (2.5 review): a fetch that failed is a
 * network problem a reader can retry; a payload that ARRIVED INTACT and then
 * failed the schemaVersion gate is a data-integrity problem, and a retry button
 * would re-fetch the identical bad artifact forever.
 */
type Status = "loading" | "loaded" | "error" | "invalid";

/** Wraps a unit in a column head — the ExpertLayer pattern (i18n gate). */
const UNIT_OPEN = " (";
const UNIT_CLOSE = ")";
const CAPTION_SEPARATOR = " — ";
const COUNT_SEPARATOR = " ";
const ANNOUNCE_SEPARATOR = ": ";
/** The one absent-cell glyph, for a nullable column that survived its gate. */
const EM_DASH = "—";
/*
 * How long a filter must be idle before its result count is announced. Long
 * enough that ordinary typing produces ONE utterance rather than one per
 * character; short enough that a reader who stops typing is not left waiting.
 */
const ANNOUNCE_SETTLE_MS = 400;

/*
 * PREFETCH IS OFF ON EVERY LEADERBOARD LINK, AND AC 4 IS WHY.
 *
 * FOUND BY MEASUREMENT, NOT BY READING (Task 10.2). With Next's default
 * prefetching, `performance.getEntriesByType("resource").length` went 48 -> 75
 * across one sort and one filter clear: every `<Link>` entering the viewport
 * fired a route fetch, so 27 requests landed for actions AC 4 requires to be
 * "instant and client-side — ZERO NETWORK beyond the initially loaded index".
 * Re-ordering 20 rows re-runs that on every sort.
 *
 * It is also pure waste today: `/players/{slug}` and `/teams/{slug}` are UNBUILT
 * (Stories 2.15 / 2.16), so each prefetch is a round trip for a route that does
 * not exist. And the fixtures make it worse rather than better — 19 of 20
 * player slugs and 5 of 6 team slugs have no profile artifact yet.
 *
 * The links themselves are unchanged and stay real anchors (ruling 3, UX-DR22):
 * this turns off speculative loading, never navigation.
 */
const PREFETCH = false;

/** Developer-facing console label, never user copy — so a const, not a t() call. */
export const LEADERBOARDS_LOG_LABEL = "LeaderboardsRegion render failed";

export function LeaderboardsRegion() {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [payload, setPayload] = useState<Leaderboards | null>(null);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef<HTMLDivElement>(null);

  // Retry unmounts the panel that owns focus, which would drop the caret to
  // <body>; moving it to the named, aria-busy skeleton keeps a keyboard or
  // screen-reader user oriented. MatchBundleRegion's patch, same shape.
  useEffect(() => {
    if (attempt > 0) {
      busyRef.current?.focus();
    }
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    fetchArtifact<Leaderboards>("/index/leaderboards.json")
      .then((received) => {
        if (cancelled) {
          return;
        }
        /*
         * SCHEMA_VERSION comes from the generated constant and is NEVER
         * hardcoded — the artifact is at 4 today and change-set CS-2 moved it
         * there from 3 during this story's own epic.
         */
        /*
         * `boards` IS TYPED NON-NULL, WHICH PROVES NOTHING HERE — this is the
         * untyped fetch boundary and the type is a cast. A truncated artifact
         * carrying the right schemaVersion reached `boards.length` and threw a
         * TypeError, which the error boundary swallowed into a generic
         * fallback instead of the ruled empty state. "invalid" is the correct
         * destination for both: the payload ARRIVED INTACT and then failed a
         * structural check, so a retry cannot change the answer. Found at the
         * 2.13 code review.
         */
        if (received.schemaVersion !== SCHEMA_VERSION || !Array.isArray(received.boards)) {
          setStatus("invalid");
          return;
        }
        setPayload(received);
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="mt-layer-gap">
      {/*
       * THE RESOLVED/FAILED ANNOUNCEMENT, which this region shipped WITHOUT —
       * while `MatchBundleRegion` and `TournamentHubRegion`, the two siblings
       * whose status machine this one claims to mirror, both announce theirs. On
       * `/` that meant a screen-reader user was told when results and standings
       * arrived and nothing at all when the leaderboards did: the aria-busy
       * skeleton simply vanished. Precisely the two-regions-answering-
       * differently defect the docblock above says it avoided. Found at the 2.13
       * code review.
       *
       * This is a STATUS region, not the sort announcer — 2.11a decision 9
       * governs the one polite region for SORT, which is still the single
       * page-level `SortAnnouncerProvider`.
       */}
      <span aria-live="polite" className="sr-only">
        {status === "loaded" ? t("leaderboards.loaded") : null}
        {status === "error" ? t("leaderboards.error") : null}
        {status === "invalid" ? t("leaderboards.invalid") : null}
      </span>

      {status === "loading" ? (
        <div
          ref={busyRef}
          tabIndex={-1}
          /*
           * `role="group"` IS LOAD-BEARING, not decoration. A <div> with no role
           * maps to `role="generic"`, for which ARIA declares name-from-author
           * PROHIBITED — so the aria-label below was being dropped, axe's
           * `aria-prohibited-attr` flags it, and the retry `focus()` above
           * landed on an unnamed node that announced nothing. That made the
           * whole keep-the-user-oriented patch inert. `group` is the minimal
           * role that legitimately takes a name and adds no live region.
           * Found at the 2.13 code review.
           */
          role="group"
          aria-busy="true"
          aria-label={t("leaderboards.loading")}
          className="grid grid-cols-1 gap-tile-gap"
        >
          {/* Layout-shaped: a board heading over a block of table rows, twice. */}
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-40 w-full" />
          <div className="skeleton mt-6 h-6 w-48" />
          <div className="skeleton h-40 w-full" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <p className="type-body text-destructive">{t("leaderboards.error")}</p>
          <Button
            variant="destructive"
            onClick={() => {
              setStatus("loading");
              setPayload(null);
              setAttempt((a) => a + 1);
            }}
            className="mt-3 min-h-11"
          >
            {t("leaderboards.retry")}
          </Button>
        </div>
      ) : null}

      {/* No retry: re-fetching the same artifact cannot change the answer. */}
      {status === "invalid" ? (
        <EmptyStatePanel
          headline={t("leaderboards.invalid")}
          explanation={t("leaderboards.invalidExplanation")}
        />
      ) : null}

      {status === "loaded" && payload !== null ? (
        <LeaderboardTables boards={payload.boards} />
      ) : null}
    </div>
  );
}

function LeaderboardTables({ boards }: { boards: readonly Leaderboard[] }) {
  const t = useT();
  /*
   * `[]` IS "READY WITH ZERO BOARDS", not absence — the contract states
   * "Empty array and null are distinct states" verbatim, and 2.11b's review
   * found the live consequence of conflating them (50 sortable headers over an
   * empty body with no explanation). `headline`/`explanation` are the panel's
   * prop names SPECIFICALLY because message/caption/heading/text/description/
   * label are all gated prop names — do not rename them.
   */
  if (boards.length === 0) {
    return (
      <EmptyStatePanel
        headline={t("leaderboards.empty")}
        explanation={t("leaderboards.emptyExplanation")}
      />
    );
  }
  return (
    <>
      {/*
       * THE HEADING RENDERS ONLY OVER SOMETHING (2.13 code review). It sat in
       * `LeaderboardsSection`, outside every status branch, so "Tablas
       * completas" headed the error, invalid and empty panels alike — a
       * document-outline heading owning nothing.
       */}
      <h3 className="type-title text-ink-secondary">{t("leaderboards.tablesHeading")}</h3>
      <div className="mt-tile-gap grid grid-cols-1 gap-layer-gap">
        {/*
         * Driven off `boards.length`, never off 3. The fixture happens to carry
         * three boards; Story 1.17's emission carries thirty-six. Nothing here
         * assumes either scale — and past INITIALLY_OPEN_BOARDS the tables are
         * collapsed rather than mounted, which is what keeps 2,965 rows off the
         * page (ruling B).
         */}
        {boards.map((board, index) => (
          <LeaderboardBoard
            key={`${board.scope}-${board.metricCode}`}
            board={board}
            initiallyOpen={index < INITIALLY_OPEN_BOARDS}
          />
        ))}
      </div>
    </>
  );
}

/**
 * How many boards mount their table without being asked (ruled by Juan at the
 * 2.13 code review).
 *
 * The real emission is 36 boards / 2,965 rows / largest board 190 rows, which
 * mounted at once is roughly 15,000 cells and 3,000 anchors — on a route held
 * to Lighthouse >= 90, and with every one of those tables re-running `sortRows`
 * on each parent render. A per-board disclosure bounds the DOM without deciding
 * either the board roster or the row cap, both of which are Story 1-17's unruled
 * D3/D5; this story stays indifferent to them, as its Dev Notes require.
 *
 * Three, so the 3-board fixture renders exactly as before and the collapse is a
 * real-data behaviour rather than a change to what the export contains.
 */
const INITIALLY_OPEN_BOARDS = 3;

/** One board: its heading, its name filter and its full sortable table. */
function LeaderboardBoard({ board, initiallyOpen }: { board: Leaderboard; initiallyOpen: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const announce = useSortAnnounce();
  const filterId = useId();
  const panelId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(initiallyOpen);
  /*
   * THE SORT LIVES HERE, not inside `DataTable` — 2.12's controlled prop pair.
   * See the DataTable call below for the defect this fixes: the empty-state
   * branches swap the table out, and private component state does not survive
   * an unmount.
   */
  const [sortState, setSortState] = useState<SortState | null>(null);

  const rows = leaderboardRows(board);
  const unit = LEADERBOARD_UNIT[board.metricCode];
  const format = LEADERBOARD_FORMAT[board.metricCode];
  const unitKey = leaderboardUnitKey(unit);
  const unitSuffix = unitKey === null ? "" : `${UNIT_OPEN}${t(unitKey)}${UNIT_CLOSE}`;

  const fullTerm = t(leaderboardMetricKey(board.metricCode));
  const abbrKey = leaderboardMetricAbbrKey(board.metricCode);
  /*
   * A board's identity is `metricCode` + `scope` — the artifact carries no id
   * and no title — so the heading names both. It is also the table's
   * `tableName` and the stem of its caption, which is what makes three
   * captions on one page DISTINCT (i18n.test.ts pins that property).
   */
  const heading = `${fullTerm}${t("leaderboards.boardSeparator")}${t(
    board.scope === "team" ? "leaderboards.scope.team" : "leaderboards.scope.player"
  )}`;
  const caption = `${heading}${CAPTION_SEPARATOR}${t("leaderboards.tableCaption")}`;

  /*
   * THE FILTER NARROWS THE ARRAY BEFORE IT REACHES `DataTable` (ruling 4).
   * That is the shipped convention — `ExpertLayer` filters and passes `rows` —
   * and it is why filtering needs NO change to the shared table: no prop, no
   * TableColumn field, no fork.
   */
  const showTeam = anyDistinctTeam(rows);
  /*
   * THE NEEDLE IS TRIMMED (2.13 code review). `includesText` folds accents and
   * case but not whitespace, so a single typed space — or a trailing one after
   * pasting a name — matched nothing on any board whose names are single tokens.
   * Every team name is one ("México", "Brasil"), so a team board emptied itself
   * over an input that still looked blank. Trimmed HERE rather than inside
   * `includesText`, because "" matching everything is correct substring
   * semantics for a general matcher; it is the FILTER that should ignore
   * surrounding space.
   */
  const needle = query.trim();
  const visibleRows = rows.filter(
    (row) =>
      includesText(row.entityName, needle) || (showTeam && includesText(row.teamName, needle))
  );

  /*
   * ANNOUNCE THE RESULT COUNT — ON A SETTLED VALUE, not per keystroke.
   *
   * `DataTable`'s own `announce()` fires ONLY from its sort handler, so a
   * row-set change is silent today — a filed ledger item, and one this story
   * must not reproduce on a control it is adding. But announcing on every
   * `onChange` queued one utterance PER CHARACTER into the single polite region
   * this route shares with every sort announcement on both the leaderboards and
   * the Hub's own tables; typing an eight-letter name queued eight, and a screen
   * reader read stale counts trailing the typing while clobbering any in-flight
   * sort announcement. Found at the 2.13 code review.
   *
   * `visibleRows` above already computes this array on the render pass, so the
   * count is read from it rather than re-filtering — the handler used to run the
   * same O(n) scan a second time.
   */
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (announceTimer.current !== null) {
        clearTimeout(announceTimer.current);
      }
    };
  }, []);

  function handleQuery(next: string): void {
    setQuery(next);
    if (announceTimer.current !== null) {
      clearTimeout(announceTimer.current);
    }
    const settled = next.trim();
    const count = rows.filter(
      (row) =>
        includesText(row.entityName, settled) || (showTeam && includesText(row.teamName, settled))
    ).length;
    const sentence =
      count === 0
        ? t("leaderboards.filterNoResults")
        : `${formatInteger(count, locale)}${COUNT_SEPARATOR}${
            count === 1 ? t("leaderboards.filterResultsOne") : t("leaderboards.filterResults")
          }`;
    announceTimer.current = setTimeout(() => {
      announce(`${heading}${ANNOUNCE_SEPARATOR}${sentence}`);
    }, ANNOUNCE_SETTLE_MS);
  }

  const columns = buildColumns();

  function buildColumns(): readonly TableColumn<LeaderboardTableRow>[] {
    const entityIsTeam = board.scope === "team";
    return [
      {
        key: "rank",
        headText: t("leaderboards.columns.rank"),
        headTitle: null,
        render: (row) => formatInteger(row.rank, locale),
        align: "numeric",
        sort: { kind: "number", valueOf: (row) => row.rank },
      },
      {
        key: "entity",
        headText: t(entityIsTeam ? "viz.table.team" : "viz.table.player"),
        headTitle: null,
        /*
         * EVERY ROW LINKS (ruling 3, UX-DR22). Both routes are unbuilt today
         * and that is the SHIPPED PRECEDENT rather than a departure —
         * `LineupsDisclosure` and `MatchHero` already emit both, with tests
         * pinning them green, and EXPERIENCE.md's IA table lists the Player
         * Profile as "Reached from: Leaderboards". AD-3 makes the entity id the
         * slug, so the href needs nothing from 2.15. `href` is NOT one of the
         * sixteen gated prop names, so these literals are legal.
         */
        render: (row) => (
          <Link
            href={entityIsTeam ? teamHref(row.entityId) : playerHref(row.entityId)}
            prefetch={PREFETCH}
            className="underline underline-offset-2 hover:no-underline"
          >
            {row.entityName}
          </Link>
        ),
        align: "text",
        rowHeader: true,
        // The RENDERED SEMANTIC VALUE, never the href: sorting on a URL would
        // order by route prefix and would not re-collate under the EN toggle.
        sort: { kind: "text", valueOf: (row) => row.entityName },
      },
      /*
       * THE TEAM COLUMN IS PRESENT-GATED, not em-dashed. On a team-scope board
       * `team` repeats `entity` on every row — measured true on 12/12 fixture
       * team rows, and true by contract ("equal to entity on a team-scoped
       * board"). A duplicated column costs the same width as a useful one,
       * which is the whole problem at 390px. The spread-empty-array + `as
       * const` idiom is `ExpertLayer`'s.
       */
      ...(showTeam
        ? ([
            {
              key: "team",
              headText: t("viz.table.team"),
              headTitle: null,
              render: (row: LeaderboardTableRow) => (
                <Link
                  // `teamHref`, not a template literal (ledger A28). This was
                  // the LAST hand-written `/teams/${…}/` in the app; the
                  // entity-column link twenty lines above already routes
                  // through the helper, so the same table shipped the route
                  // shape two different ways.
                  href={teamHref(row.teamId)}
                  prefetch={PREFETCH}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  {row.teamName}
                </Link>
              ),
              align: "text" as const,
              sort: { kind: "text" as const, valueOf: (row: LeaderboardTableRow) => row.teamName },
            },
          ] as const)
        : []),
      {
        /*
         * THE VALUE COLUMN'S HEAD IS THE METRIC LABEL — the abbreviation when
         * one is ruled, else the full term — and the UNIT RIDES THE HEAD, never
         * the cell (es.ts ruled decision 4: "the unit NEVER rides the label …
         * composed at the call site, and never per cell"). `headTitle` carries
         * the full term behind an abbreviation, and Task 5's composition is
         * what gets it into the accessible name as well as the tooltip.
         */
        key: "value",
        headText: `${abbrKey === null ? fullTerm : t(abbrKey)}${unitSuffix}`,
        headTitle: abbrKey === null ? null : fullTerm,
        render: (row) => formatLeaderboardValue(row.value, format, locale),
        align: "numeric",
        // The RAW numeric, never the formatted string: a thousands separator
        // would make "1.234" collate before "9".
        sort: { kind: "number", valueOf: (row) => row.value },
      },
      {
        key: "matchesPlayed",
        headText: t("leaderboards.columns.matchesPlayed"),
        headTitle: null,
        render: (row) => formatInteger(row.matchesPlayed, locale),
        align: "numeric",
        sort: { kind: "number", valueOf: (row) => row.matchesPlayed },
      },
      /*
       * `perMatch` is contract-nullable and null on 20/20 fixture topSpeed rows
       * — a maximum is not meaningfully rateable. Gated away rather than
       * rendered as a column of em dashes.
       */
      ...(anyPerMatch(rows)
        ? ([
            {
              key: "perMatch",
              headText: `${t("leaderboards.columns.perMatch")}${unitSuffix}`,
              headTitle: null,
              render: (row: LeaderboardTableRow) =>
                row.perMatch === null
                  ? EM_DASH
                  : formatLeaderboardValue(row.perMatch, perMatchFormat(format), locale),
              align: "numeric" as const,
              // NULL, never 0: compareNumberNullLast sorts nulls to the array
              // END in both directions, while a 0 would sort them into the
              // middle of the order and claim a rate the metric does not have.
              sort: {
                kind: "number" as const,
                valueOf: (row: LeaderboardTableRow) => row.perMatch,
              },
            },
          ] as const)
        : []),
    ];
  }

  const filterLabel = t("leaderboards.filterLabel");
  const filterPlaceholder = t("leaderboards.filterPlaceholder");

  return (
    /*
     * `min-w-0` IS LOAD-BEARING, NOT COSMETIC — WCAG 1.4.10, measured.
     *
     * This <article> is a GRID ITEM, and a grid item's default `min-width` is
     * `auto`, which refuses to shrink below its content's min-content width. A
     * table is as wide as its columns demand, so the article was sized BY THE
     * TABLE and the `overflow-x-auto` wrapper below could never engage: at a
     * 390px viewport `document.body.scrollWidth` measured 457 against a
     * clientWidth of 375 — an 82px DOCUMENT scroll in ES (58px in EN, the
     * narrower labels), which is a reflow failure rather than the data-table
     * exception.
     *
     * With `min-w-0` the article shrinks, the wrapper becomes the scrollport
     * (437px of table in 343px, scrolling sideways as intended) and the
     * document sits at exactly 375/375. Same family as the 2.11b lesson that
     * `truncate` inside a table cell WIDENS the column instead of truncating.
     */
    <article className="min-w-0">
      <h4 className="type-title text-ink-primary">{heading}</h4>
      <p className="type-caption mt-1 text-ink-secondary">
        {t(board.higherIsBetter ? "leaderboards.higherIsBetter.true" : "leaderboards.higherIsBetter.false")}
      </p>

      {/*
        * THE PER-BOARD DISCLOSURE (ruled by Juan at the 2.13 code review).
        *
        * Past INITIALLY_OPEN_BOARDS the filter and the table are not merely
        * hidden, they are NOT MOUNTED — that is the whole point: the real
        * emission's 36 boards / 2,965 rows mounted at once is ~15,000 cells and
        * ~3,000 anchors, with each table re-running `sortRows` on every parent
        * render, on a Lighthouse->=90 route. A plain <button aria-expanded> +
        * conditional render, which is the shipped disclosure shape; no new
        * primitive is vendored (`components/ui/**` stays off-limits) and 2.12's
        * "Más columnas" disclosure is a different control this does not touch.
        */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="mt-tile-gap min-h-11 rounded-md border border-hairline px-3 type-stat-label text-ink-secondary"
      >
        {open ? t("leaderboards.hideTable") : t("leaderboards.showTable")}
      </button>

      {open ? (
        <div id={panelId}>
          <div className="mt-tile-gap">
            <label htmlFor={filterId} className="type-stat-label block text-ink-secondary">
              {filterLabel}
            </label>
            <input
              id={filterId}
              type="search"
              value={query}
              onChange={(event) => handleQuery(event.target.value)}
              /*
               * `placeholder` and `aria-label` are gated prop names, so both are
               * resolved into consts first. The visible <label> is the accessible
               * name; the placeholder is a hint and never the only label.
               */
              placeholder={filterPlaceholder}
              className="mt-1 min-h-11 w-full max-w-xs rounded-md border border-hairline bg-surface-raised px-3 type-body text-ink-primary"
            />
          </div>

          <div className="mt-tile-gap overflow-x-auto">
            {/*
             * THREE STATES, NOT TWO (2.13 code review). A board that ARRIVED
             * with zero rows is not a filter that excluded them: the single
             * `visibleRows.length === 0` branch told a reader with an empty
             * filter box to "borrar letras para ver más filas" — delete letters
             * they never typed. The contract's "empty array and null are
             * distinct states" applies one level down as well.
             */}
            {rows.length === 0 ? (
              <EmptyStatePanel
                headline={t("leaderboards.boardEmpty")}
                explanation={t("leaderboards.boardEmptyExplanation")}
              />
            ) : visibleRows.length === 0 ? (
              <EmptyStatePanel
                headline={t("leaderboards.filterNoResults")}
                explanation={t("leaderboards.filterNoResultsExplanation")}
              />
            ) : (
              /*
               * NO `sticky`: it is only correct inside a caller-supplied
               * HEIGHT-BOUNDED scrollport, and this story renders none. Do not
               * add a height to close it — that is 2.11a's recorded departure
               * and 2.11b's bounded container is where it was answered.
               *
               * `tableName` is mandatory here (2.11b): every table on this route
               * shares ONE live region, and without it every announcement is
               * ambiguous. This is the exact multi-table case the ledger routed
               * to "whichever story next opens" such a surface.
               *
               * CONTROLLED SORT (2.13 code review), using 2.12's prop pair. The
               * empty-state branches above swap this element out, and an
               * UNCONTROLLED DataTable keeps its sort in private useState — so
               * filtering to zero rows unmounted it and silently discarded the
               * sort. Sort by "Partidos", type a name that matches nothing,
               * backspace, and the table came back in artifact order with every
               * `aria-sort="none"` and no announcement. That is the very defect
               * 2.12 added `sortState`/`onSortChange` to fix, reproduced through
               * a different mechanism. Hoisting it here also survives a
               * column-set change from the presence gates.
               */
              <DataTable
                caption={caption}
                columns={columns}
                rows={visibleRows}
                surface="canvas"
                tableName={heading}
                sortState={sortState}
                onSortChange={setSortState}
              />
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
