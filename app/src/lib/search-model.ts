import type { Stage, Tournament } from "@/lib/contract/contract-types";
import { foldForSearch } from "@/lib/format";
import type { TermSpan } from "@/lib/glossary";
import { matchHref, playerHref, scoreline, teamHref } from "@/lib/hub-model";
import type { DictionaryKey } from "@/lib/i18n";
import { decidedByCaption } from "@/lib/match-hero";

/*
 * THE HEADER SEARCH DECISION LAYER (Story 2.14), as a PURE module: no React, no
 * DOM, no t(), no fetch. Same discipline as `hub-model.ts` and `table-sort.ts`,
 * and for the same reason — everything decided inside a component was, until
 * this story, structurally untestable here. Corpus assembly, the match test, the
 * highlight arithmetic, the ordering and the cap all live here so
 * `search-model.test.ts` can hold them against the REAL 1,400-row index.
 *
 * WHY src/lib AND NOT src/viz. Anything importing `@/lib/format` lives in
 * `src/lib` "so the pure models stay locale-free" — the recorded reason
 * `table-sort.ts` sits there. This imports `foldForSearch`.
 *
 * LOCALE-FREE, in the two ways this codebase means it (AD-7 / AD-12):
 *  - entity-type labels are returned as dictionary KEYS (`matchResultWordKey`'s
 *    pattern), never as strings;
 *  - anything COMPOSED takes its fragments already resolved, through the
 *    `SearchLabels` object — `composeMatchTitle`'s idiom. A pure module never
 *    holds a user-visible glyph, which is why even the separator arrives here.
 *
 * SELECTION AND PRESENTATION ONLY (AD-5). Nothing ranks, scores or re-orders the
 * artifact: the corpus is the three entity lists concatenated in a pinned order,
 * and the only reordering is the prefix-first partition in `searchResults`,
 * which is a QUERY-relative presentation decision and not a property of the data.
 */

export type SearchEntityKind = "player" | "team" | "match";

/**
 * One searchable row, pre-folded.
 *
 * `folded` is computed ONCE here and never recomputed in the filter (ruling
 * 12). A pre-folded linear scan over 1,400 rows sits comfortably inside a frame
 * budget; re-folding inside the predicate costs roughly 36x more, on a control
 * that re-runs on every keystroke. Both fit today — this is a cleanliness rule
 * rather than a rescue — but a second folding site is also a second place for
 * the normalization to drift, which `format.ts` names as the drift its
 * single-home declaration exists to prevent.
 *
 * 🔴 THIS CLAIM WAS FALSE AS SHIPPED AND IS NOW TRUE (code review 2026-08-07).
 * The filter went through `includesText`, which re-folds the haystack, so this
 * field fed only the prefix test. `matchesFolded` is now the single predicate
 * and it reads `folded` directly — if you change the membership test, change it
 * there, and do not reintroduce a call that folds a name a second time.
 *
 * `detail` is the disambiguator, and it is not decoration: `Emiliano MARTINEZ`
 * occurs twice in the real corpus (Argentina and Uruguay), so a row without it
 * shows one name twice with nothing to choose between them.
 */
export interface SearchEntity {
  kind: SearchEntityKind;
  /** The artifact's own id, which IS the slug (AD-3) and the React key stem. */
  id: string;
  name: string;
  /** `foldForSearch(name)`, computed once at assembly. */
  folded: string;
  href: string;
  detail: string | null;
}

/** A matched row plus where to draw the highlight, or null when it must not be drawn. */
export interface SearchResult {
  entity: SearchEntity;
  span: TermSpan | null;
}

/**
 * Every fragment the detail lines compose from, ALREADY RESOLVED by the caller.
 *
 * A DEPARTURE FROM THE STORY'S LITERAL SIGNATURE BLOCK, taken to satisfy the
 * story's own Task 2.3: `searchEntities(tournament)` alone cannot build a match
 * detail, because "stage label + scoreline + decider" is three locale-bound
 * strings. Passing them in is what keeps this module free of t().
 *
 * Every field names a SHIPPED key (ruling 9 — reuse first, mint only what a
 * rendering call site needs). This story mints none of them.
 */
