import type { DictionaryKey } from "@/lib/i18n";
import { isCollapsibleId } from "@/lib/tactical-sections";
import type {
  AlwaysExpandedSectionId,
  CollapsibleSectionId,
  SectionId,
} from "@/lib/tactical-sections";

/*
 * The glossary registry (Story 2.18, ruled decision 10). PURE: no React, no
 * DOM, no t(), no @/lib/format — it exports ids, the per-term policy decision
 * and dictionary KEYS; components resolve them. That split is the only reason
 * any of this story is testable in a node-only harness (no jsdom).
 *
 * WHAT THIS FILE IS FOR. EXPERIENCE.md's per-term policy table is the ruling;
 * nothing in the build chain has ever compared a shipped Spanish string to it.
 * This registry is the machine-readable half of that table, and i18n.test.ts's
 * exhaustiveness sweep is what makes it stick.
 *
 * A POLICY ROW IS NOT AUTOMATICALLY ONE ID (Task 2.2). Ten rows name a SET, and
 * an id of `stage-names` has no coherent term pair and no counterpart-language
 * subtitle, so set-rows are expanded to one id per member. Six rows are TABLE
 * SCAFFOLDING (stage names, lineup labels, result letters & standings columns,
 * fouls / duels, standings / leaderboards, Expert column groups) and get no
 * glossary id — they have no term pair to show and no definition to write.
 *
 * BUT "no glossary id" IS NOT "done" (2.18 code review corrected this docblock).
 * FIVE of the six are discharged in the locale files today — stage names
 * (`enums.stage`), lineup labels, Expert column groups, and, since Story 2.12,
 * `result letters & standings columns` (`enums.matchResult` V/E/D and W/D/L,
 * plus `hub.standings.column.*` PJ/G/E/P/GF/GC/DG/Pts) and
 * `standings / leaderboards` (`hub.standings.heading` "Tabla de posiciones" and
 * 2.13's `leaderboards.title` "Líderes del torneo"). All five are pinned in
 * `i18n.test.ts`.
 *
 * ONE ROW IS STILL UNDISCHARGED: `fouls / duels`. `duelos` ships
 * (`enums.possessionContest`), `faltas` occurs zero times in `es.ts`, and no
 * surface renders fouls yet — the Hub does not, because neither `StandingsRow`
 * nor `MatchResultRow` carries a fouls field at all. It stays DEFERRED to
 * whichever story first renders a fouls surface, and is recorded by name in
 * deferred-work.md. A story reading the pre-2.18 wording would have shipped a
 * standings table with no ruled vocabulary, believing the row was satisfied;
 * one reading the pre-2.12 wording would now believe three rows are open when
 * only one is.
 */

/**
 * Language-neutral English slugs (ruled decision 11). EXPERIENCE.md's IA rule:
 * slugs are English/romanized, stable and human-readable, and the URL carries
 * no language — so `/glossary/#build-up` works from both locales and does not
 * break when a Spanish term is amended.
 */
export type GlossaryTermId =
  | "line-break"
  | "counter-press"
  | "pressing"
  | "build-up"
  | "high-block"
  | "mid-block"
  | "low-block"
  | "line-height"
  | "team-length"
  | "phases-of-play"
  | "xg"
  | "pass-network"
  | "speed-zones"
  | "high-speed-run"
  | "sprint"
  | "take-on"
  | "step-in"
  | "second-ball"
  | "forced-turnover"
  | "ball-progression"
  | "reception-in-final-third"
  | "set-play"
  | "momentum"
  | "goal"
  | "on-target"
  | "off-target"
  | "blocked"
  | "incomplete"
  | "goalkeeper"
  | "save"
  | "distribution"
  // English slug, not the Spanish "salida" this shipped as (2.18 code review):
  // decision 11 requires language-neutral ids because the anchor is a public
  // URL that must not break when a Spanish term is amended.
  | "coming-off-the-line"
  | "one-on-one"
  | "defender"
  | "midfielder"
  | "forward"
  | "corner"
  | "offside"
  | "cross"
  | "offers-to-receive"
  | "movement-to-receive"
  | "defensive-actions";

/**
 * A FROZEN LIST IS A `Record`, NEVER A BARE ARRAY (Story 2.10 decision 16, and
 * the 2.9 review finding behind it): `readonly T[] = [...]` gives NO
 * compile-time exhaustiveness, and the i18n exhaustiveness suite compares
 * locale keys against that very array — so a widened union would slip past
 * both. Adding a member to `GlossaryTermId` without a row here is a type error.
 *
 * ORDER IS POLICY-TABLE ORDER, not alphabetical: alphabetical differs between
 * `es` and `en`, and /glossary renders this order to the reader.
 */
