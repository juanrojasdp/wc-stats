import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Stage, Tournament } from "@/lib/contract/contract-types";
import { foldForSearch, includesText } from "@/lib/format";
import { STAGES, stageLabelKey } from "@/lib/hub-model";
import { t } from "@/lib/i18n";
import {
  entityKindLabelKey,
  countResults,
  entityKindRowLinkKey,
  matchSpan,
  searchEntities,
  searchResults,
  type SearchEntity,
  type SearchLabels,
} from "@/lib/search-model";

/*
 * THE HEADER SEARCH CORPUS (Story 2.14, Task 2.10) — TESTED AGAINST THE REAL
 * INDEX, NOT THE FIXTURE, AND RULING 12 IS WHY.
 *
 * The fixture contains ZERO non-ASCII characters (7 searchable rows), so every
 * accent assertion against it would be a case-insensitivity assertion wearing an
 * accent-insensitivity label. The real index carries 1,400 rows and the whole
 * three-character non-ASCII inventory this corpus has — `ü`, `ô`, `ç`, all in
 * team names. It also carries the duplicate-name case (`Emiliano MARTINEZ`
 * twice) and enough rows that the 10-row cap is actually exercised.
 *
 * READ WITH readFileSync, NEVER `resolveJsonModule` (Task 2.10, ruled). A direct
 * JSON import is not assignable to `Tournament` — `schemaVersion` infers
 * `number` against the literal `4`, and `stage` infers `string` against the
 * closed enum — and it would put a 400 KB literal type into every
 * `npm run typecheck`, which is link 2 of the CI gate.
 */
const REAL_INDEX: Tournament = JSON.parse(
  readFileSync(path.join(process.cwd(), "..", "data", "index", "tournament.json"), "utf8")
) as Tournament;

/*
 * The model is LOCALE-FREE (Task 2.3): it returns dictionary KEYS for the
 * entity-type labels and takes every composed fragment as an already-resolved
 * string, exactly as `composeMatchTitle` does. Resolving them here through the
 * real `t()` is deliberate — it proves the keys the component will pass are
 * real keys, in the same test that proves the composition.
 */
const stageLabels = Object.fromEntries(
  STAGES.map((stage) => [stage, t(stageLabelKey(stage))])
) as Record<Stage, string>;

const LABELS: SearchLabels = {
  stageLabels,
  groupWord: t("match.hero.group"),
  separator: t("hub.separator"),
  scoreSeparator: t("match.hero.scoreSeparator"),
  extraTimeShort: t("hub.results.extraTimeShort"),
  penShort: t("match.meta.penShort"),
};

const corpus = searchEntities(REAL_INDEX, LABELS);

function find(id: string): SearchEntity {
  const entity = corpus.find((candidate) => candidate.id === id);
  expect(entity, `no corpus entity with id ${id}`).toBeDefined();
  return entity as SearchEntity;
}

