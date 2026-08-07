import { formatDateShort, formatInteger } from "@/lib/format";
import type { DictionaryKey, Locale } from "@/lib/i18n";
import { formatLeaderboardValue, leaderboardUnitKey } from "@/lib/leaderboard-format";
import type { LeaderboardFormat, LeaderboardUnit } from "@/viz/leaderboard-model";
import type { SpeedZone } from "@/viz/player-profile-model";

/*
 * `/players/{slug}`'s number, unit and label composition (Story 2.15, AD-7).
 *
 * IT LIVES IN src/lib/ AND NOT IN src/viz/ for the reason `leaderboard-format.ts`
 * and `table-sort.ts` do: it imports `@/lib/format`, which `src/viz/**` keeps out
 * by design discipline so the pure models stay locale-free.
 *
 * IT IS NOT IN ANY COMPONENT, which is 2.11c's precedent rather than a
 * preference: pulling shared logic through a `"use client"` module makes the
 * suite import React (and transitively radix) under `environment: "node"` —
 * green today, opaque the day anything in that chain touches `window` at module
 * scope.
 *
 * NOTHING HERE RESOLVES COPY. Every function takes already-resolved strings or
 * returns a `DictionaryKey`; the SECTION owns `t()`.
 */

/** Composition glyphs are module consts — `aria-label` and friends are gated. */
const UNIT_OPEN = " (";
const UNIT_CLOSE = ")";
const CLAUSE_SEPARATOR = ", ";
const SENTENCE_SEPARATOR = ". ";
const RANGE_SEPARATOR = " – ";

/* ------------------------------- Values ------------------------------------ */

/**
 * One profile value, formatted. Delegates to the shipped leaderboard formatter
 * so this route and the leaderboards cannot print the same metric two ways.
 *
 * The `format` argument comes from `profileMetricFormat`, NOT from
 * `LEADERBOARD_FORMAT` directly — see that function for why `totalDistance`
 * differs on a profile.
 */
export function formatProfileValue(
  value: number,
  format: LeaderboardFormat,
  locale: Locale
): string {
  return formatLeaderboardValue(value, format, locale);
}

/** Minutes, appearances and shirt numbers — 0 dp with locale grouping. */
export function formatCount(value: number, locale: Locale): string {
  return formatInteger(value, locale);
}

/**
 * A trend point's x-axis label: the match date, abbreviated (D6, as amended).
 *
 * THE STORY'S D6 ASKED FOR THE OPPONENT'S TEAM CODE AND THAT FIELD DOES NOT
 * EXIST ON THIS ROUTE. `PlayerMatchRow.opponent` is an `EntityRef` — `{id,
 * name}` — and `teamCode` lives only on `MatchMetadata.homeTeam/awayTeam` and on
 * `tournament.json`'s `entities.teams[]`. Neither is reachable from a player
 * profile: the region fetches ONE artifact (FR-26), the ids are not derivable
 * into codes ("south-africa" is RSA, "korea-republic" is KOR), and on the
 * fixture manifest only Mexico is listed at all, so 4 of a 5-match series would
 * resolve to nothing even with a second fetch.
 *
 * The date satisfies D6's actual criterion — "the only per-point label that is
 * meaningful across all six metrics" — is chronological (matching the x
 * ordering), is uniform-width, and is a formatting of a verbatim artifact field
 * rather than a derivation. The OPPONENT is not lost: it is carried in the data
 * table alternative behind "Ver los datos", in the figure summary, and in the
 * per-match table directly below, all on the same artifact slice (NFR-2).
 */
export function formatTrendPointLabel(isoDate: string, locale: Locale): string {
  return formatDateShort(isoDate, locale);
}

/* ------------------------------- Labels ------------------------------------ */

/**
 * `"Distancia total (m)"` — the metric term with its unit, AS A STRING.
 *
 * COMPOSED HERE RATHER THAN IN JSX, which is `StoryStatTiles`' and
 * `KeyStatisticsSection.statLabel`'s pattern and is enforced: the JSX form
 * `{t(a)} ({t(b)})` emits `" ("` and `")"` as literal children and fails the
 * i18n gate.
 *
 * THE UNIT RIDES THE ROW-HEADER LABEL ON THIS ROUTE, and that is a scoped
 * departure from 2.13/2.11b's "the unit goes in the COLUMN HEAD, never
 * per-cell" (ruled D5). Their rule presumes one metric per column; the
 * aggregates table is TRANSPOSED — eighteen metrics spanning Count, Metres,
 * KmPerHour and Percentage share ONE value column — so there is no head that
 * could carry a unit. The row header is the only per-metric label there is.
 *
 * A PERCENTAGE TAKES NO SUFFIX. `leaderboardUnitKey` returns null for
 * `percent` and `count`, and `formatPercent` appends "%" itself with NO space
 * before it (a deliberate, logged choice against RAE spacing) — so a
 * "Precisión de pase (%)" head would print the sign twice.
 */
