"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CompareChartsSection } from "@/components/CompareChartsSection";
import { ComparePicker } from "@/components/ComparePicker";
import { CompareSideHeader, CompareStatRows } from "@/components/CompareRows";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { SortAnnouncerProvider } from "@/components/SortAnnouncer";
import { TacticalErrorBoundary } from "@/components/TacticalErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  compareWordKey,
  composeEmptyHeadline,
  composeInvalidHeadline,
  composeSideHeading,
  displayTeamCode,
} from "@/lib/compare-format";
import {
  compareSearch,
  parseCompareQuery,
  swapSides,
  type CompareParams,
  type CompareType,
} from "@/lib/compare-url";
import type {
  MatchBundle,
  PlayerProfile,
  Stage,
  TeamProfile,
  Tournament,
} from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { fetchArtifact } from "@/lib/data";
import { STAGES, stageLabelKey } from "@/lib/hub-model";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import { searchEntities, type SearchEntity, type SearchLabels } from "@/lib/search-model";
import { loadTournamentIndex } from "@/lib/tournament-index";
import { replaceUrlQuery, useUrlQuery } from "@/lib/use-url-query";
import {
  COMPARE_STATS_SECTION_ID,
  matchCompareRows,
  playerCompareRows,
  teamCompareRows,
  type CompareRow,
} from "@/viz/compare-model";

/*
 * ═══════════ `/compare`'s ONE CLIENT REGION (Story 2.17) ═══════════
 *
 * The route is a pre-rendered shell over this component. Everything the reader
 * sees below the container is decided here from ONE input: the query string.
 *
 * ═══════════ THE URL IS THE ONLY COMPARISON STATE (AR-10) ═══════════
 *
 * 🔴 NO `useState` IN THIS FILE HOLDS `type`, `a` OR `b`. Every one of them is
 * read out of `window.location.search` through `useUrlQuery()` on every render,
 * and every control writes back through `replaceUrlQuery`. Picking, swapping and
 * switching type are URL rewrites and nothing else. THE TEST OF THIS IS THE
 * ADDRESS BAR: if you can put the page into a state the URL does not describe,
 * or edit the URL into a state the page ignores, state is being held here that
 * should not be.
 *
 * The state that DOES live here is ephemeral view state, not comparison state:
 * the fetched payloads (AD-10 bars a store and a cache — a repeat comparison
 * re-fetches), the four-state status machines, and the rejected-slug NOTICE.
 *
 * ═══════════ WHY `rejected` IS NOT A BREACH OF THAT RULE ═══════════
 *
 * AC 5 requires two things at once: name the bad slug ("No encontramos brasil-99.
 * Elige de la lista.") AND drop it from the URL. Those are in tension — dropping
 * it destroys the only record of what the reader typed. So the slug is kept in
 * `rejected` purely as MESSAGE TEXT for the notice, never read back as a
 * selection, never fetched, never rendered as a comparison side, and cleared the
 * moment the reader picks again. The comparison itself remains entirely the URL's.
 *
 * ═══════════ THE VALIDATION ORDER DECIDES WHICH STATE SHOWS ═══════════
 *
 *  1. `type` missing or unknown  → treat as `players`, drop the bad param.
 *  2. `a` and `b` both absent    → EMPTY state (picker-first).
 *  3. a slug not in the manifest → INVALID state for that side; the OTHER side is
 *                                  preserved and still renders; the bad param is
 *                                  dropped from the URL.
 *  4. both present and listed    → fetch both.
 *
 * 🔴 VALIDATED AGAINST THE MANIFEST, NEVER AGAINST A 404. `tournament.json`'s
 * entity lists ARE the route manifest and the Pipeline asserts one artifact per
 * listed entity (AD-4), so a manifest hit GUARANTEES an artifact. A failed fetch
 * after a manifest hit is therefore a genuine `error` — retry may help — which is
 * a different state from `invalid`, where retry cannot. Conflating the two is the
 * bug 2.14 was careful to avoid and this region inherits the distinction.
 *
 * ═══════════ AC 6, DISCHARGED HONESTLY AND NOT OVERCLAIMED ═══════════
 *
 * There is no server. `out/compare/index.html` is BYTE-IDENTICAL for every query
 * string — it carries the shell in its picker-first empty state and not a single
 * comparison row, exactly as `static-output.test.ts` states the same property for
 * the Hub. What a pasted URL reproduces is this: the same comparison, with no
 * user input, ON THE FIRST CLIENT RENDER AFTER HYDRATION, through the same
 * four-state region machine the other five routes use. `useUrlQuery`'s snapshot
 * is read synchronously, so there is no frame at the wrong state — but this is
 * not "on first paint", and nothing here claims it is.
 */

/**
 * "error" and "invalid" ARE DELIBERATELY DISTINCT, on every region's terms in
 * this tree: a fetch that failed is a network problem the reader can retry; a
 * payload that ARRIVED INTACT and then failed the id/schemaVersion gate is a
 * data-integrity problem, and "a retry cannot change the answer."
 */
type Status = "loading" | "loaded" | "error" | "invalid";

/** DEVELOPER-facing console label, never user copy — hence a const, not a t(). */
const COMPARE_LOG_LABEL = "CompareRegion render failed";