export interface SearchLabels {
  /**
   * `enums.stage.*`, resolved. A `Record` over the closed enum rather than a
   * `readonly Stage[]` or a lookup function: a new contract stage is then a
   * missing-property compile error at the literal, which is the direction AD-2
   * needs (`hub-model.ts` records the same mechanism at length).
   */
  stageLabels: Record<Stage, string>;
  /** `match.hero.group` — the WORD only; the letter is data, as on the Hub. */
  groupWord: string;
  /** `hub.separator` (" · "), never a hardcoded middot. */
  separator: string;
  /** `match.hero.scoreSeparator` (the en dash "–"). */
  scoreSeparator: string;
  /** `hub.results.extraTimeShort` ("t. extra") — the Hub's row-sized form. */
  extraTimeShort: string;
  /** `match.meta.penShort` ("pen."), suffixing the shoot-out scoreline. */
  penShort: string;
}

const SPACE = " ";

/**
 * The entity-type label shown beside every row.
 *
 * REUSES the shipped column heads and mints nothing (ruling 9). `leaderboards`'
 * docblock is the binding precedent: "NO COLUMN LABEL FOR THE ENTITY OR THE
 * TEAM. Those two heads resolve viz.table.player / viz.table.team … a second
 * pair here would be two sources for one term."
 *
 * Returns a `DictionaryKey` rather than a string, so the caller resolves it
 * through `useT()` and the label follows a mid-session locale toggle.
 */
export function entityKindLabelKey(kind: SearchEntityKind): DictionaryKey {
  switch (kind) {
    case "player":
      return "viz.table.player";
    case "team":
      return "viz.table.team";
    case "match":
      return "hub.results.column.match";
    default: {
      // The kind arrives from this module's own union, but the corpus is built
      // out of an `as`-cast payload; name the value rather than returning
      // undefined into a t() call.
      const unexpected: never = kind;
      throw new Error(`search-model: unknown entity kind ${JSON.stringify(unexpected)}`);
    }
  }
}

/**
 * The `sr-only` prefix on a result row, so an option reads as an entity to open
 * rather than a bare proper noun — `hub.*.rowLink`'s shipped idiom, applied to a
 * third surface.
 *
 * 🔴 IT IS NOT A LINK-LIST PREFIX HERE, AND THE EARLIER CLAIM THAT IT WAS IS
 * CORRECTED (code review 2026-08-07, ruled R1). `hub.*.rowLink`'s two shipped
 * call sites put this prefix inside a real anchor in normal flow, where a screen
 * reader's link list picks it up. A search row does NOT: `role="option"` is
 * *Children Presentational: True* in ARIA 1.2, so the nested `<Link>` loses its
 * link semantics in the accessibility tree and never appears in a link list at
 * all. What the prefix actually does is join the option's name-from-content, so
 * the row announces as "Ver el jugador Julian QUINONES, Jugador — México".
 *
 * RULED: KEEP IT ANYWAY. Naming the entity type before the proper noun is worth
 * as much to an option as to a link — `Emiliano MARTINEZ` occurs twice in the
 * real corpus and the three kinds interleave in one list — and dropping the
 * prefix would strand `search.playerRowLink` as a dead key, which ruling 9 bars.
 * Any future change here must fix `es.ts`, `en.ts` and `EXPERIENCE.md` together:
 * all four carried the same wrong justification.
 *
 * TWO OF THE THREE ARE REUSED and only the player form is minted (ruling 9):
 * `hub.standings.rowLink` is "Ver el equipo" and `hub.results.rowLink` is "Ver
 * el partido", both already shipped and both saying exactly what this row needs.
 * No surface had a player form, so `search.playerRowLink` is new.
 */
export function entityKindRowLinkKey(kind: SearchEntityKind): DictionaryKey {
  switch (kind) {
    case "player":
      return "search.playerRowLink";
    case "team":
      return "hub.standings.rowLink";
    case "match":
      return "hub.results.rowLink";
    default: {
      const unexpected: never = kind;
      throw new Error(`search-model: unknown entity kind ${JSON.stringify(unexpected)}`);
    }
  }
}

/*
 * Three absent states, not two — `hub-model.ts`'s `listOf`, for the same reason
 * and at the same boundary. `fetchArtifact<Tournament>` `as`-casts unvalidated
 * JSON, so a contract-required array can still arrive `undefined`, and the
 * header searches on four routes where no region validates the artifact for it.
 */
function listOf<Item>(value: readonly Item[] | null | undefined): readonly Item[] {
  return Array.isArray(value) ? value : [];
}

