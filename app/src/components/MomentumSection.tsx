"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";

/*
 * TYPE-ONLY. A value import from this module — it used to bring in
 * CHART_HEIGHT_CLASS — creates a static module-graph edge into the very module
 * next/dynamic exists to defer, linking recharts back onto the critical path and
 * quietly defeating decision 21. `import type` is erased at compile time and
 * carries no such edge; the height class now lives in the pure model module.
 */
import type { MomentumChartSide } from "@/components/MomentumChart";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { Goals, Momentum } from "@/lib/contract/contract-types";
import { formatInteger } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import { formatGoalMinute } from "@/lib/match-hero";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import {
  CHART_HEIGHT_CLASS,
  clampIndex,
  goalMarkers,
  momentumFigureCounts,
  momentumPeak,
  momentumRows,
  momentumTableRows,
  momentumTickIndices,
} from "@/viz/momentum-model";

/*
 * The #momentum content (Task 6). Owns the locale layer, the format layer and
 * the cursor state; MomentumChart owns recharts and receives resolved strings.
 *
 * THE SPLIT IS A CODE-SPLIT (ruled decision 21). recharts is ~147 kB gzipped
 * and pulls @reduxjs/toolkit, react-redux, immer and victory-vendor — larger
 * than everything currently in this app's client bundle. `momentum` is in
 * ALWAYS_EXPANDED_SECTION_IDS, so it gets NONE of UX-DR6's lazy-mount deferral
 * that TacticalSection was built to give the pitch panels. next/dynamic is what
 * keeps it off the Hero's and Key Statistics' critical path, which is NFR-1's
 * Lighthouse >= 90 budget.
 *
 * This is the codebase's FIRST next/dynamic, so there is no precedent to copy.
 */

/*
 * The loading fallback is a skeleton AT THE CHART'S EXACT HEIGHT. The `skeleton`
 * utility sets background, radius and pulse only and supplies NO DIMENSIONS, so
 * an unsized fallback collapses to ~0px and the chart then mounts at full
 * height. That is a CLS hit against the very budget the code-split protects —
 * and worse, it breaks the #momentum deep link, because TacticalLayer scrolls
 * on mount, before the dynamic chunk resolves, so the page would jump out from
 * under the reader.
 */
function ChartFallback() {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      <div aria-busy="true" className={cn("w-full rounded-md skeleton", CHART_HEIGHT_CLASS)} />
    </div>
  );
}

const MomentumChart = dynamic(
  () => import("@/components/MomentumChart").then((module) => module.MomentumChart),
  {
    // Legal by AR-11: TacticalLayer is already client-only, so no Tactical
    // markup exists in out/ and there is no server render to skip.
    ssr: false,
    loading: () => <ChartFallback />,
  }
);

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const SENTENCE_SEPARATOR = ". ";
const CLAUSE_SEPARATOR = ", ";
const SPACE = " ";
const PERIOD = ".";
const CAPTION_SEPARATOR = " — ";
const DOT_SEPARATOR = " · ";
const VERSUS_SEPARATOR = " – ";
const PAREN_OPEN = " (";
const PAREN_CLOSE = ")";

/** Below md the axis would collide at 15-minute steps on a 326px plot. */
const TICK_STEP_MD = 15;
const TICK_STEP_SM = 30;

export interface MomentumSectionProps {
  momentum: Momentum;
  goals: Goals;
  home: MomentumChartSide;
  away: MomentumChartSide;
}

function DataTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: { key: string; label: string; numeric: boolean }[];
  children: ReactNode;
}) {
  /*
   * {components.data-table} with CANVAS ink substitutions: text-ink-primary /
   * -secondary and border-hairline, never the pitch-scoped -on-pitch classes
   * and pitch-line/40 — this table renders on --surface-raised, not on the
   * green. Mixing the two token families is the exact defect Story 2.7's review
   * spent its headline finding on.
   *
   * NO overflow-x-auto here: ViewDataDisclosure's region already applies it,
   * and a second scroll container nests them.
   *
   * ==> 2.11 PLUG-IN POINT (decision 14): UX-DR12's sort contract — aria-sort,
   * Intl.Collator('es', {sensitivity:'base'}), polite live-region
   * announcements, a sticky header and a stated default sort — attaches to
   * these <th> elements and sorts momentumTableRows' output. ONE cross-table
   * contract, implemented once in 2.11; a bespoke second copy here is what 2.11
   * would then have to reconcile. UX-DR16/NFR-2's floor (a reachable table
   * carrying the same numbers) is met in full today.
   */
  return (
    <table className="w-full border-collapse text-left">
      <caption className="mb-2 text-left type-caption text-ink-secondary">{caption}</caption>
      <thead>
        <tr className="border-b border-hairline">
          {headers.map((header) => (
            <th
              key={header.key}
              scope="col"
              className={cn(
                "px-2 py-1.5 type-stat-label text-ink-secondary",
                header.numeric ? "text-right" : "text-left"
              )}
            >
              {header.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function MomentumSection({ momentum, goals, home, away }: MomentumSectionProps) {
  const t = useT();
  const { locale } = useLocale();
  const isMd = useMediaQuery(MD_MEDIA_QUERY);

  /*
   * Ephemeral component state (AR-10) — not the URL, not Context, not
   * localStorage. Clamped at READ time below, never synced in an effect
   * (PitchPanel's ruled shape; react-hooks/set-state-in-effect fires otherwise).
   */
  const [rawIndex, setRawIndex] = useState(0);

  const title = t("tactical.sections.momentum.title");

  /*
   * t() has no interpolation and no plural machinery, so counters pick a
   * singular or plural key at the call site. Copied from ShotMapsSection rather
   * than shared, by the current convention. The singulars that actually occur:
   * "1 entrada", "1 gol", "1 minuto".
   */
  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  /*
   * MEMOISED, and that is not a micro-optimisation. The cursor lives in this
   * component's state, so EVERY arrow keypress re-rendered it — and this
   * pipeline re-validated and re-allocated all 138 of m074's samples through the
   * read guards, re-resolved the goal markers (O(goals x rows) plus a sort), and
   * built another 138 table rows, per keystroke. The chart's own key handler
   * notes that repeats outrun React commits; this is why. A fresh `rows`
   * identity also forced recharts to recompute both area paths every time.
   *
   * Still built EAGERLY (decision 8): the throw happens on LOAD inside
   * TacticalErrorBoundary, not when a reader opens the table.
   *
   * `== null`, not `=== null`: a truncated `as`-cast bundle can carry an ABSENT
   * `momentum` key rather than an explicit null. `sectionDataState` classifies
   * that as "ready", so it reaches this component, and a `=== null` test let it
   * fall through to momentumRows and crash — the "a crash instead of an absence
   * is strictly worse" outcome this guard exists to prevent. (The matching
   * predicate in tactical-sections.ts has the same gap, but that file is on this
   * story's do-not-touch list and is filed to the ledger instead.)
   */
  const model = useMemo(() => {
    if (momentum == null) {
      return null;
    }
    const rows = momentumRows(momentum);
    const markers = goalMarkers(goals, rows);
    return {
      rows,
      markers,
      peak: momentumPeak(rows),
      tableRows: momentumTableRows(rows, markers),
      counts: momentumFigureCounts(rows, markers),
    };
  }, [momentum, goals]);

  const tickIndices = useMemo(
    () => (model === null ? [] : momentumTickIndices(model.rows, isMd ? TICK_STEP_MD : TICK_STEP_SM)),
    [model, isMd]
  );

  /*
   * The section-level branch in TacticalLayer already renders the dedicated
   * empty state ABOVE this component, so this is unreachable through the app.
   * It reads the field anyway for the same reason sectionDataState does: the
   * bundle is unvalidated `as`-cast JSON. `momentum: null` is the ONLY absence
   * state — an empty `samples` array is a contract violation and momentumRows
   * throws on it. Placed AFTER every hook, so no hook is ever conditional.
   */
  if (model === null) {
    return null;
  }

  const { rows, peak, markers, tableRows, counts } = model;
  const index = clampIndex(rawIndex, rows.length);
  const current = rows[index];

  /*
   * The metric is NAMED wherever a number is (decision 13). The contract is
   * emphatic that this series counts final-third distributions and is "NOT a
   * possession percentage and not an abstract momentum index; the App's own
   * copy must not imply otherwise" — while "momentum" itself is a ruled product
   * concept with a ruled i18n treatment. Naming the metric beside the numbers
   * closes that gap without re-litigating the ruled term.
   */
  const metricNote = t("viz.momentum.metricNote");

  /* ---------------- Composed strings: identifiers before gated props --------- */

  const minutesPhrase = countPhrase(
    counts.samples,
    "viz.momentum.minutesOne",
    "viz.momentum.minutes"
  );
  const goalsPhrase = countPhrase(counts.goals, "viz.momentum.goalsOne", "viz.momentum.goals");
  const figureLabel =
    `${t("viz.momentum.figurePrefix")} ${home.name}${VERSUS_SEPARATOR}${away.name}` +
    `${SENTENCE_SEPARATOR}${metricNote}${SPACE}${minutesPhrase}${CLAUSE_SEPARATOR}${goalsPhrase}${PERIOD}`;

  function entriesPhrase(count: number): string {
    return countPhrase(count, "viz.momentum.entriesOne", "viz.momentum.entries");
  }

  /*
   * aria-valuetext is a GATED prop and this slider is its first consumer, so it
   * is composed into an identifier here and never as a template literal in JSX.
   *
   * One sentence: the clock, then BOTH teams' values in STORED units (decision
   * 3). formatGoalMinute is imported from match-hero rather than re-implemented
   * — it is what renders "45+2′" everywhere else in the app. The stoppage offset
   * is the whole point: at half time a reader arrowing five times sits on five
   * samples that all announce minute 45, and only the offset distinguishes them.
   */
  const cursorValueText =
    `${t("viz.momentum.minutePrefix")} ${formatGoalMinute(current.at)}${SENTENCE_SEPARATOR}` +
    `${home.name} ${entriesPhrase(current.home)}${CLAUSE_SEPARATOR}` +
    `${away.name} ${entriesPhrase(current.away)}${PERIOD}`;

  const cursorLabel = t("viz.momentum.cursorLabel");

  // The visible chip carries the SAME facts as aria-valuetext (decision 23):
  // "63′ · MEX 4 · RSA 2". A bare minute would leave sighted users with less
  // than screen-reader users get, and no <Tooltip> ships at all.
  const chipClock = formatGoalMinute(current.at);
  const chipHome = `${home.teamCode} ${formatInteger(current.home, locale)}`;
  const chipAway = `${away.teamCode} ${formatInteger(current.away, locale)}`;

  const tickLabels = tickIndices.map((tickIndex) => formatGoalMinute(rows[tickIndex].at));

  /*
   * Decision 6 on the y axis: the [-peak, peak] domain would otherwise render
   * "-10 -5 0 5 10". The sign is geometry; the numbers a reader sees are counts.
   */
  function formatYTick(value: number): string {
    return formatInteger(Math.abs(value), locale);
  }

  const goalPrefix = t("viz.momentum.goalPrefix");
  const minutePrefix = t("viz.momentum.minutePrefix");
  const ownGoalQualifier = t("viz.momentum.ownGoal");
  const penaltyQualifier = t("viz.momentum.penalty");
  const approximateQualifier = t("viz.momentum.approximate");
  const unknownPlayer = t("viz.marker.unknownPlayer");
  const markerNames = markers.map((marker) => {
    const qualifiers: string[] = [];
    if (marker.ownGoal) {
      qualifiers.push(ownGoalQualifier);
    }
    if (marker.penalty) {
      qualifiers.push(penaltyQualifier);
    }
    /*
     * `exact: false` means the goal's (minute, stoppageMinute) is NOT on the
     * sample grid and the dot was placed on the nearest row instead. The flag was
     * computed, documented and tested — and then read by nobody, so the chart,
     * the table and this spoken name each asserted a different position with no
     * qualifier. That is the silent data lie the flag's own docblock says it
     * exists to prevent. No fixture exercises it; it is latent, not dead.
     */
    if (!marker.exact) {
      qualifiers.push(approximateQualifier);
    }
    // An absent scorerName is coerced to "" by the model, which would otherwise
    // speak "Gol de , minuto 8" — a double separator with no subject.
    const scorer = marker.scorerName === "" ? unknownPlayer : marker.scorerName;
    const tail =
      qualifiers.length === 0 ? PERIOD : `${PAREN_OPEN}${qualifiers.join(CLAUSE_SEPARATOR)}${PAREN_CLOSE}${PERIOD}`;
    return `${goalPrefix} ${scorer}${CLAUSE_SEPARATOR}${minutePrefix} ${formatGoalMinute(marker.at)}${tail}`;
  });

  /* ------------------------------- The table -------------------------------- */

  /*
   * The caption NAMES THE METRIC (decision 13's final enumerated site). Without
   * it the numeric columns are headed bare team codes under a "Línea de
   * momentum" caption, so "MEX 4" reads as a momentum index — exactly what the
   * contract forbids the App's copy from implying.
   */
  const tableCaption =
    `${title}${CAPTION_SEPARATOR}${metricNote}${SPACE}${t("viz.momentum.tableCaption")}`;
  const headers = [
    { key: "minute", label: t("viz.table.minute"), numeric: false },
    { key: "home", label: home.teamCode, numeric: true },
    { key: "away", label: away.teamCode, numeric: true },
    { key: "goal", label: t("viz.momentum.tableGoal"), numeric: false },
  ];
  const yes = t("viz.table.yes");
  /*
   * "No", not viz.table.unknown's em dash. Whether a goal fell on a sample is
   * KNOWN for every row, and it is "no" on 99 of m001's 101. The em dash is this
   * codebase's missing-data glyph and asserted absence of information where the
   * information exists — on the data-table surface UX-DR16/NFR-2 exist for.
   */
  const no = t("viz.table.no");
  const numericCell = "px-2 py-1.5 text-right type-table-numeric text-ink-primary";
  const textCell = "px-2 py-1.5 type-caption text-ink-primary";

  const dataTable = (
    <DataTable caption={tableCaption} headers={headers}>
      {tableRows.map((row) => (
        <tr key={row.key} className="border-b border-hairline">
          {/* RAW values only — never awayPlotted, never a negative number. */}
          <td className={cn(textCell, "tabular-nums")}>{formatGoalMinute(row.at)}</td>
          <td className={numericCell}>{formatInteger(row.home, locale)}</td>
          <td className={numericCell}>{formatInteger(row.away, locale)}</td>
          <td className={textCell}>{row.hasGoal ? yes : no}</td>
        </tr>
      ))}
    </DataTable>
  );

  const attribution = t("viz.attribution");
  const subtitle = `${metricNote}${DOT_SEPARATOR}${minutesPhrase}${DOT_SEPARATOR}${goalsPhrase}`;

  return (
    <div className="flex flex-col gap-tile-gap">
      {/*
       * A subtitle, NOT a heading: TacticalSection owns the <h2> and this panel
       * carries no title of its own, so promoting the metric note to an <h3>
       * would put a sentence that is not a section name into the page outline.
       */}
      <p className="type-stat-label text-ink-secondary">{subtitle}</p>
      <MomentumChart
        rows={rows}
        peak={peak}
        markers={markers}
        home={home}
        away={away}
        tickIndices={tickIndices}
        index={index}
        onIndexChange={setRawIndex}
        figureLabel={figureLabel}
        tickLabels={tickLabels}
        axisEntriesLabel={t("viz.momentum.axisEntries")}
        axisMinuteLabel={t("viz.momentum.axisMinute")}
        formatYTick={formatYTick}
        cursorLabel={cursorLabel}
        cursorValueText={cursorValueText}
        chipClock={chipClock}
        chipHome={chipHome}
        chipAway={chipAway}
        markerNames={markerNames}
      />
      <ViewDataDisclosure
        panelTitle={title}
        surface="canvas"
        trailing={<p className="type-caption text-ink-secondary">{attribution}</p>}
      >
        {dataTable}
      </ViewDataDisclosure>
    </div>
  );
}
