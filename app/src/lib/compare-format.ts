import type { CompareType } from "@/lib/compare-url";
import type { DictionaryKey, Locale } from "@/lib/i18n";
import { formatLeaderboardValue } from "@/lib/leaderboard-format";
import type { CompareFormat } from "@/viz/compare-model";

/*
 * THE `/compare` FORMAT AND COMPOSITION LAYER (Story 2.17).
 *
 * WHY IT IS NOT IN `src/viz`. Anything importing `@/lib/format` — directly or, as
 * here, through `@/lib/leaderboard-format` — lives in `src/lib`, "so the pure
 * models stay locale-free". `compare-model.ts` hands back raw numerics and
 * dictionary KEYS; every glyph, every `Intl` call and every composed sentence is
 * in this file.
 *
 * 🔴 EVERY SENTENCE HERE EXISTS BECAUSE `t()` HAS NO INTERPOLATION (ruled D11).
 * `i18n.ts:46` is `t(key, locale)` and nothing else, and the JSX form
 * `{t(a)} {value} {t(b)}` emits the two spaces as LITERAL CHILDREN and fails the
 * `react/jsx-no-literals` gate. So each sentence is assembled into a `const`
 * string from already-resolved fragments and rendered through one expression
 * container. `EmptyStatePanel.tsx:60-64` states the same rule for the same
 * reason, and 2.14 uses the idiom three times.
 *
 * NOTHING HERE DERIVES A CROSS-ENTITY NUMBER. These functions format ONE value at
 * a time, or join already-resolved strings. There is no subtraction, no ratio and
 * no combined total anywhere in this module — see `compare-model.ts`'s header for
 * the whitelist this route is held to (AD-5).
 */

/** Composition glyphs, hoisted: a bare literal in JSX trips the i18n gate. */
const SPACE = " ";
const CLAUSE_SEPARATOR = " — ";
const VERSUS_SEPARATOR = " / ";

/* -------------------------------- Key builders ----------------------------- */

/**
 * `compare.type.players` | `.teams` | `.matches` — the SELECTOR's segments.
 *
 * 🔴 MINTED RATHER THAN REUSED, AND THE ARGUMENT IS THE DIFF (ruled D12).
 * `EXPERIENCE.md:322` is binding and specific — "Entity-type labels are
 * deliberately NOT a new row" — so this needs the counter-argument stated where
 * the next reader will find it:
 *
 *  · `viz.table.player` / `.team` and `hub.results.column.match` are SINGULAR
 *    COLUMN HEADS. AC 1 names the selector "Jugadores/Equipos/Partidos" — plural.
 *    A column head is not a filter label.
 *  · `leaderboards.scope.*` carries a docblock scoping it to "what the whole
 *    board ranks" — board vocabulary on a non-board surface, the same objection
 *    2.14 raised when it declined `leaderboards.filterLabel`.
 *  · `player.appearances.played` = "Partidos" is a COUNTER LABEL on one player's
 *    appearance line. Reusing it as a type-selector segment is a coincidence of
 *    spelling, not a shared term.
 *  · There is NO "Partidos" plural in the entity vocabulary at all, so even a
 *    full reuse strategy would have to mint one of the three — leaving the
 *    selector with two homes for one concept, which is strictly worse.
 *
 * Minted as a COHERENT TRIPLE for that last reason. Juan may overturn this; it
 * changes three keys and this docblock, and nothing else.
 */
export function compareTypeKey(type: CompareType): DictionaryKey {
  return `compare.type.${type}` as DictionaryKey;
}

/**
 * `compare.word.players` | `.teams` | `.matches` — the same three concepts
 * LOWERCASE, for use inside a sentence.
 *
 * NOT A DUPLICATE OF `compare.type.*`, and the empty state is why: "Elige dos
 * Jugadores para comparar." capitalises a common noun mid-sentence, which is
 * wrong in both languages. Spanish has no title case for common nouns, so the
 * selector segment and the sentence fragment are genuinely two forms of one term
 * rather than two names for it.
 */
export function compareWordKey(type: CompareType): DictionaryKey {
  return `compare.word.${type}` as DictionaryKey;
}

/* -------------------------------- Values ---------------------------------- */