/*
 * 🔴 THE SCALAR HALF OF THE SAME BOUNDARY (code review 2026-08-07).
 *
 * `listOf` was applied to the arrays and to nothing else, which left the reason
 * it exists only half-honoured: if `fetchArtifact`'s cast can hand us an
 * `undefined` array, it can hand us an `undefined` string just as easily, and
 * `team.group.toUpperCase()` on one of those is a TypeError.
 *
 * AND THE BLAST RADIUS IS THE WHOLE SITE, NOT A REGION. Every other consumer of
 * this artifact is a region that fails into its own `error`/`invalid` branch.
 * This module runs inside `HeaderSearch`'s `useMemo`, in global chrome, on all
 * five routes — and `src/app/` contains no `error.tsx` and no `global-error.tsx`,
 * so a throw here unmounts the React root and blanks the page. Verified absent,
 * not assumed.
 *
 * Degrading rather than throwing follows `matchSpan`'s ruling in this same file:
 * a missing detail fragment costs a reader one line of disambiguation, and
 * taking the header down on every route is not a proportionate response to it.
 */
function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Join only the fragments that survived `textOf`, so no separator dangles. */
function joinDetail(fragments: readonly string[], separator: string): string {
  return fragments.filter((fragment) => fragment !== "").join(separator);
}

/**
 * The decider suffix for one match, or "" when the tie needed none.
 *
 * 🔴 THE FIELD IS NESTED. It is `knockoutResults[].knockoutScore.decidedBy`, NOT
 * `knockoutResults[].decidedBy` — the row's own keys are awayTeam, date, group,
 * homeTeam, kickoff, knockoutScore, matchId, matchNumber, matchdayRound, score,
 * stage, venue. A join that reads `row.decidedBy` returns `undefined` on all 32
 * real rows and ships the exact bug ruling 11 exists to prevent, silently.
 *
 * AND THE JOIN ITSELF IS LOAD-BEARING. `entities.matches[].score` is the
 * full-time score and the entity carries no knockout detail at all:
 * m074-germany-paraguay reads `1–1` there while its knockout row records
 * `shootoutScore {home:3, away:4}` and `winnerTeamId: "paraguay"`. A bare
 * scoreline presents a match Germany LOST as a draw. Measured on the real
 * corpus: 23 regulation / 5 extra-time / 4 shoot-out ties.
 *
 * `decidedByCaption` does the decoding — 2.12 ruled "do not write a second
 * switch", and a switch here would be the third. This function only formats what
 * that returns.
 */
function deciderSuffix(
  knockoutScore: Parameters<typeof decidedByCaption>[0],
  labels: SearchLabels
): string {
  /*
   * `decidedByCaption` THROWS — on an out-of-union `decidedBy` and on
   * `"shootout"` with a null `shootoutScore` — and it is reached here from an
   * `as`-cast payload. On the Hub that throw is correct and lands inside a
   * region; in global chrome it blanks all five routes (see `textOf` above).
   * The suffix degrades to "" instead: the row still renders, still matches and
   * still carries its stage and scoreline, and only the decider annotation drops.
   */
  let caption: ReturnType<typeof decidedByCaption>;
  try {
    caption = decidedByCaption(knockoutScore);
  } catch {
    return "";
  }
  if (caption.kind === "none") {
    return "";
  }
  if (caption.kind === "extra-time") {
    return `${labels.separator}${labels.extraTimeShort}`;
  }
  /*
   * The shoot-out score, not just the fact of one: "Definido en penales" with no
   * number still leaves 1–1 ambiguous about who went through, which is the
   * whole failure this join exists to fix. `hub.results.shootoutFull` is the Hub
   * row's SR-ONLY companion to a visible short form; a search row renders one
   * plain string with no such split, so the visible form carries the fact and
   * the full sentence would either duplicate it or bury the number.
   */
  const pens = scoreline({ home: caption.home, away: caption.away }, labels.scoreSeparator);
  return `${labels.separator}${pens}${SPACE}${labels.penShort}`;
}

/**
 * Build the whole searchable corpus from one `tournament.json`.
 *
 * ORDER IS PINNED — teams → players → matches — and pinned in a test. It is
 * OBSERVABLE: at a 10-row cap a common substring matches far more than ten rows,
 * so corpus order decides which ten a reader sees. Teams lead because there are
 * 48 of them against 1,248 players, and a reader typing a country name that is
 * also a player's surname should not have the team pushed off the list.
 *
 * DRIVEN OFF `entities.*.length`, never off a measured count. The fixture holds
 * 1 team / 2 players / 4 matches and the real artifact 48 / 1,248 / 104; nothing
 * here assumes either. (The fixture is also internally inconsistent by design —
 * its `entities.matches` references 8 distinct team ids while `entities.teams`
 * carries one — so a fixture search for "Belgium" matches a match and never a
 * team. That is legal under the bijection test's `on_disk <= listed` and will
 * persist; it is another reason to drive off `.length`.)
 */