export function composeMetricLabel(term: string, unitLabel: string | null): string {
  return unitLabel === null ? term : `${term}${UNIT_OPEN}${unitLabel}${UNIT_CLOSE}`;
}

/**
 * The `enums.unit.*` key for a metric's unit, or `null` for the unitless
 * families — `leaderboardUnitKey` verbatim, re-exported.
 *
 * IT ADDS NO BEHAVIOUR AND IS NOT MEANT TO. The docblock previously said
 * "re-exported for one import" and there are four (`PlayerHero`,
 * `PlayerAggregatesSection`, `TrendsSection`, and this module's own test);
 * corrected at code review 2026-08-07 rather than deleted, because every one of
 * those call sites pairs it with `composeMetricLabel` from this module, and one
 * import line for the label pair reads better at the call site than two from
 * two modules. Anything that needs the unit key WITHOUT the label composition
 * should import `leaderboardUnitKey` from `@/lib/leaderboard-format` directly.
 */
export function profileUnitKey(unit: LeaderboardUnit): DictionaryKey | null {
  return leaderboardUnitKey(unit);
}

/** `expert.field.distanceZone1..5` — "Zona 1" … "Zona 5". REUSED, never minted. */
export function speedZoneLabelKey(zone: SpeedZone): DictionaryKey {
  return `expert.field.distanceZone${zone}` as DictionaryKey;
}

/**
 * `expert.fieldTitle.distanceZone1..5` — the BAND DESCRIPTORS, "0-7 km/h" …
 * "25 km/h o más". Already shipped by Story 2.11b; D12 rules them reused rather
 * than restated, because two sources for one band boundary is how they diverge.
 */
export function speedZoneBandKey(zone: SpeedZone): DictionaryKey {
  return `expert.fieldTitle.distanceZone${zone}` as DictionaryKey;
}

/** `player.started.yes` / `player.started.no` — a boolean is never printed raw. */
export function startedLabelKey(started: boolean): DictionaryKey {
  return started ? "player.started.yes" : "player.started.no";
}

/* -------------------------------- Axis width ------------------------------- */

/*
 * Y-AXIS WIDTH IS COMPUTED, NOT GUESSED, because the six trend series print
 * wildly different widths in the same slot: "0" for a goals axis and "16.290,4"
 * for a metres one. A single hardcoded width either clips the long labels or
 * wastes ~40 px of a 320 px plot on the short ones.
 *
 * It cannot be measured (no DOM in the model, and the axis must be sized BEFORE
 * recharts lays out), so it is estimated from the longest FORMATTED tick at the
 * 11 px `type-caption` tabular figure advance. Tabular numerals make that
 * advance constant by definition, which is the only reason an estimate is safe
 * here — and `tabular-nums` is on the tick style for exactly that reason.
 */
const TICK_CHAR_PX = 7;
const TICK_GUTTER_PX = 10;
const MIN_AXIS_PX = 30;
const MAX_AXIS_PX = 72;

/** Pixels to reserve for a value axis whose ticks format to `labels`. */
export function trendAxisWidth(labels: readonly string[]): number {
  const longest = labels.reduce((best, label) => Math.max(best, label.length), 0);
  return Math.min(MAX_AXIS_PX, Math.max(MIN_AXIS_PX, longest * TICK_CHAR_PX + TICK_GUTTER_PX));
}

/* ----------------------------- Figure summaries ---------------------------- */

/**
 * The trend figure's one-sentence `aria-label` (NFR-2 / UX-DR16).
 *
 * Composed from already-resolved fragments: t() has no interpolation, and
 * `aria-label` is one of the sixteen gated prop names, so every piece arrives as
 * an identifier.
 *
 * It NAMES THE MATCH WINDOW rather than reading the values out. A screen-reader
 * user's route to the numbers is the data-table alternative behind "Ver los
 * datos", which carries all six series; a summary that recited eight figures
 * would duplicate it badly and still not be sortable.
 */
export function composeTrendFigureSummary(input: {
  metricLabel: string;
  matchCount: string;
  firstLabel: string;
  lastLabel: string;
}): string {
  const { metricLabel, matchCount, firstLabel, lastLabel } = input;
  const window =
    firstLabel === lastLabel ? firstLabel : `${firstLabel}${RANGE_SEPARATOR}${lastLabel}`;
  return `${metricLabel}${CLAUSE_SEPARATOR}${matchCount}${SENTENCE_SEPARATOR}${window}`;
}

/** The speed-zone figure's one-sentence `aria-label`, on the same terms. */
export function composeZoneFigureSummary(input: {
  title: string;
  bandCount: string;
  unitLabel: string;
}): string {
  const { title, bandCount, unitLabel } = input;
  return `${title}${CLAUSE_SEPARATOR}${bandCount}${CLAUSE_SEPARATOR}${unitLabel}`;
}