const GLOSSARY_ORDER: Record<GlossaryTermId, true> = {
  "line-break": true,
  "counter-press": true,
  pressing: true,
  "build-up": true,
  // Row "high / mid / low block" expanded to one id per member.
  "high-block": true,
  "mid-block": true,
  "low-block": true,
  "line-height": true,
  "team-length": true,
  "phases-of-play": true,
  xg: true,
  "pass-network": true,
  "speed-zones": true,
  "high-speed-run": true,
  sprint: true,
  "take-on": true,
  "step-in": true,
  "second-ball": true,
  "forced-turnover": true,
  "ball-progression": true,
  "reception-in-final-third": true,
  "set-play": true,
  momentum: true,
  // Row "shot outcomes (legend + log headers)" expanded to the FIVE stable
  // ShotOutcome values. ShotOutcomeDetail is deliberately absent (decision 12)
  // and STAYS absent now that CS-1 has landed (093a1b2) and its extended enum
  // exists in the contract: AD-14 decision CR-2 makes `outcome` authoritative,
  // so no glossary id names a detail value. (Stale-rationale fix, Story 2.13
  // ruling 5.) Decision 12 also says "do NOT hardcode the count anywhere, in
  // code, comment or copy" — this comment carried it until the 2.18 review.
  goal: true,
  "on-target": true,
  "off-target": true,
  blocked: true,
  incomplete: true,
  goalkeeper: true,
  save: true,
  // Row "goalkeeping vocabulary" (distribución / salidas / mano a mano).
  distribution: true,
  "coming-off-the-line": true,
  "one-on-one": true,
  // Row "positions"; its goalkeeper member reuses the id minted above.
  defender: true,
  midfielder: true,
  forward: true,
  corner: true,
  offside: true,
  cross: true,
  "offers-to-receive": true,
  "movement-to-receive": true,
  "defensive-actions": true,
};

export const GLOSSARY_TERMS: readonly GlossaryTermId[] = Object.keys(
  GLOSSARY_ORDER
) as GlossaryTermId[];

/**
 * The per-term decision EXPERIENCE.md's table rules: **translate** (a Spanish
 * term replaces the English one), **jargon** (the English term itself stays)
 * and **tooltip** (the English term stays AND carries a glossary gloss).
 * Glossary entries exist for every term regardless of the decision.
 */
export type GlossaryPolicy = "translate" | "jargon" | "tooltip";

export const GLOSSARY_POLICY: Record<GlossaryTermId, GlossaryPolicy> = {
  "line-break": "translate",
  "counter-press": "translate",
  pressing: "translate",
  "build-up": "translate",
  "high-block": "translate",
  "mid-block": "translate",
  "low-block": "translate",
  "line-height": "translate",
  "team-length": "translate",
  "phases-of-play": "translate",
  xg: "jargon",
  "pass-network": "translate",
  "speed-zones": "translate",
  "high-speed-run": "translate",
  sprint: "jargon",
  "take-on": "translate",
  "step-in": "translate",
  "second-ball": "translate",
  "forced-turnover": "translate",
  "ball-progression": "translate",
  "reception-in-final-third": "translate",
  "set-play": "translate",
  momentum: "tooltip",
  goal: "translate",
  "on-target": "translate",
  "off-target": "translate",
  blocked: "translate",
  incomplete: "translate",
  goalkeeper: "translate",
  save: "translate",
  distribution: "translate",
  "coming-off-the-line": "translate",
  "one-on-one": "translate",
  defender: "translate",
  midfielder: "translate",
  forward: "translate",
  corner: "translate",
  offside: "translate",
  cross: "translate",
  "offers-to-receive": "translate",
  "movement-to-receive": "translate",
  "defensive-actions": "translate",
};

/*
 * Key builders. Every one ends in `as DictionaryKey` because DictionaryKey is a
 * literal union and a template-literal expression infers `string` — and THAT
 * CAST is precisely why i18n.test.ts's resolution sweep is mandatory rather
 * than optional: it is the only thing standing between a typo'd path and a
 * runtime miss that renders the raw dot path in production.
 */

/** `glossary.<id>.es` — the Spanish term. Same bytes in BOTH dictionaries. */
export function glossaryTermEsKey(id: GlossaryTermId): DictionaryKey {
  return `glossary.${id}.es` as DictionaryKey;
}

/** `glossary.<id>.en` — the English term. Same bytes in BOTH dictionaries. */
export function glossaryTermEnKey(id: GlossaryTermId): DictionaryKey {
  return `glossary.${id}.en` as DictionaryKey;
}