export function searchEntities(tournament: Tournament, labels: SearchLabels): SearchEntity[] {
  const entities = tournament.entities;

  const teams: SearchEntity[] = listOf(entities?.teams).map((team) => {
    const name = textOf(team.name);
    // The group letter is DATA (the contract enum is lowercase "a".."l"), so it
    // is uppercased here rather than given twelve dictionary keys — exactly how
    // `TournamentHub` builds its own group headings.
    const group = textOf(team.group).toUpperCase();
    return {
      kind: "team" as const,
      id: textOf(team.teamId),
      name,
      folded: foldForSearch(name),
      href: teamHref(textOf(team.teamId)),
      detail: group === "" ? null : `${labels.groupWord}${SPACE}${group}`,
    };
  });

  const players: SearchEntity[] = listOf(entities?.players).map((player) => {
    const name = textOf(player.name);
    return {
      kind: "player" as const,
      id: textOf(player.playerId),
      name,
      folded: foldForSearch(name),
      href: playerHref(textOf(player.playerId)),
      /*
       * "name plus team", which the contract prescribes for a player search
       * result and which `review-adversary.md` L1 names independently. Note
       * `PlayerEntity` carries `team: {id, name}` — there is no `teamId` field.
       */
      detail: textOf(player.team?.name) === "" ? null : textOf(player.team?.name),
    };
  });

  /*
   * The knockout join, built ONCE as a Map rather than a `.find` per row: 104
   * matches against 32 knockout rows is small either way, but the linear form
   * puts an O(n·m) scan on the corpus-assembly path for no gain.
   */
  const knockoutByMatchId = new Map(
    listOf(tournament.knockoutResults).map((row) => [row.matchId, row])
  );

  const matches: SearchEntity[] = listOf(entities?.matches).map((match) => {
    const knockout = knockoutByMatchId.get(match.matchId);
    /*
     * `scoreline` interpolates `score.home` / `score.away` directly, so an
     * absent `score` is a TypeError rather than a bad string. Same boundary,
     * same reasoning as `textOf`.
     */
    const teamsLine =
      match.score === null || match.score === undefined
        ? ""
        : scoreline(match.score, labels.scoreSeparator);
    const suffix =
      knockout === undefined || knockout.knockoutScore === undefined
        ? ""
        : deciderSuffix(knockout.knockoutScore, labels);
    /*
     * The NAME a match is searched by is its two team names. `homeTeam` and
     * `awayTeam` are `EntityRef {id, name}` on the entity itself, so this needs
     * no join — and the order is load-bearing (home first, as the source prints
     * it).
     *
     * 🔴 THE JOINER IS THE EN DASH, **NOT** `hub.separator`, AND THAT IS A
     * CORRECTNESS CONSTRAINT RATHER THAN A STYLE CHOICE. `hub.separator` is
     * " · " — U+00B7 MIDDLE DOT — and U+00B7 IS IN `\p{Diacritic}` (it marks the
     * Catalan punt volat), so `foldForSearch` DELETES it. Measured: `" · "`
     * (3 chars) folds to `"  "` (2). Every match name would then fail the 1:1
     * fold invariant `matchSpan` guards on, and all 104 match rows would lose
     * their highlight — silently, because the guard's whole job is to degrade
     * quietly. Found by this module's own corpus-wide fold test, not by reading.
     *
     * `match.hero.scoreSeparator` (U+2013 EN DASH) folds to itself, is already
     * the glyph this app puts between the two sides of a match, and needs no new
     * key. Any string whose indices are used for highlighting must be checked
     * this way before a new glyph enters it.
     */
    const name = `${textOf(match.homeTeam?.name)}${SPACE}${labels.scoreSeparator}${SPACE}${textOf(match.awayTeam?.name)}`;
    /*
     * An out-of-enum `stage` misses `stageLabels` and yields `undefined`, which
     * template interpolation renders as the literal string "undefined" beside
     * the scoreline — a silent wrong answer rather than a loud one. Absent, the
     * fragment is dropped and the detail is one field shorter.
     */
    const stageLabel = textOf(labels.stageLabels[match.stage]);
    // Every fragment can be absent at once. `""` would render the row's " — "
    // joiner with nothing after it, so an empty detail becomes `null` — the
    // value `SearchOption` already treats as "there is no detail line".
    const detail = `${joinDetail([stageLabel, teamsLine], labels.separator)}${suffix}`;
    return {
      kind: "match" as const,
      id: textOf(match.matchId),
      name,
      folded: foldForSearch(name),
      href: matchHref(textOf(match.matchId)),
      /*
       * "teams plus score plus stage", the schema's own words for what a match
       * search result carries. The teams are the name; this is the rest.
       * `detail` is NEVER highlighted, so `hub.separator` is safe here.
       *
       * The decider suffix carries its OWN leading separator, so it is appended
       * to the joined string rather than passed through `joinDetail`.
       */
      detail: detail === "" ? null : detail,
    };
  });

  return [...teams, ...players, ...matches];
}