/*
 * How long the picker's query must be idle before its result count is announced.
 * Copied from `HeaderSearch` and `LeaderboardsRegion` with the same recorded
 * rationale — "typing an eight-letter name queued eight utterances". Only the
 * ANNOUNCEMENT is debounced; the visible list never lags the caret.
 */
const ANNOUNCE_SETTLE_MS = 400;

/**
 * What joins two announced sentences. A const rather than a literal because a
 * bare string in JSX trips the i18n gate — and because the shipped code had no
 * separator at all, which read two sentences out as one word.
 */
const SENTENCE_JOIN = " ";

/** One side's fetched artifact, discriminated by the type that fetched it. */
type ComparePair =
  | { type: "players"; a: PlayerProfile; b: PlayerProfile }
  | { type: "teams"; a: TeamProfile; b: TeamProfile }
  | { type: "matches"; a: MatchBundle; b: MatchBundle };

/** One side the URL named and the manifest does not list. */
interface RejectedSide {
  side: "a" | "b";
  slug: string;
}

/**
 * The sides `params` names that `manifest` does not list.
 *
 * PURE, and outside the component so the render-phase detection above cannot
 * accidentally close over anything. Validated against the MANIFEST, never against
 * a 404 — see the module header for why those are different failures.
 */
function droppedSides(
  params: CompareParams,
  manifest: Record<CompareType, Map<string, SearchEntity>>
): RejectedSide[] {
  /*
   * 🔴 A BAD `type` DISQUALIFIES ITS OWN SLUGS FROM JUDGEMENT (code review
   * 2026-08-07). `?type=team&a=mexico` used to do two contradictory things at
   * once: fall the type back to `players` AND tell the reader "No encontramos
   * mexico" — blaming them for a slug that is perfectly valid for the type they
   * plainly meant, and that was only ever checked against the WRONG manifest.
   *
   * The slugs are still dropped from the URL by the cleanup effect; what is
   * suppressed here is the accusation, which is the part that was false.
   */
  if (params.droppedType) {
    return [];
  }
  const listed = manifest[params.type];
  const dropped: RejectedSide[] = [];
  if (params.a !== null && !listed.has(params.a)) {
    dropped.push({ side: "a", slug: params.a });
  }
  if (params.b !== null && !listed.has(params.b)) {
    dropped.push({ side: "b", slug: params.b });
  }
  return dropped;
}

/** The two column heads for one match block: its own home and away codes. */
function matchHeads(bundle: MatchBundle): { a: string; b: string } {
  return {
    // `matchCompareRows` maps `home` onto column A and `away` onto column B.
    a: displayTeamCode(bundle.metadata.homeTeam.teamCode),
    b: displayTeamCode(bundle.metadata.awayTeam.teamCode),
  };
}

/**
 * The comparison's layout-shaped placeholder: two headers, a row block, two
 * charts.
 *
 * ONE COPY FOR BOTH WAITS. The route has two of them — the index fetch that
 * precedes a pasted URL's comparison, and the artifact fetch that follows it —
 * and a placeholder that does not match the layout it stands in for is a CLS hit
 * rather than a courtesy. Two hand-maintained copies would drift the first time
 * a section moved.
 *
 * It carries NO `aria-busy` and NO label of its own: each caller owns the
 * announced state, and only one of them takes focus.
 */
function ComparisonSkeleton() {
  return (
    <div className="grid gap-tile-gap">
      <div className="grid gap-tile-gap md:grid-cols-2">
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-16 w-full" />
      </div>
      <div className="skeleton mt-6 h-64 w-full" />
      <div className="grid gap-tile-gap md:grid-cols-2">
        <div className="skeleton h-[228px] w-full" />
        <div className="skeleton h-[228px] w-full" />
      </div>
    </div>
  );
}

/** What the picker and the headers need about one chosen entity. */
interface SideRef {
  id: string;
  name: string;
  detail: string | null;
  /** The team code that labels this side's chart series, or null. */
  code: string | null;
}

/*
 * THE THREE FETCH CALL SITES, WRITTEN OUT SEPARATELY AND DELIBERATELY.
 *
 * `src/app/static-output.test.ts`'s module-graph walk finds artifact paths with a
 * regex over the fetch helper's call syntax — both the string-literal and the
 * template-literal spellings — so a single call site over a path built from a
 * VARIABLE would make this route's allow-list read as fetching NOTHING. That is
 * the same blind spot Story 2.14 Task 10.5 closed for the match route. Three
 * literal template call sites is what makes the allow-list assert the truth.
 *
 * ⚠️ THE REGEX ALSO READS COMMENTS. An illustrative call written out in prose
 * anywhere in this module's graph lands in the allow-list as a phantom artifact
 * path, which is why the syntax is described above rather than quoted.
 */
function fetchSide(
  type: CompareType,
  id: string
): Promise<PlayerProfile | TeamProfile | MatchBundle> {
  if (type === "players") {
    return fetchArtifact<PlayerProfile>(`/index/player-profiles/${id}.json`);
  }
  if (type === "teams") {
    return fetchArtifact<TeamProfile>(`/index/team-profiles/${id}.json`);
  }
  return fetchArtifact<MatchBundle>(`/matches/${id}.json`);
}