/**
 * One compared value, formatted.
 *
 * Delegates to `formatLeaderboardValue`, which is the single home for all four
 * cases — so a metric printed on the leaderboards, on a profile and on this route
 * cannot acquire three precisions. `CompareFormat` is `LeaderboardFormat`'s union
 * exactly, so the delegation needs no mapping table and a new case there is a
 * compile error here.
 *
 * IT THROWS ON A NON-FINITE VALUE, through `@/lib/format`, and that is why
 * `compare-model.ts` guards at model entry: by the time the formatter sees a
 * number it can no longer name the entity or the field.
 */
export function formatCompareValue(
  value: number,
  format: CompareFormat,
  locale: Locale
): string {
  return formatLeaderboardValue(value, format, locale);
}

/* ------------------------------ Composed copy ------------------------------ */

/**
 * `"Elige dos jugadores para comparar."` — the picker-first empty state (AC 5).
 *
 * `EXPERIENCE.md:93` quotes the Spanish verbatim, so this IMPLEMENTS ruled copy
 * rather than authoring it. `typeWord` is the resolved `compare.word.*` value —
 * the lowercase in-sentence form, which is why that key group exists separately
 * from the capitalised `compare.type.*` selector segments.
 */
export function composeEmptyHeadline(input: {
  before: string;
  typeWord: string;
  after: string;
}): string {
  return `${input.before}${SPACE}${input.typeWord}${SPACE}${input.after}`;
}

/**
 * `"No encontramos brasil-99. Elige de la lista."` — the invalid-slug state.
 *
 * 🔴 THE SECOND SENTENCE SHIPS. AC 5 truncates the quote with an ellipsis;
 * `EXPERIENCE.md:94` carries "Elige de la lista." in full, and an invalid state
 * that names the failure without naming the recovery is half a message.
 *
 * `after` OPENS WITH THE PERIOD and is joined WITHOUT a space, so the sentence
 * closes tight against the slug — `"…brasil-99. Elige…"`, never `"…brasil-99 .
 * Elige…"`. The locale value carries the leading period for exactly this.
 *
 * The slug is the reader's own raw input echoed back. It is rendered as TEXT
 * through React, never as markup, so an injected string cannot become an element.
 */
export function composeInvalidHeadline(input: {
  before: string;
  slug: string;
  after: string;
}): string {
  return `${input.before}${SPACE}${input.slug}${input.after}`;
}

/**
 * A side's `<h2>` / mini-header name: the entity, then what it is.
 *
 * `"Julián QUIÑONES — México"`, `"México — Grupo A"`, `"México – Sudáfrica —
 * Fase de grupos"`. `detail` is already composed by the caller from the artifact's
 * own fields; `null` collapses the clause entirely rather than dangling the
 * separator.
 */
export function composeSideHeading(name: string, detail: string | null): string {
  return detail === null || detail === "" ? name : `${name}${CLAUSE_SEPARATOR}${detail}`;
}

/**
 * The comparison figure's one-sentence `aria-label` (NFR-2 / UX-DR16).
 *
 * NAMES WHAT THE FIGURE SHOWS AND WHOSE IT IS; it does not read the values out.
 * A screen-reader user's route to the numbers is the data-table alternative
 * behind "Ver los datos" — a summary reciting sixteen figures would duplicate it
 * badly and still not be sortable. `composeTrendFigureSummary` takes the same
 * position for the same reason.
 */
export function composeCompareFigureSummary(input: {
  title: string;
  entityName: string;
  unitLabel: string | null;
}): string {
  const { title, entityName, unitLabel } = input;
  const head = `${title}${CLAUSE_SEPARATOR}${entityName}`;
  return unitLabel === null || unitLabel === "" ? head : `${head}${CLAUSE_SEPARATOR}${unitLabel}`;
}

/**
 * The two sides joined for one accessible name: `"México / Brasil"`.
 *
 * Used by the swap control and the comparison's own live-region announcement, so
 * a reader operating either knows which two entities are in play without leaving
 * the control. A neutral solidus rather than a word: it carries no direction, and
 * the sides genuinely have no home/away relationship on this route.
 */
export function composeSidesLabel(a: string, b: string): string {
  return `${a}${VERSUS_SEPARATOR}${b}`;
}