/**
 * Where to draw the highlight in `name` for `query`, or `null` for "do not".
 *
 * THE ARITHMETIC IS DONE ON THE HAYSTACK ONLY (ruling 6). The needle's FOLDED
 * length is used to size the span, and the slice comes out of the ORIGINAL
 * string — measured across all 3,008 `name` fields in the real index,
 * `foldForSearch` changes the length of exactly zero of them, because the
 * corpus's entire non-ASCII inventory is `ü`, `ô` and `ç`, all of which
 * decompose to base + combining mark.
 *
 * 🔴 IT IS NOT 1:1 IN GENERAL, AND THE COUNTEREXAMPLES ARRIVE THROUGH THE INPUT.
 * `\p{Diacritic}` also covers SPACING characters that are not marks — `^`
 * U+005E, `´` U+00B4, `¨` U+00A8 — which are DELETED rather than combined, so
 * `"a^b"` (3) folds to `"ab"` (2). Both `^` and `´` are dead-key-adjacent on a
 * Spanish keyboard. The guard below returns `null` whenever the fold is not
 * length-preserving on the haystack, so a shifted index can never reach a slice.
 *
 * RETURNING NULL IS A DELIBERATE DEPARTURE from this codebase's fail-loud idiom
 * (`assertFinite`, `groupScorers`' partition throw, `decidedByCaption`'s `never`
 * default). A highlight is decoration: the row still matches and still renders,
 * only the marking drops. Throwing would take the header down on every route,
 * for a cosmetic defect, on a keystroke the reader is entitled to type.
 *
 * `TermSpan` is imported from `@/lib/glossary` rather than re-declared: same
 * shape, same half-open `[start, end)` semantics, and a second home for one
 * concept is what this codebase punishes. `findTermSpan` is deliberately NOT
 * reused — it case-folds only, with no NFD and no accent handling, and its
 * docblock lists three properties with accent-insensitivity not among them.
 */
export function matchSpan(name: string, query: string): TermSpan | null {
  const needle = query.trim();
  if (needle === "" || name === "") {
    return null;
  }
  const foldedName = foldForSearch(name);
  // The 1:1 guard. Checked on the HAYSTACK, because that is the string being
  // sliced; a shortened needle is fine as long as its folded length is used.
  if (foldedName.length !== name.length) {
    return null;
  }
  const foldedNeedle = foldForSearch(needle);
  if (foldedNeedle === "") {
    // e.g. a bare "´" — every character was a diacritic. Not "matches
    // everything": an empty span would highlight nothing and mean nothing.
    return null;
  }
  const start = foldedName.indexOf(foldedNeedle);
  if (start < 0) {
    return null;
  }
  return { start, end: start + foldedNeedle.length };
}

/**
 * The membership test, with BOTH folds already done.
 *
 * 🔴 THIS IS WHAT RULING 12 ACTUALLY ASKED FOR, AND IT WAS NOT DONE (code review
 * 2026-08-07). The predicate used to be `includesText(entity.name, needle)`, and
 * `includesText` is `foldForSearch(haystack).includes(foldForSearch(needle))` —
 * so every row NFD-decomposed, regex-stripped and lowercased its name from
 * scratch, on every keystroke, discarding the `folded` field computed at
 * assembly for exactly this. `countResults` ran the same loop again, so a
 * keystroke paid roughly 2 × corpus-size folds plus 2 × corpus-size needle folds
 * — the "36x more" cost `SearchEntity`'s docblock names, doubled, while three
 * separate docblocks asserted it was not happening.
 *
 * IT IS THE SAME PREDICATE, NOT A LOOSER ONE. `includesText` is definitionally
 * `fold(h).includes(fold(n))`; this is that expression with both folds hoisted
 * out of the loop, and `format.ts` remains the single home of the normalization
 * because `foldForSearch` is still the only function doing any of it. The
 * degenerate case is preserved exactly: a diacritic-only needle folds to `""`,
 * `"".includes("")` is `true`, and every row matches — which is what
 * `includesText` did too.
 */