/** `glossary.<id>.definition` — the ONLY leaf of the triple that is localised. */
export function glossaryDefinitionKey(id: GlossaryTermId): DictionaryKey {
  return `glossary.${id}.definition` as DictionaryKey;
}

/**
 * The ruled gloss shown INSTEAD of a counterpart-language subtitle (decision
 * 13). Where the two terms are identical — the `jargon` and `tooltip` rows —
 * `momentum — en: momentum` is a tautology wearing a `lang` span that asserts a
 * language change that does not occur, so no subtitle renders. Where the table
 * gives a gloss anyway (`xG → goles esperados`), that gloss renders in its
 * place. `sprint` and `momentum` have none, so they show nothing.
 *
 * Points at the ALREADY-RULED `match.hero.xgExpansion` rather than minting a
 * second copy of a ruled string.
 */
export const GLOSSARY_GLOSS_KEY: Partial<Record<GlossaryTermId, DictionaryKey>> = {
  xg: "match.hero.xgExpansion",
};

/*
 * ============ WHERE THE TACTICAL LAYER MARKS ITS TERMS (decision 6) ============
 *
 * PURE DATA, kept here rather than beside the marking components, for two
 * reasons. First, "terms are marked once per section" (UX-DR20 / AC 2) is
 * satisfied BY CONSTRUCTION: the two maps are keyed by DISJOINT id unions, so
 * no section can appear in both and there is no marking registry, no context
 * and no first-occurrence state anywhere in the app. Second, the exported HTML
 * guard in matches/static-output.test.ts has to compute the same split, and a
 * node-only test cannot import a "use client" module that pulls in Radix and
 * next/link — a second hand-copied table is exactly how the guard and the
 * renderer drift apart.
 *
 * THE PARTITION IS NOT A STYLE CHOICE. TacticalSection renders {title} in two
 * places: a bare <h2> for the two never-collapsible sections, and — for the
 * other nine — INSIDE the accordion <button aria-expanded>. A GlossaryTerm is a
 * focusable trigger with aria-haspopup, so marking those nine headings would
 * nest interactive content inside a button: invalid content model, the term not
 * independently focusable, and a click on the term toggling the section instead
 * of opening the popover. `tsc` is satisfied by ReactNode and the harness has no
 * jsdom, so NOTHING in the build chain would catch it.
 */
export interface SectionMark {
  id: GlossaryTermId;
  /** Set when the term is not in the surrounding copy's language. */
  lang?: "es" | "en";
}

/**
 * Heading marks — ONLY the two sections whose `{title}` is a bare `<h2>` child.
 * Typed against `AlwaysExpandedSectionId`, so a collapsible id cannot be added.
 *
 * `key-stats` carries no mark: its heading ("Estadísticas clave" / "Key
 * statistics") matches no row of the per-term policy table, and the metric
 * labels that would carry one are rendered by the do-not-touch
 * KeyStatisticsSection.
 */
export const SECTION_HEADING_MARKS: Partial<Record<AlwaysExpandedSectionId, SectionMark>> = {
  // The ledger's own named case. An English noun inside Spanish copy, so it
  // carries lang="en" (decision 13) — unmarked, a Spanish TTS voice reads it as
  // Spanish.
  momentum: { id: "momentum", lang: "en" },
};

/**
 * Summary marks — the nine collapsible sections, whose summary renders as a
 * block OUTSIDE the accordion trigger at every width (2.5 review decision D1).
 *
 * FIVE OF THE NINE CARRY NO MARK, and that is a finding rather than an
 * omission: the ruled 2.5 summaries of `pass-networks`, `offers-to-receive`,
 * `movement-to-receive`, `defensive-actions` and `phases` contain no term from
 * the policy table at all, while their TITLES do — and marking a title is
 * exactly what the partition above forbids for these nine. Rewriting frozen
 * ruled copy to manufacture a marking site is outside Story 2.18's authority;
 * the gap is filed in deferred-work.md. Ruled by Juan.
 */
export const SECTION_SUMMARY_MARKS: Partial<Record<CollapsibleSectionId, SectionMark>> = {
  // "…los tiros y los centros de cada equipo." / "…shots and crosses came from."
  "shot-maps": { id: "cross" },
  // "Altura de la línea defensiva e intensidad de la presión." — first in
  // reading order; `pressing` is the second row this line spans and is left to
  // the glossary.
  pressing: { id: "line-height" },
  // Marks the summary Story 2.18 Task 8.1 remediated ("Tiros de esquina, …").
  "set-plays": { id: "corner" },
  /*
   * es marks "distribución", first in reading order in the Spanish summary. The
   * English summary opens with "Goalkeeper", so en's first term is a different
   * row — one id per section is the contract, and `distribution` is the one
   * present in both. Recorded rather than silently resolved.
   */
  goalkeeping: { id: "distribution" },
};