describe("searchEntities — corpus assembly", () => {
  it("covers all three entity lists, driven off .length and never off a pinned count", () => {
    const { teams, players, matches } = REAL_INDEX.entities;
    expect(corpus).toHaveLength(teams.length + players.length + matches.length);
    // Sanity that the artifact really is at full scale rather than a fixture
    // someone pointed this path at — otherwise the cap and duplicate-name
    // assertions below would pass vacuously.
    expect(players.length).toBeGreaterThan(1000);
  });

  it("concatenates in the PINNED order teams → players → matches", () => {
    /*
     * The order is observable: at a 10-row cap a common substring matches far
     * more than ten rows, so which ten survive is decided by corpus order. An
     * unpinned order would make the visible result set nondeterministic across
     * a refactor while every count assertion stayed green.
     */
    const { teams, players } = REAL_INDEX.entities;
    expect(corpus[0].kind).toBe("team");
    expect(corpus[teams.length].kind).toBe("player");
    expect(corpus[teams.length + players.length].kind).toBe("match");
    // And within a block the artifact's own order is preserved (AD-5).
    expect(corpus[0].id).toBe(teams[0].teamId);
    expect(corpus[teams.length].id).toBe(players[0].playerId);
  });

  it("folds every name exactly ONCE, at assembly time", () => {
    // Ruling 12: re-folding inside the filter costs ~36x more over 1,400 rows
    // and puts a second normalization path in the hot loop.
    for (const entity of corpus) {
      expect(entity.folded, entity.name).toBe(foldForSearch(entity.name));
    }
  });

  /*
   * THE 1:1 FOLD INVARIANT — the property every highlight index depends on.
   *
   * Ruling 6: the span is found in the FOLDED haystack and sliced out of the
   * ORIGINAL, which is only sound while folding preserves length. Asserted over
   * every name in the corpus rather than over the three known accents, so a
   * future artifact that introduces a decomposing-to-nothing character fails
   * HERE — loudly — rather than degrading every highlight by one column.
   */
  it("folds 1:1 across every name in the real corpus", () => {
    const shifted = corpus
      .filter((entity) => entity.folded.length !== entity.name.length)
      .map((entity) => entity.name);
    expect(shifted).toEqual([]);
  });

  it("carries the corpus's entire non-ASCII inventory and it is three characters", () => {
    /*
     * Stated as a test so the claim ruling 6 rests on is measured, not asserted
     * in prose. All three live in TEAM names; all 1,248 player names are ASCII
     * (the source prints diacritics already stripped — "Julian QUINONES").
     *
     * Read off the ARTIFACT's own name fields, not off `entity.name`: a match's
     * name is COMPOSED, so it also carries the joiner glyph, which is a
     * presentation decision of this module rather than a property of the corpus.
     */
    const nonAscii = new Set<string>();
    const artifactNames = [
      ...REAL_INDEX.entities.teams.map((team) => team.name),
      ...REAL_INDEX.entities.players.map((player) => player.name),
      ...REAL_INDEX.entities.matches.flatMap((match) => [
        match.homeTeam.name,
        match.awayTeam.name,
      ]),
    ];
    for (const name of artifactNames) {
      for (const character of name) {
        if (character.codePointAt(0)! > 127) {
          nonAscii.add(character);
        }
      }
    }
    expect([...nonAscii].sort()).toEqual(["ç", "ô", "ü"]);
  });

  /*
   * 🔴 THE JOINER GLYPH IS PART OF THE 1:1 INVARIANT, and this is the guard that
   * says so out loud.
   *
   * `hub.separator` is " · " — U+00B7 MIDDLE DOT — and U+00B7 IS in
   * `\p{Diacritic}`, so the fold DELETES it: " · " (3) folds to "  " (2). Built
   * into a match name it broke the fold invariant on all 104 match rows and
   * dropped every match highlight, silently, because degrading quietly is
   * exactly what `matchSpan`'s guard is for. Found by the corpus-wide fold test
   * above during this story's own implementation.
   *
   * Pinned as a PROPERTY OF THE GLYPHS rather than only as a corpus outcome, so
   * a later reader who reaches for the shipped separator here learns why not.
   */
  it("pins WHY the match joiner is the en dash and not hub.separator", () => {
    expect(foldForSearch(" · ")).not.toHaveLength(" · ".length);
    expect(foldForSearch(LABELS.scoreSeparator)).toHaveLength(LABELS.scoreSeparator.length);
    expect(find("m074-germany-paraguay").name).toBe(
      `Germany ${LABELS.scoreSeparator} Paraguay`
    );
  });
});

describe("searchEntities — hrefs and slug safety", () => {
  /** `contract/common.schema.json`, verbatim — cite the schema, never AD-3. */
  const TEAM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const PLAYER_ID = /^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}$/;
  const MATCH_ID = /^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$/;

  it("emits the three routes WITH their trailing slash (trailingSlash: true)", () => {
    expect(find("mexico").href).toBe("/teams/mexico/");
    expect(find("quinones-julian-mex").href).toBe("/players/quinones-julian-mex/");
    expect(find("m074-germany-paraguay").href).toBe("/matches/m074-germany-paraguay/");
  });

  it("conforms every id to its schema pattern, so direct interpolation is safe", () => {
    // 0 violations across all 1,400 real ids — which is what makes
    // encodeURIComponent unnecessary rather than merely omitted.
    for (const entity of corpus) {
      const pattern =
        entity.kind === "team" ? TEAM_ID : entity.kind === "player" ? PLAYER_ID : MATCH_ID;
      expect(pattern.test(entity.id), `${entity.kind} ${entity.id}`).toBe(true);
    }
  });
});