function matchesFolded(entity: SearchEntity, foldedNeedle: string): boolean {
  return entity.folded.includes(foldedNeedle);
}

/**
 * How many rows match, IGNORING the cap.
 *
 * The announcement says the TOTAL, so the 10-row cap is never a silent
 * truncation — a reader told "10 results" when 214 matched has been misinformed
 * by a presentation limit. Separate from `searchResults` rather than derived
 * from it because deriving it would mean computing 1,400 spans to count them:
 * spans are the expensive part and only the visible rows need one.
 */
export function countResults(entities: readonly SearchEntity[], query: string): number {
  const needle = query.trim();
  if (needle === "") {
    return 0;
  }
  // The needle folds ONCE, outside the loop — see `matchesFolded`.
  const foldedNeedle = foldForSearch(needle);
  let total = 0;
  for (const entity of entities) {
    if (matchesFolded(entity, foldedNeedle)) {
      total += 1;
    }
  }
  return total;
}

/**
 * The visible result list for one query.
 *
 * ORDER: prefix matches first, then mid-string matches, each block in CORPUS
 * order. A stable partition rather than a sort — nothing is scored, and the
 * artifact's order survives inside each block (AD-5).
 *
 * 🔴 THE SPEC CONTRADICTS ITSELF HERE, AND TASK 2.9 WINS (code review
 * 2026-08-07, ruled R3). Ruling 5 says "Ordering goes through `compareText` at
 * its `'es'` default" and the Reuse Map repeats it; Task 2.9 says "prefix-matches
 * before substring-matches, then corpus order", which needs no comparator at
 * all. The partition below implements Task 2.9 and imports no `compareText`.
 *
 * RULED: Task 2.9 governs and this code stands. Two reasons, both load-bearing.
 * A prefix match must outrank a mid-string one whatever the alphabet says — an
 * alphabetical re-sort would push "Mexico" below "New Mexico" for the needle
 * "mex". And re-sorting would destroy the deliberately pinned teams → players →
 * matches corpus order that `searchEntities` documents and a test pins: at a
 * 10-row cap that order is what stops 1,248 players from burying the 48 teams.
 * Ruling 5's clause is the stale one; it is not implemented anywhere and must
 * not be "restored" by a later reader who finds the mismatch.
 *
 * THE QUERY IS TRIMMED HERE, at the model boundary, and never inside
 * `includesText` (ruling 5). `""` matching everything is correct substring
 * semantics for a general matcher; it is the FILTER that should ignore
 * surrounding space — `LeaderboardsRegion` records the same split, and the
 * defect that forced it (a single typed space emptied every team board).
 *
 * SPANS ARE COMPUTED AFTER THE CAP, not before: at 1,400 rows a one-character
 * query matches most of the corpus, and only the rows that survive the cap are
 * ever drawn.
 */
export function searchResults(
  entities: readonly SearchEntity[],
  query: string,
  limit: number
): SearchResult[] {
  const needle = query.trim();
  if (needle === "") {
    return [];
  }
  const foldedNeedle = foldForSearch(needle);
  const prefix: SearchEntity[] = [];
  const rest: SearchEntity[] = [];
  for (const entity of entities) {
    /*
     * The FOLD is the only match test (ruling 5). The AC names
     * `Intl.Collator('es', {sensitivity:'base'})`, and `format.ts` forecloses
     * that route in its own words: "the collators above give whole-string
     * equality, and Intl has no substring operation of any kind." The fold
     * delivers the behaviour the AC asks for; the collator stays the sort path
     * it always was. Recorded as a reconciliation of an under-specified UX-DR,
     * not as a departure.
     */
    if (!matchesFolded(entity, foldedNeedle)) {
      continue;
    }
    if (foldedNeedle !== "" && entity.folded.startsWith(foldedNeedle)) {
      prefix.push(entity);
    } else {
      rest.push(entity);
    }
    // Both blocks together can already fill the cap, but neither alone decides
    // it — a late prefix match must still outrank an early mid-string one, so
    // the scan cannot stop early. 1,400 rows is one linear pass.
  }
  return [...prefix, ...rest]
    .slice(0, Math.max(0, limit))
    .map((entity) => ({ entity, span: matchSpan(entity.name, needle) }));
}