/*
 * DERIVED from tactical-sections' own guard, never hand-copied (2.18 code
 * review). This read `id === "key-stats" || id === "momentum"` — a literal copy
 * of ALWAYS_EXPANDED_SECTION_IDS that `tsc` cannot connect back to it. Add a
 * third always-expanded section and the union widens so SECTION_HEADING_MARKS
 * still type-checks, while this predicate silently returns false: headingMark
 * drops the new section's mark and summaryMark looks it up in the wrong map
 * behind an `as` cast. That is the 2.9 review's PossessionContestType finding,
 * and this same story's i18n.test.ts states the rule — "The list is IMPORTED,
 * never hand-copied". Inverting the shipped `isCollapsibleId` also deletes the
 * unsound cast below, because the narrowing is now real.
 */
export function isAlwaysExpandedSectionId(id: SectionId): id is AlwaysExpandedSectionId {
  return !isCollapsibleId(id);
}

/** The mark a section's HEADING carries, or null. */
export function headingMark(id: SectionId): SectionMark | null {
  return isAlwaysExpandedSectionId(id) ? (SECTION_HEADING_MARKS[id] ?? null) : null;
}

/** The mark a section's SUMMARY carries, or null. */
export function summaryMark(id: SectionId): SectionMark | null {
  return isCollapsibleId(id) ? (SECTION_SUMMARY_MARKS[id] ?? null) : null;
}

/** A half-open [start, end) range into the text a term was found in. */
export interface TermSpan {
  start: number;
  end: number;
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

function escapeForRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
 * Extend the match forward to the end of the word it landed in, so a singular
 * dictionary term marks the whole plural surface form: "centro" found inside
 * "los centros" underlines "centros", not "centro" plus an orphaned "s".
 */
function toWordEnd(text: string, start: number, end: number): TermSpan {
  let extended = end;
  while (extended < text.length && WORD_CHARACTER.test(text[extended])) {
    extended += 1;
  }
  return { start, end: extended };
}

/*
 * The match must begin a word. toWordEnd extends the END so a singular term
 * marks a plural surface, and that asymmetry looked deliberate but was a gap
 * (2.18 code review): with no leading check, `gol` matched inside "Autogol",
 * `presión` inside "compresión" and `goal` inside "Goalkeeper" — marking a
 * word fragment, or the wrong word entirely, as the popover trigger. The
 * degrade path only covers "not found", never "found wrongly", so nothing
 * downstream can notice.
 */
function isWordStart(text: string, index: number): boolean {
  return index === 0 || !WORD_CHARACTER.test(text[index - 1]);
}

/**
 * Locate a glossary term inside an already-resolved copy string.
 *
 * The marking components split the copy around this span and never write copy
 * into JSX (Task 3.5), so the span must come from the text itself — never from
 * a hardcoded slice length. Three properties matter and each exists for a
 * measured reason:
 *
 * - **Case-insensitive.** The `momentum` term is lower-case in the dictionary
 *   and the en heading is "Momentum timeline"; a case-sensitive search would
 *   silently drop the mark the ledger filed this story to add.
 * - **Number-tolerant.** The ruled term is `tiro de esquina` and the shipped
 *   summary says "Tiros de esquina"; the ruled term is `centro` and the summary
 *   says "los centros". Each word of the term may carry a Spanish/English
 *   plural suffix.
 * - **Returns null rather than throwing.** A reworded title or summary is a
 *   copy change, not a defect: marking degrades silently to plain text.
 */
export function findTermSpan(text: string, term: string): TermSpan | null {
  const needle = term.trim();
  if (needle === "" || text === "") {
    return null;
  }
  // Both passes skip matches that start mid-word (see isWordStart) and keep
  // looking, rather than returning the first hit at any offset.
  const haystack = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let exact = haystack.indexOf(lowerNeedle);
  while (exact >= 0) {
    if (isWordStart(text, exact)) {
      return toWordEnd(text, exact, exact + needle.length);
    }
    exact = haystack.indexOf(lowerNeedle, exact + 1);
  }
  const loose = needle
    .split(/\s+/)
    .map((word) => `${escapeForRegExp(word)}(?:e?s)?`)
    .join("\\s+");
  const pattern = new RegExp(loose, "giu");
  let match = pattern.exec(text);
  while (match !== null) {
    if (isWordStart(text, match.index)) {
      return toWordEnd(text, match.index, match.index + match[0].length);
    }
    // Advance by one so a zero-width or same-index re-match cannot spin.
    pattern.lastIndex = match.index + 1;
    match = pattern.exec(text);
  }
  return null;
}