describe("searchEntities — detail lines", () => {
  it("disambiguates a player by TEAM, which is the only thing that separates them", () => {
    /*
     * `Emiliano MARTINEZ` occurs TWICE in the real corpus — Argentina and
     * Uruguay. Without `detail` the typeahead shows one name twice with no way
     * to tell which is which; with the index as the React key it would also
     * collapse them. Both rows must differ in id, href AND detail.
     */
    const rows = corpus.filter((entity) => entity.name === "Emiliano MARTINEZ");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
    expect(new Set(rows.map((row) => row.href)).size).toBe(2);
    expect(new Set(rows.map((row) => row.detail)).size).toBe(2);
    expect(rows.map((row) => row.detail).sort()).toEqual(["Argentina", "Uruguay"]);
  });

  it("names a team by its GROUP, using the shipped word plus the letter as data", () => {
    // `TournamentHub` renders group headings the same way: the contract enum is
    // lowercase "a".."l" and the LETTER is data, so it is uppercased at render
    // rather than given twelve dictionary keys.
    expect(find("mexico").detail).toBe(`${LABELS.groupWord} A`);
  });

  /*
   * RULING 11 — THE DECIDER IS JOINED FROM THE NESTED PATH, OR FOUR MATCHES LIE.
   *
   * m074's `entities.matches` row carries `score {home:1, away:1}` and nothing
   * else; its knockout row records `shootoutScore {home:3, away:4}` and
   * `winnerTeamId: "paraguay"`. A bare "1–1" presents a match Germany LOST as a
   * draw. The join is by matchId into `knockoutResults[].knockoutScore` — NOT
   * `knockoutResults[].decidedBy`, which does not exist and reads `undefined` on
   * all 32 rows without erroring.
   */
  it("joins the SHOOT-OUT decider through knockoutScore, not off the row", () => {
    const detail = find("m074-germany-paraguay").detail ?? "";
    expect(detail).toContain(stageLabels.r32);
    expect(detail).toContain(`1${LABELS.scoreSeparator}1`);
    // The half a bare scoreline would have lost.
    expect(detail).toContain(`3${LABELS.scoreSeparator}4`);
    expect(detail).toContain(LABELS.penShort);
  });

  it("suffixes an EXTRA-TIME tie and leaves a regulation one unsuffixed", () => {
    const extraTime = REAL_INDEX.knockoutResults.find(
      (row) => row.knockoutScore.decidedBy === "extra-time"
    );
    const regulation = REAL_INDEX.knockoutResults.find(
      (row) => row.knockoutScore.decidedBy === "regulation"
    );
    expect(extraTime, "the real corpus carries 5 extra-time ties").toBeDefined();
    expect(regulation, "the real corpus carries 23 regulation ties").toBeDefined();
    expect(find(extraTime!.matchId).detail).toContain(LABELS.extraTimeShort);
    expect(find(regulation!.matchId).detail).not.toContain(LABELS.extraTimeShort);
    expect(find(regulation!.matchId).detail).not.toContain(LABELS.penShort);
  });

  it("gives a GROUP match its stage label and score and no decider at all", () => {
    const group = REAL_INDEX.entities.matches.find((match) => match.stage === "group");
    expect(group).toBeDefined();
    const detail = find(group!.matchId).detail ?? "";
    expect(detail).toContain(stageLabels.group);
    expect(detail).not.toContain(LABELS.penShort);
  });
});