/**
 * VALIDATE BEFORE DECLARING SUCCESS.
 *
 * `payload` IS TYPED NON-NULL, WHICH PROVES NOTHING — this is the untyped fetch
 * boundary and the type is a cast. A stale CDN copy or a redirected 200 parses
 * fine and would render another entity's numbers under this entity's name, which
 * on a COMPARISON is worse than on a profile: the reader is looking at the two
 * side by side and has no second surface to catch it against.
 */
function isSideValid(
  type: CompareType,
  id: string,
  payload: PlayerProfile | TeamProfile | MatchBundle
): boolean {
  if (payload.schemaVersion !== SCHEMA_VERSION) {
    return false;
  }
  if (type === "players") {
    return (payload as PlayerProfile).playerId === id;
  }
  if (type === "teams") {
    return (payload as TeamProfile).teamId === id;
  }
  return (payload as MatchBundle).matchId === id;
}

export function CompareRegion() {
  const t = useT();
  const { locale } = useLocale();

  /* ─────────────────────────── The URL, and only it ─────────────────────── */

  const search = useUrlQuery();
  const params: CompareParams = parseCompareQuery(search);

  /* ──────────────────────── The index: corpus + manifest ────────────────── */

  const [indexStatus, setIndexStatus] = useState<Status>("loading");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [indexAttempt, setIndexAttempt] = useState(0);

  /*
   * FETCHED ON MOUNT, not lazily on engagement — a declared, scoped divergence
   * from `HeaderSearch`, whose whole ruling 1 is that the header must NOT pay for
   * this artifact on four routes that never use it.
   *
   * The reason inverts here: on `/compare` the index IS the route's own data. It
   * is the picker's corpus AND the slug manifest AND the source of every entity
   * name the headers print, so nothing on this route can render without it — not
   * even the invalid state, which needs the manifest to know a slug is invalid.
   *
   * IT IS STILL FETCHED AT MOST ONCE PER PAGE LOAD. `loadTournamentIndex()` holds
   * a module-scope promise shared with the header search, so a reader who has
   * already used search pays for it once, not twice.
   */
  useEffect(() => {
    let cancelled = false;
    loadTournamentIndex()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        // SCHEMA_VERSION comes from the GENERATED module and is never hardcoded.
        if (payload.schemaVersion !== SCHEMA_VERSION) {
          setIndexStatus("invalid");
          return;
        }
        setTournament(payload);
        setIndexStatus("loaded");
      })
      .catch(() => {
        /*
         * Every consumer catches: the loader clears its module slot on rejection
         * and RE-THROWS, and an unhandled rejection would breach the zero-console
         * bar as well as leaving this region in "loading" forever.
         */
        if (!cancelled) {
          setIndexStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [indexAttempt]);

  /*
   * The corpus, built once per (artifact, locale) pair — `HeaderSearch`'s useMemo
   * exactly. Locale is a real dependency: match detail lines carry resolved stage
   * labels and team details carry the resolved group word, so a mid-session
   * ES|EN toggle must rebuild them. Names pass through untranslated (FR-30).
   */
  const labels: SearchLabels = useMemo(
    () => ({
      stageLabels: Object.fromEntries(
        STAGES.map((stage) => [stage, t(stageLabelKey(stage))])
      ) as Record<Stage, string>,
      groupWord: t("match.hero.group"),
      separator: t("hub.separator"),
      scoreSeparator: t("match.hero.scoreSeparator"),
      extraTimeShort: t("hub.results.extraTimeShort"),
      penShort: t("match.meta.penShort"),
    }),
    [t]
  );

  const corpus = useMemo(
    () => (tournament === null ? [] : searchEntities(tournament, labels)),
    [tournament, labels]
  );

  /*
   * THE ROUTE MANIFEST, indexed by kind. `tournament.json`'s entity lists ARE the
   * manifest (AD-4), and the corpus is already a faithful projection of them with
   * the display names and detail lines composed — so building the lookup from the
   * corpus keeps ONE source for both jobs instead of walking `entities` twice.
   */
  const manifest = useMemo(() => {
    const byKind = {
      players: new Map<string, SearchEntity>(),
      teams: new Map<string, SearchEntity>(),
      matches: new Map<string, SearchEntity>(),
    };
    for (const entity of corpus) {
      if (entity.kind === "player") {
        byKind.players.set(entity.id, entity);
      } else if (entity.kind === "team") {
        byKind.teams.set(entity.id, entity);
      } else {
        byKind.matches.set(entity.id, entity);
      }
    }
    return byKind;
  }, [corpus]);

  /**
   * The three-letter code that labels one side's chart series (UX-DR11 channel 1).
   *
   * A TEAM'S OWN CODE FOR A TEAM; A PLAYER'S TEAM'S CODE FOR A PLAYER. `teamCode`
   * is a real contract field on `entities.teams[]`; `PlayerProfile` carries no
   * code of its own — only a shirt number, which reads as a VALUE beside a
   * numeric axis and identifies nothing across two clubs. The player's team is
   * the disambiguator `search-model.ts` already ruled for the same reason
   * ("Emiliano MARTINEZ occurs twice in the real corpus").
   *
   * Two players from the same squad therefore carry the same code. That is
   * accepted rather than worked around: they sit in two SEPARATE charts told apart
   * by accent and hatch (D4/D5), so the code names the series' subject and never
   * has to distinguish it.
   */
  const seriesCode = useCallback(
    (type: CompareType, id: string): string | null => {
      const entities = tournament?.entities;
      if (entities === undefined || entities === null) {
        return null;
      }
      const teams = Array.isArray(entities.teams) ? entities.teams : [];
      if (type === "teams") {
        const own = teams.find((team) => team.teamId === id)?.teamCode;
        return own === undefined ? null : displayTeamCode(own);
      }
      if (type === "players") {
        const players = Array.isArray(entities.players) ? entities.players : [];
        const teamId = players.find((player) => player.playerId === id)?.team?.id;
        const code = teams.find((team) => team.teamId === teamId)?.teamCode;
        return code === undefined ? null : displayTeamCode(code);
      }
      // Matches carry their own home/away codes inside the bundle.
      return null;
    },
    [tournament]
  );

  const sideRef = useCallback(
    (type: CompareType, id: string | null): SideRef | null => {
      if (id === null) {
        return null;
      }
      const entity = manifest[type].get(id);
      if (entity === undefined) {
        return null;
      }
      return { id, name: entity.name, detail: entity.detail, code: seriesCode(type, id) };
    },
    [manifest, seriesCode]
  );

  /* ────────────────────── Validation and the URL cleanup ────────────────── */

  const indexReady = indexStatus === "loaded" && tournament !== null;

  /**
   * Which sides the CURRENT url names but the manifest does not list.
   *
   * DERIVED DURING RENDER, never stored — this is the detection, and it re-runs
   * from the URL and the manifest on every pass. The `notice` below is only what
   * makes it survive the cleanup that follows.
   */
  const droppedNow: RejectedSide[] = indexReady ? droppedSides(params, manifest) : [];

  /**
   * The slugs this route refused, carried ONLY as message text. See the header.
   *
   * 🔴 WHY A CARRY-OVER IS NEEDED AT ALL. AC 5 requires two things that fight each
   * other: NAME the bad slug and DROP it from the URL. The drop destroys the only
   * record of what the reader typed, so on the very next render `droppedNow` is
   * empty and the notice would vanish before it was read.
   *
   * THIS IS THE "ADJUST STATE WHEN AN INPUT CHANGES" PATTERN, React's own
   * documented answer to exactly this shape, and it is the one legal place for the
   * assignment: the same store notification that delivers the cleaned URL also
   * re-renders this component, so there is no effect to put it in — and a
   * synchronous `setState` inside an effect body is a cascading render the React
   * Compiler lint rejects outright (`react-hooks/set-state-in-effect`), while a
   * ref read during render is rejected just as flatly (`react-hooks/refs`).
   *
   * `key` is the query string the notice was captured FROM, which is what makes
   * the guard terminate: the assignment fires once per offending URL and never
   * again for that URL.
   */
  const [notice, setNotice] = useState<{ key: string; items: RejectedSide[] }>({
    key: "",
    items: [],
  });
  if (droppedNow.length > 0 && notice.key !== search) {
    setNotice({ key: search, items: droppedNow });
  }
  /*
   * The live detection wins while it lasts; the carry-over covers the single
   * render after the cleanup. Once the reader picks again, `writeParams` clears
   * the carry-over and both are empty.
   */
  const rejected = droppedNow.length > 0 ? droppedNow : notice.items;

  /*
   * 🔴 THE INVALID-PARAM DROP, RE-ENTRY-GUARDED IN TWO PLACES.
   *
   * `replaceUrlQuery` NOTIFIES the very subscription that renders this component,
   * so an ungated write here re-renders, re-detects and re-writes forever. Two
   * things stop that: the writer's own string-equality guard (a write that would
   * not change the query is a no-op), and the fact that after a successful drop
   * the offending param is GONE, so the branch below early-returns on the next
   * pass. Both are load-bearing; neither alone is enough.
   *
   * Parsed INSIDE the effect rather than depending on `params`, which is a fresh
   * object every render and would re-fire this on every keystroke in the picker.
   */
  useEffect(() => {
    if (!indexReady) {
      return;
    }
    const current = parseCompareQuery(search);
    const listed = manifest[current.type];
    const badA = current.a !== null && !listed.has(current.a);
    const badB = current.b !== null && !listed.has(current.b);
    /*
     * `?a=X&b=X` IS NOT A COMPARISON, and it was reachable in two clicks. Side B
     * is the one dropped: A is the side the reader fills first and the one every
     * inbound `compareHref` from a profile populates, so dropping B leaves the
     * partial state pointing at the entity they arrived with.
     */
    const duplicate = current.a !== null && current.a === current.b;
    if (!badA && !badB && !duplicate && !current.droppedType) {
      return;
    }
    /*
     * THE VALID SIDE IS PRESERVED (AC 5) — except under `droppedType`, where
     * neither slug was ever validated against the type it was written for and
     * keeping one would silently reinterpret it as a player id. This is a pure
     * external-system write; nothing is assigned here.
     */
    replaceUrlQuery(
      compareSearch({
        type: current.type,
        a: current.droppedType || badA ? null : current.a,
        b: current.droppedType || badB || duplicate ? null : current.b,
      })
    );
  }, [search, indexReady, manifest]);

  /* ────────────────────────────── The two sides ─────────────────────────── */

  /*
   * The three primitives the fetch depends on, extracted so the effect's
   * dependency array holds VALUES rather than the per-render `params` object.
   */
  const type = params.type;
  const idA = params.a;
  const idB = params.b;
  /*
   * `idA !== idB` IS PART OF "BOTH LISTED", not a separate check. The cleanup
   * effect above drops the duplicate, but it lands one render later — and without
   * this the degenerate pair renders in the meantime with duplicate React keys
   * and two byte-identical figure captions.
   */
  const bothListed =
    indexReady &&
    idA !== null &&
    idB !== null &&
    idA !== idB &&
    manifest[type].has(idA) &&
    manifest[type].has(idB);

  const [dataAttempt, setDataAttempt] = useState(0);
  const busyRef = useRef<HTMLDivElement>(null);

  // Retry unmounts the panel that owns focus, dropping the caret to <body>.
  useEffect(() => {
    if (dataAttempt > 0) {
      busyRef.current?.focus();
    }
  }, [dataAttempt]);

  /**
   * WHICH COMPARISON THE CURRENT URL ASKS FOR — `""` when it asks for none.
   *
   * A single string, because it is what makes the result below SELF-INVALIDATING.
   */
  const requestKey = bothListed ? `${type}|${idA ?? ""}|${idB ?? ""}|${dataAttempt}` : "";

  /**
   * The fetch outcome, TAGGED WITH THE REQUEST IT ANSWERS.
   *
   * 🔴 THE TAG IS WHAT LETS THIS BE ONE STATE SET ONLY FROM ASYNC CALLBACKS. The
   * obvious shape — `pair` plus `status`, with the effect resetting both to
   * "loading" on the way in — puts a SYNCHRONOUS `setState` in an effect body,
   * which is a cascading render the React Compiler lint rejects outright
   * (`react-hooks/set-state-in-effect`). Tagging the result instead means staleness
   * is DERIVED rather than cleared: the moment the URL changes, `requestKey`
   * changes, the stored key no longer matches, and the render below reads
   * "loading" without anything having been assigned. A stale comparison can never
   * be shown beside a half-filled picker, because a stale result is not equal to
   * the question being asked.
   */
  const [result, setResult] = useState<{
    key: string;
    status: Status;
    pair: ComparePair | null;
  }>({ key: "", status: "loading", pair: null });

  const dataStatus: Status =
    requestKey !== "" && result.key === requestKey ? result.status : "loading";
  const pair = dataStatus === "loaded" ? result.pair : null;

  useEffect(() => {
    if (requestKey === "" || idA === null || idB === null) {
      // Fewer than two valid sides. Not an error and not a load — and nothing to
      // assign, because `dataStatus` already derives "loading" from the mismatch.
      return;
    }
    let cancelled = false;
    /*
     * EXACTLY TWO ARTIFACTS (AC 1, FR-34), fetched together. `Promise.all`
     * rejects on the first failure, which is the behaviour we want: half a
     * comparison is not a comparison, and the error state covers both sides.
     *
     * NO CACHE LAYER (AD-10). A repeat comparison re-fetches; the browser's own
     * HTTP cache is the only memory this route has, and that is deliberate.
     */
    Promise.all([fetchSide(type, idA), fetchSide(type, idB)])
      .then(([payloadA, payloadB]) => {
        if (cancelled) {
          return;
        }
        if (!isSideValid(type, idA, payloadA) || !isSideValid(type, idB, payloadB)) {
          setResult({ key: requestKey, status: "invalid", pair: null });
          return;
        }
        let next: ComparePair;
        if (type === "players") {
          next = { type, a: payloadA as PlayerProfile, b: payloadB as PlayerProfile };
        } else if (type === "teams") {
          next = { type, a: payloadA as TeamProfile, b: payloadB as TeamProfile };
        } else {
          next = { type, a: payloadA as MatchBundle, b: payloadB as MatchBundle };
        }
        setResult({ key: requestKey, status: "loaded", pair: next });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key: requestKey, status: "error", pair: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, type, idA, idB]);

  /* ──────────────────────────── The URL writers ─────────────────────────── */

  /*
   * 🔴 `history.replaceState`, NOT `router.replace`, AND THE COST WAS MEASURED.
   *
   * `router.replace` notifies the App Router, which under `output: "export"` may
   * fetch the route's RSC payload — `out/compare/index.txt` is a real file you can
   * see in the export. `history.replaceState` costs ZERO network requests and does
   * not notify the App Router, which is harmless HERE precisely because D1 does
   * not use `useSearchParams`: nothing in this route reads the URL through Next,
   * so there is nothing for the router to keep in sync. The numbers are in the
   * story's Completion Notes.
   *
   * `replaceState` rather than `pushState`: picking, swapping and switching type
   * are refinements of ONE comparison, not separate destinations, so they must not
   * each cost a Back press to escape.
   */
  /*
   * PLAIN FUNCTIONS, NOT `useCallback` — the React Compiler memoizes them, and a
   * manual dependency array here is worse than none: the compiler infers the
   * setState identities as dependencies too, so a hand-written `[]` or
   * `[indexStatus]` disagrees with the inferred set and the whole component is
   * DROPPED FROM OPTIMIZATION with a `preserve-manual-memoization` error.
   * `TrendsSection` and every other section in this tree already use the plain
   * form for the same reason.
   */
  function writeParams(next: CompareParams): void {
    // Clear the carry-over: a reader who has fixed one side should not keep
    // reading about the one they already replaced.
    setNotice({ key: "", items: [] });
    replaceUrlQuery(compareSearch({ type: next.type, a: next.a, b: next.b }));
  }

  function handleTypeChange(next: CompareType): void {
    /*
     * BOTH SIDES CLEAR ON A TYPE CHANGE, and that is a ruling. A player id is
     * never a team id, so carrying `a`/`b` across would send both straight to the
     * manifest check and render two "No encontramos …" notices for slugs the
     * reader never typed — punishing them for using the control as intended.
     */
    writeParams({ type: next, a: null, b: null, droppedType: false });
  }

  function handlePick(side: "a" | "b", entity: SearchEntity): void {
    /*
     * Re-read from `window.location.search` rather than closing over `params`:
     * this fires from a listbox row, and the URL is the truth by then even if
     * this closure was created a render earlier.
     */
    const current = parseCompareQuery(window.location.search);
    writeParams({ ...current, [side]: entity.id });
  }

  /*
   * SWAP IS A URL REWRITE AND NOTHING ELSE (AC 2). No component state holds the
   * comparison, so exchanging the two ids IS the whole operation — the page then
   * re-renders from the new query exactly as it would from a pasted one. Swapping
   * a one-sided comparison MOVES the single entity rather than no-oping, which is
   * what a reader who wants their pick on the right means by pressing it.
   */
  function handleSwap(): void {
    writeParams(swapSides(parseCompareQuery(window.location.search)));
  }

  /* ─────────────────────────── Picker announcements ─────────────────────── */

  const [announcement, setAnnouncement] = useState("");
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (announceTimer.current !== null) {
        clearTimeout(announceTimer.current);
      }
    };
  }, []);

  /*
   * 400 ms, copied from `HeaderSearch` and `LeaderboardsRegion` with the same
   * recorded rationale — "typing an eight-letter name queued eight utterances".
   * Only the ANNOUNCEMENT is debounced; the visible list is never behind the caret.
   */
  function announce(sentence: string): void {
    if (announceTimer.current !== null) {
      clearTimeout(announceTimer.current);
    }
    announceTimer.current = setTimeout(() => {
      setAnnouncement(sentence);
    }, ANNOUNCE_SETTLE_MS);
  }

  /*
   * The index is fetched on mount, so there is nothing for engagement to trigger
   * — except a RETRY after a failure, which is the one thing `HeaderSearch`'s
   * counter exists for. `invalid` deliberately does not retry: "a retry cannot
   * change the answer."
   */
  function handleEngage(): void {
    if (indexStatus === "error") {
      setIndexStatus("loading");
      setIndexAttempt((value) => value + 1);
    }
  }

  /* ───────────────────────────────── Render ─────────────────────────────── */

  const refA = sideRef(type, idA);
  const refB = sideRef(type, idB);
  const chosenCount = (idA === null ? 0 : 1) + (idB === null ? 0 : 1);

  const emptyHeadline = composeEmptyHeadline({
    before: t("compare.empty.headlineBefore"),
    typeWord: t(compareWordKey(type)),
    after: t("compare.empty.headlineAfter"),
  });

  /**
   * EVERY OUTCOME THIS REGION CAN REACH, AS ONE SENTENCE.
   *
   * 🔴 THREE DEFECTS ARE FIXED BY BUILDING IT HERE RATHER THAN INLINE IN JSX
   * (code review 2026-08-07). Adjacent JSX children are concatenated with NO
   * separator, so a settled keystroke beside a loaded comparison was announced as
   * "5 resultadosComparación cargada." — two sentences read as one word. The
   * `rejected`, `indexStatus === "error"` and `indexStatus === "invalid"` panels
   * were not announced AT ALL, though each is a visible change of state. And a
   * reader who never leaves the picker heard the load confirmation re-read on
   * every settled keystroke, because any change to a live region's text re-reads
   * ALL of it — which is why the picker's counts now live in their own region
   * below rather than sharing this one.
   */
  const regionSentences: string[] = [];
  if (indexStatus === "error") {
    regionSentences.push(t("compare.region.error"));
  }
  if (indexStatus === "invalid") {
    regionSentences.push(t("compare.region.invalid"));
  }
  for (const entry of rejected) {
    regionSentences.push(
      composeInvalidHeadline({
        before: t("compare.invalid.headlineBefore"),
        slug: entry.slug,
        after: t("compare.invalid.headlineAfter"),
      })
    );
  }
  if (dataStatus === "loaded") {
    regionSentences.push(t("compare.region.loaded"));
  }
  if (dataStatus === "error") {
    regionSentences.push(t("compare.region.error"));
  }
  if (dataStatus === "invalid") {
    regionSentences.push(t("compare.region.invalid"));
  }
  const regionAnnouncement = regionSentences.join(SENTENCE_JOIN);

  return (
    <div className="mt-6">
      {/*
       * TWO polite regions, both mounted UNCONDITIONALLY — "a live region that
       * mounts already-populated does not announce reliably" is stated verbatim in
       * four files in this tree.
       *
       * They are SEPARATE because they answer to different events. The picker's
       * result count changes on every settled keystroke; the comparison's outcome
       * changes when an artifact lands. Sharing one region made each re-read the
       * other's text, which is the stale-confirmation defect above.
       */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <span aria-live="polite" className="sr-only">
        {regionAnnouncement}
      </span>

      <ComparePicker
        corpus={corpus}
        corpusStatus={indexStatus}
        type={type}
        aName={refA?.name ?? null}
        bName={refB?.name ?? null}
        aId={idA}
        bId={idB}
        onEngage={handleEngage}
        onAnnounce={announce}
        onTypeChange={handleTypeChange}
        onPick={handlePick}
        onSwap={handleSwap}
      />

      {/*
       * `layer-gap` at the picker → comparison boundary; `section-gap` inside the
       * comparison. The two spacings are the route's disclosure grammar, not
       * decoration.
       */}
      <div className="mt-layer-gap">
        {/*
         * THE REFUSED SLUGS, NAMED. Rendered ABOVE whatever state the surviving
         * side produces, because AC 5 requires both at once: the valid side is
         * preserved and still renders, and the reader is still told what happened
         * to the other one.
         */}
        {rejected.map((entry) => (
          <div key={entry.side} className="mb-tile-gap">
            <EmptyStatePanel
              headline={composeInvalidHeadline({
                before: t("compare.invalid.headlineBefore"),
                slug: entry.slug,
                after: t("compare.invalid.headlineAfter"),
              })}
              explanation={t("compare.empty.explanation")}
            />
          </div>
        ))}

        {indexStatus === "error" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
            <p className="type-body text-destructive">{t("compare.region.error")}</p>
            <Button variant="destructive" onClick={handleEngage} className="mt-3 min-h-11">
              {t("match.bundle.retry")}
            </Button>
          </div>
        ) : null}

        {/* Arrived intact, wrong schema. NO RETRY. */}
        {indexStatus === "invalid" ? (
          <EmptyStatePanel
            headline={t("compare.region.invalid")}
            explanation={t("compare.region.invalidExplanation")}
          />
        ) : null}

        {/*
         * 🔴 NOT GATED ON THE INDEX, DELIBERATELY. "Elige dos jugadores para
         * comparar." is true before the corpus lands as well as after, and this is
         * what makes `out/compare/index.html` carry the picker-first empty state
         * rather than a blank slot: `useUrlQuery`'s server snapshot is `""`, which
         * parses to zero chosen sides, so the PRE-RENDERED document is already the
         * right answer for a reader arriving with no query. That is the property
         * D1 claims for the static shell, and it would be false if this branch
         * waited for a fetch that never happens at build time.
         *
         * Suppressed only when the index itself failed, where its own panel is
         * the more specific message.
         */}
        {chosenCount === 0 && indexStatus !== "error" && indexStatus !== "invalid" ? (
          <EmptyStatePanel headline={emptyHeadline} explanation={t("compare.empty.explanation")} />
        ) : null}

        {/*
         * 🔴 THE INDEX IS STILL IN FLIGHT AND THE URL ALREADY NAMES A SIDE — AC
         * 6's OWN PATH, and it rendered a blank, unannounced region until the
         * fetch landed (code review 2026-08-07).
         *
         * Every other branch on this route is gated on `chosenCount === 0`, on
         * `indexReady`, or on `bothListed` (which implies `indexReady`), and NONE
         * of them can be true first: a pasted `?a=&b=` has a non-zero
         * `chosenCount`, so the empty state is suppressed, while the partial,
         * loading, error and comparison branches all wait on the manifest. The
         * reader who followed a shared link — the exact reader UJ-3 is about —
         * saw the picker over dead space with nothing to announce it.
         *
         * It is `aria-busy` and NOT focused: unlike the retry path below there is
         * no unmounted panel that owned the caret, so moving focus here would
         * steal it from a reader already tabbing the picker.
         */}
        {chosenCount > 0 && indexStatus === "loading" ? (
          <div aria-busy="true" aria-label={t("compare.region.loading")}>
            <ComparisonSkeleton />
          </div>
        ) : null}

        {/*
         * THE PARTIAL STATE, SINGLE-COLUMN (AC 5). One side chosen, the other
         * still open.
         *
         * IT FETCHES NOTHING, and that is deliberate rather than lazy. The chosen
         * entity's name and detail come from the index the picker already holds,
         * so a half-filled picker costs zero artifact requests — which is what
         * keeps AC 1's "exactly the two entities' bundles" literally true: the
         * route never fetches one.
         */}
        {indexReady && chosenCount === 1 ? (
          <div className="grid gap-tile-gap md:grid-cols-2">
            {[refA, refB].map((ref, index) =>
              ref === null ? null : (
                <CompareSideHeader
                  key={ref.id}
                  heading={composeSideHeading(ref.name, ref.detail)}
                  meta={null}
                  side={index === 0 ? "a" : "b"}
                />
              )
            )}
            <div className="md:col-span-2">
              <EmptyStatePanel
                headline={t("compare.partial.headline")}
                explanation={t("compare.partial.explanation")}
              />
            </div>
          </div>
        ) : null}

        {chosenCount === 2 && bothListed && dataStatus === "loading" ? (
          <div
            ref={busyRef}
            tabIndex={-1}
            aria-busy="true"
            aria-label={t("compare.region.loading")}
          >
            <ComparisonSkeleton />
          </div>
        ) : null}

        {chosenCount === 2 && dataStatus === "error" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
            <p className="type-body text-destructive">{t("compare.region.error")}</p>
            <Button
              variant="destructive"
              /*
               * Bumping the attempt counter is the WHOLE retry: it changes
               * `requestKey`, which makes the stored result stale by derivation,
               * which puts the region back in "loading" and re-fires the fetch.
               * Nothing needs clearing because nothing was ever assigned on the
               * way in.
               */
              onClick={() => {
                setDataAttempt((value) => value + 1);
              }}
              className="mt-3 min-h-11"
            >
              {t("match.bundle.retry")}
            </Button>
          </div>
        ) : null}

        {chosenCount === 2 && dataStatus === "invalid" ? (
          <EmptyStatePanel
            headline={t("compare.region.invalid")}
            explanation={t("compare.region.invalidExplanation")}
          />
        ) : null}

        {/*
         * EXACTLY ONE `SortAnnouncerProvider` for the route, and it is OUTSIDE the
         * status gate so its one polite region is mounted for the region's
         * lifetime rather than appearing with the payload — a live region that
         * mounts already-populated does not announce reliably, and mounting it
         * with the data would also reset it on the error-path retry.
         */}
        <SortAnnouncerProvider>
          {dataStatus === "loaded" && pair !== null && refA !== null && refB !== null ? (
            /*
             * The boundary keeps the model's and the format layer's honesty from
             * costing the reader the whole route: both throw loudly by design, and
             * the picker above must survive a bad payload so the reader can choose
             * something else.
             */
            <TacticalErrorBoundary
              headlineKey="compare.region.crashed"
              explanationKey="compare.region.crashedExplanation"
              logLabel={COMPARE_LOG_LABEL}
            >
              <ComparisonBody pair={pair} refA={refA} refB={refB} locale={locale} />
            </TacticalErrorBoundary>
          ) : null}
        </SortAnnouncerProvider>
      </div>
    </div>
  );
}