describe("matchSpan", () => {
  it("returns ORIGINAL-string indices for an accented haystack", () => {
    /*
     * The three real accented team names, each highlighted from a needle typed
     * WITHOUT the accent — which is the direction the data forces (the source
     * prints player names already stripped, so the reader is the one who spells
     * it correctly).
     */
    for (const [name, needle, expected] of [
      ["Türkiye", "turk", "Türk"],
      ["Côte d'Ivoire", "cote", "Côte"],
      ["Curaçao", "curac", "Curaç"],
    ] as const) {
      const span = matchSpan(name, needle);
      expect(span, `${needle} in ${name}`).not.toBeNull();
      expect(name.slice(span!.start, span!.end)).toBe(expected);
    }
  });

  it("matches with the accent typed IN, against data that has it stripped", () => {
    // Constructed, because the fixture and the real player list have no accents
    // at all — this is the actual AC 2 use case (ruling 12).
    expect(matchSpan("Julian QUINONES", "Quiñones")).toEqual({ start: 7, end: 15 });
    expect(matchSpan("Darwin NUNEZ", "Núñez")).toEqual({ start: 7, end: 12 });
  });

  it("folds ñ to n in BOTH directions", () => {
    expect(matchSpan("Ñíguez", "nig")).toEqual({ start: 0, end: 3 });
    expect(matchSpan("Niguez", "ñí")).toEqual({ start: 0, end: 2 });
  });

  it("is case-insensitive and matches mid-word", () => {
    expect(matchSpan("SON Heungmin", "heung")).toEqual({ start: 4, end: 9 });
    expect(matchSpan("SON Heungmin", "n he")).toEqual({ start: 2, end: 6 });
  });

  /*
   * RULING 6's guard. `\p{Diacritic}` covers SPACING characters that are not
   * combining marks — `^` U+005E and `´` U+00B4 are both dead-key-adjacent on a
   * Spanish keyboard, so a reader really can type them — and those are DELETED,
   * which shortens the string and desynchronises every index.
   *
   * The row must still MATCH and still RENDER; only the highlight drops. That is
   * a deliberate departure from this codebase's fail-loud idiom (`assertFinite`,
   * `groupScorers`' throw): a highlight is decoration, and throwing here would
   * take the header down on every route.
   */
  it("drops the highlight when the HAYSTACK's fold is not length-preserving", () => {
    // The guard proper. Constructed, because no name in either shipped artifact
    // triggers it — which is the finding, not a gap.
    const shifting = "a^b Mexico";
    expect(foldForSearch(shifting).length).not.toBe(shifting.length);
    expect(matchSpan(shifting, "mexico")).toBeNull();
    // And the row still matches: only the marking drops, never the result.
    expect(includesText(shifting, "mexico")).toBe(true);
  });

  /*
   * A RECONCILIATION OF THE STORY'S OWN TWO STATEMENTS, recorded here because
   * the test is where it becomes decidable.
   *
   * Task 2.10 asks for "a `^`/`´` needle returning `null` without throwing".
   * Ruling 6's MECHANISM says the arithmetic is done "on the haystack only" —
   * the span is sized by the FOLDED NEEDLE's length and sliced out of the
   * original haystack, whose 1:1 property is what the guard checks. Under that
   * mechanism a `^` in the NEEDLE cannot shift anything: "me^x" folds to "mex",
   * "Mexico" is 1:1, and slicing [0,3) yields "Mex" — the correct highlight for
   * what the reader effectively searched.
   *
   * The mechanism governs, so the needle case MATCHES rather than returning
   * null. What must still return null is a needle that folds away ENTIRELY (a
   * bare "´"): a zero-width span highlights nothing and means nothing.
   * Non-throwing is required in both cases and asserted in both.
   */
  it("still matches a needle carrying a spacing diacritic, and never throws", () => {
    expect(() => matchSpan("Mexico", "me^x")).not.toThrow();
    const span = matchSpan("Mexico", "me^x");
    expect(span).toEqual({ start: 0, end: 3 });
    expect("Mexico".slice(span!.start, span!.end)).toBe("Mex");
  });

  it("returns null for a needle that folds away entirely", () => {
    expect(() => matchSpan("Mexico", "´")).not.toThrow();
    expect(matchSpan("Mexico", "´")).toBeNull();
    expect(matchSpan("Mexico", "^¨´")).toBeNull();
  });

  it("returns null for an empty or absent needle rather than a zero-width span", () => {
    expect(matchSpan("Mexico", "")).toBeNull();
    expect(matchSpan("Mexico", "   ")).toBeNull();
    expect(matchSpan("Mexico", "zzz")).toBeNull();
  });
});

describe("searchResults", () => {
  it("returns nothing at all for an empty or whitespace-only query", () => {
    // Trimmed at THIS boundary, never inside includesText: "" matching
    // everything is correct substring semantics for a general matcher; it is
    // the FILTER that should ignore surrounding space (LeaderboardsRegion).
    expect(searchResults(corpus, "", 10)).toEqual([]);
    expect(searchResults(corpus, "   ", 10)).toEqual([]);
  });

  it("trims the query and matches the trimmed form", () => {
    const trimmed = searchResults(corpus, "  mexico  ", 10);
    expect(trimmed.length).toBeGreaterThan(0);
    expect(trimmed).toEqual(searchResults(corpus, "mexico", 10));
  });

  it("caps at the limit — which 1,400 rows and a one-character query really exercise", () => {
    // The 7-row fixture can never overflow; this is the assertion that could
    // only be written against the real index.
    expect(searchResults(corpus, "a", 10)).toHaveLength(10);
    expect(searchResults(corpus, "a", 3)).toHaveLength(3);
    expect(searchResults(corpus, "a", 0)).toHaveLength(0);
  });

  it("puts PREFIX matches ahead of mid-string ones, then keeps corpus order", () => {
    const results = searchResults(corpus, "mar", 10);
    const prefixes = results.map((result) => result.entity.folded.startsWith("mar"));
    // Every true precedes every false: a stable partition, not a sort.
    expect(prefixes.indexOf(false) === -1 || prefixes.lastIndexOf(true) < prefixes.indexOf(false))
      .toBe(true);
  });

  it("keeps corpus order WITHIN a rank, so teams precede players precede matches", () => {
    const kinds = searchResults(corpus, "mexico", 10).map((result) => result.entity.kind);
    const firstMatch = kinds.indexOf("match");
    const lastTeam = kinds.lastIndexOf("team");
    if (firstMatch !== -1 && lastTeam !== -1) {
      expect(lastTeam).toBeLessThan(firstMatch);
    }
  });

  it("carries a span for every row it returns, or null where the guard fired", () => {
    for (const result of searchResults(corpus, "tur", 10)) {
      expect(result.span).toEqual(matchSpan(result.entity.name, "tur"));
    }
  });

  it("matches accent-insensitively over the REAL corpus, which is the AC", () => {
    const typed = searchResults(corpus, "Türkiye", 10);
    const stripped = searchResults(corpus, "turkiye", 10);
    expect(typed.length).toBeGreaterThan(0);
    expect(typed.map((r) => r.entity.id)).toEqual(stripped.map((r) => r.entity.id));
  });
});

describe("entityKindLabelKey", () => {
  it("reuses the shipped column labels rather than minting a second pair", () => {
    /*
     * `leaderboards`' binding precedent: "NO COLUMN LABEL FOR THE ENTITY OR THE
     * TEAM. Those two heads resolve viz.table.player / viz.table.team … a second
     * pair here would be two sources for one term." Ruling 9 applies it again.
     */
    expect(entityKindLabelKey("player")).toBe("viz.table.player");
    expect(entityKindLabelKey("team")).toBe("viz.table.team");
    expect(entityKindLabelKey("match")).toBe("hub.results.column.match");
  });

  it("resolves in both locales for every kind — the key-builder sweep, locally", () => {
    for (const kind of ["player", "team", "match"] as const) {
      for (const locale of ["es", "en"] as const) {
        const value = t(entityKindLabelKey(kind), locale);
        expect(value, `${kind} in ${locale}`).not.toBe("");
        expect(value).not.toContain(".");
      }
    }
  });
});

describe("entityKindRowLinkKey", () => {
  it("reuses the two shipped hub.*.rowLink prefixes and mints only the player one", () => {
    // Ruling 9 again: "Ver el equipo" and "Ver el partido" already ship and
    // already say what these rows need. Only the player form was missing.
    expect(entityKindRowLinkKey("team")).toBe("hub.standings.rowLink");
    expect(entityKindRowLinkKey("match")).toBe("hub.results.rowLink");
    expect(entityKindRowLinkKey("player")).toBe("search.playerRowLink");
  });

  it("resolves to three DISTINCT prefixes in both locales", () => {
    // One prefix for all three would make a screen reader's link list say the
    // same thing about a player, a team and a match.
    for (const locale of ["es", "en"] as const) {
      const resolved = (["player", "team", "match"] as const).map((kind) =>
        t(entityKindRowLinkKey(kind), locale)
      );
      expect(new Set(resolved).size, locale).toBe(3);
      for (const value of resolved) {
        expect(value).not.toBe("");
      }
    }
  });
});

describe("countResults", () => {
  it("counts the FULL match set, above and beyond the cap", () => {
    /*
     * The announcement says the total, so a reader is never told "10 results"
     * when 214 matched — that would make a presentation limit look like a fact
     * about the tournament. This is the assertion the 7-row fixture could not
     * carry: it can never overflow a 10-row cap.
     */
    const total = countResults(corpus, "a");
    expect(total).toBeGreaterThan(10);
    expect(searchResults(corpus, "a", 10)).toHaveLength(10);
  });

  it("agrees with searchResults whenever the cap does not bite", () => {
    const query = "Türkiye";
    expect(countResults(corpus, query)).toBe(searchResults(corpus, query, 1000).length);
  });

  it("is zero for an empty or whitespace-only query", () => {
    expect(countResults(corpus, "")).toBe(0);
    expect(countResults(corpus, "   ")).toBe(0);
  });

  it("trims, exactly as searchResults does", () => {
    expect(countResults(corpus, "  mexico  ")).toBe(countResults(corpus, "mexico"));
  });
});