/**
 * The comparison itself, in the ruled disclosure-grammar order (`EXPERIENCE.md:
 * 209` — "headline aggregates first, tactical identity/trend visualizations
 * second"): the two entity headers, the mirrored stat rows, then the vizzes.
 *
 * PLAIN `<section>` BLOCKS WITH STABLE ENGLISH ANCHOR IDS. There is no collapsible
 * shell on this route: `TacticalSection` is do-not-touch and its `id` prop is
 * typed to the closed eleven-member `SectionId`, so widening that union for a
 * route with no collapsing was rejected outright.
 *
 * Split out of the region so EVERY model call sits INSIDE the error boundary — a
 * throw in `playerCompareRows` at the region's own body would escape it.
 */
function ComparisonBody({
  pair,
  refA,
  refB,
  locale,
}: {
  pair: ComparePair;
  refA: SideRef;
  refB: SideRef;
  locale: "es" | "en";
}) {
  const t = useT();

  /*
   * EVERY ROW IS BUILT EAGERLY, HERE, before any chart or disclosure mounts —
   * Story 2.9's review finding, restated: "Guard at model entry and fail loud on
   * load." A bad value must fail when the comparison loads, not the first time
   * the reader opens "Ver los datos".
   */
  let rowsA: readonly CompareRow[];
  let rowsB: readonly CompareRow[] | null;
  /*
   * COLUMN HEADS ONLY WHERE THE SIDE HEADER CANNOT NAME THE PAIR — `matches`.
   * See `ColumnHeads`' docblock: for `players`/`teams` the header directly above
   * the rows already names both columns, so heads there would be a second home
   * for one name.
   */
  let headsA: { a: string; b: string } | null = null;
  let headsB: { a: string; b: string } | null = null;
  if (pair.type === "players") {
    rowsA = playerCompareRows(pair.a, pair.b);
    rowsB = null;
  } else if (pair.type === "teams") {
    rowsA = teamCompareRows(pair.a, pair.b);
    rowsB = null;
  } else {
    /*
     * TWO BLOCKS FOR `matches`, ONE FOR THE OTHER TWO TYPES (R1, option A). A
     * match has no single value to place opposite another match's, so each side
     * renders its OWN home-vs-away block; the cross-side comparison is carried by
     * the shared chart axis and by reading the two blocks side by side.
     */
    rowsA = matchCompareRows(pair.a);
    rowsB = matchCompareRows(pair.b);
    headsA = matchHeads(pair.a);
    headsB = matchHeads(pair.b);
  }

  return (
    <>
      <div className="grid gap-tile-gap md:grid-cols-2">
        <CompareSideHeader
          heading={refA.name}
          meta={refA.detail}
          side="a"
        />
        <CompareSideHeader
          heading={refB.name}
          meta={refB.detail}
          side="b"
        />
      </div>

      <section id={COMPARE_STATS_SECTION_ID} className="mt-section-gap">
        <h2 className="type-title text-ink-primary">{t("compare.section.stats")}</h2>
        {rowsB === null ? (
          <CompareStatRows rows={rowsA} />
        ) : (
          <div className="grid gap-tile-gap md:grid-cols-2">
            <div className="min-w-0">
              <CompareStatRows rows={rowsA} heads={headsA} />
            </div>
            <div className="min-w-0">
              <CompareStatRows rows={rowsB} heads={headsB} />
            </div>
          </div>
        )}
      </section>

      <CompareChartsSection pair={pair} refA={refA} refB={refB} locale={locale} />
    </>
  );
}
