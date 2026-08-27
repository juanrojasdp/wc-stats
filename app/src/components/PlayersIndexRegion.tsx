"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { TacticalErrorBoundary } from "@/components/TacticalErrorBoundary";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import { Button } from "@/components/ui/button";
import type { PlayerEntity, Position } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { formatInteger } from "@/lib/format";
import { playerHref } from "@/lib/hub-model";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  type PlayerTeamGroup,
  filterPlayerGroups,
  groupPlayersByTeam,
} from "@/lib/players-index";
import { loadTournamentIndex } from "@/lib/tournament-index";

/*
 * ═══════════ `/players` — THE PLAYER INDEX, RUNTIME HALF (Story 3.9, D4/D5b) ═
 *
 * 🔴 A CLIENT FETCH, NEVER A BUILD-TIME READ OF THE 1,248. AD-11 defines
 * exactly two data paths and bans a third; `tournament.json` is 409,512 B raw
 * (Story 1.17's measurement), which is precisely the "inlining full bundles into
 * HTML" the architecture forbids. Rendering 1,248 players into the export would
 * also put that weight straight onto this route's own first Lighthouse median —
 * the floor story 3.9 is recording. The page shell reads the artifact for its
 * `<title>` and nothing else.
 *
 * THE STATUS MACHINE IS `TournamentHubRegion`'s, NOT A FIFTH IMPLEMENTATION.
 * Four states, and "error" and "invalid" stay distinct for its stated reason: a
 * fetch that failed is a network problem the reader can retry; a payload that
 * ARRIVED INTACT and then failed the schemaVersion gate is a data-integrity
 * problem, and a retry button there re-fetches the identical bad artifact
 * forever. So `invalid` carries NO retry.
 *
 * `loadTournamentIndex()` and not a bare `fetchArtifact`: the header search
 * reads the same artifact, and the shared loader holds one module-scope promise
 * so a reader who focuses the search box on this route does not download ~39 KB
 * gzip twice. It clears on rejection, which is what makes the retry below able
 * to recover at all.
 *
 * ═══════════ THE SM-C2 GRAMMAR, APPLIED UNCHANGED ═══════════
 *
 * 48 `ViewDataDisclosure`s — the SHIPPED control the Hub's twelve standings
 * groups and nine results rounds already use. Minting a second disclosure
 * component is the reinvention the contract's "applied unchanged" language
 * exists to prevent, and this one already carries the
 * `aria-controls`-only-while-open fix that three other disclosures were each
 * patched for.
 *
 * COUNTS RENDER OUTSIDE EACH DISCLOSURE, with the group heading, so a reader
 * knows the size of a thing before deciding to open it. Nothing is deleted;
 * everything is one click away.
 */

/** Developer-facing, so `logLabel` and never `label` (a gated prop name). */
const PLAYERS_LOG_LABEL = "PlayersIndex render failed";

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const NAME_SEPARATOR = " ";
const COUNT_SEPARATOR = " ";

type Status = "loading" | "loaded" | "error" | "invalid";

/**
 * The abbreviation key for a position. Built as an identifier because a template
 * inside `t()` is exactly what the i18n ESLint rule rejects.
 */
function positionShortKey(position: Position): DictionaryKey {
  return `players.position.short.${position}` as DictionaryKey;
}

/**
 * The full term the abbreviation expands to.
 *
 * REUSED FROM `enums.position.*`, which already ships "Arquero" / "Defensa" /
 * "Mediocampista" / "Delantero" — the same four words the Match Dashboard's
 * lineups use. Minting a second set under `players.*` would be two Spanish
 * names for one position, and it is `enums.position.gk: "Arquero"` specifically
 * that rules out `POR` as the abbreviation.
 */
function positionLongKey(position: Position): DictionaryKey {
  return `enums.position.${position}` as DictionaryKey;
}

/**
 * The route's `<h1>`.
 *
 * A CLIENT component, on `TournamentHubHeading`'s precedent
 * (`TournamentHub.tsx:821`) and for the first of its two reasons: a server
 * `t()` renders canonical Spanish into the export and never changes again, so
 * the heading would sit frozen above a body that follows the language toggle.
 * The page shipped exactly that until code review 2026-08-27 — `page.tsx` held
 * `<h1>{t("players.title")}</h1>` with the server `t()`, so toggling to EN left
 * "Jugadores" above a fully English filter, group headings and table.
 *
 * `LandingContent.tsx:35-41` names this trap in this same change-set; nothing
 * went red because the ESLint i18n seam is scoped to `src/components/**`, which
 * is the other reason the heading belongs in this file rather than the route.
 *
 * It renders in ALL FOUR fetch states — it is outside the status machine below
 * — so the document is never headless while `tournament.json` is in flight.
 */
export function PlayersIndexHeading() {
  const t = useT();
  return <h1 className="type-display text-ink-primary">{t("players.title")}</h1>;
}

export function PlayersIndexRegion() {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [players, setPlayers] = useState<readonly PlayerEntity[]>([]);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef<HTMLDivElement>(null);

  /*
   * FOCUS SURVIVES THE WHOLE RETRY, both ends of it — `TournamentHubRegion`'s
   * two-effect pattern, carried rather than re-derived. Retry unmounts the error
   * panel that owns focus; the first effect moves the caret to the named,
   * `aria-busy` skeleton, and the second completes the move when that skeleton is
   * itself replaced. Both are keyed off `attempt > 0`, so a first uninterrupted
   * load moves nothing — the reader never gave us focus.
   */
  useEffect(() => {
    if (attempt > 0) {
      busyRef.current?.focus();
    }
  }, [attempt]);

  useEffect(() => {
    if (attempt > 0 && status !== "loading") {
      settledRef.current?.focus();
    }
  }, [attempt, status]);

  useEffect(() => {
    let cancelled = false;
    loadTournamentIndex()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        /*
         * Validate before declaring success. A stale CDN copy or a redirected
         * 200 parses fine and would render another schema's shapes at this
         * reader. SCHEMA_VERSION comes from the GENERATED module and is never
         * hardcoded — `npm run assert:schema-version` keeps it honest.
         */
        if (payload.schemaVersion !== SCHEMA_VERSION) {
          setStatus("invalid");
          return;
        }
        /*
         * THE SHAPE IS CHECKED BEFORE IT IS DEREFERENCED (code review
         * 2026-08-27), and a failure is `invalid`, NOT `error`.
         *
         * `fetchArtifact` `as`-casts unvalidated JSON, so `entities` is only
         * TYPED as present. This read `payload.entities.players` directly: a
         * payload that parsed, carried the right `schemaVersion` and lacked
         * `entities` threw a TypeError INSIDE this `.then`, which the `.catch`
         * below swallowed into the RETRYABLE `error` state.
         *
         * That was the worst of the four states to land in, because
         * `loadTournamentIndex` clears its module-scope `pending` promise only
         * on REJECTION (`tournament-index.ts:97-103`) and this promise had
         * fulfilled. Pressing "Reintentar" re-awaited the same cached bad
         * payload, threw again, and returned to `error` — forever, without ever
         * issuing a network request. The `invalid` state exists precisely to
         * say "retry cannot help" instead of offering a button that cannot.
         *
         * The shipped Hub does not have this shape: `TournamentHubRegion:118`
         * stores the payload whole and dereferences nothing.
         */
        if (!Array.isArray(payload.entities?.players)) {
          setStatus("invalid");
          return;
        }
        setPlayers(payload.entities.players);
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
    <div>
      {/*
       * PERSISTENT polite live region — mounted for the lifetime of the route,
       * never conditionally, because a live region that mounts already populated
       * does not announce reliably. Failure announces too: silence on the one
       * state that needs feedback strands a screen-reader user.
       */}
      <span aria-live="polite" className="sr-only">
        {status === "loaded" ? t("hub.region.loaded") : null}
        {status === "error" ? t("hub.region.error") : null}
        {status === "invalid" ? t("hub.region.invalid") : null}
      </span>

      {status === "loading" ? (
        <div
          ref={busyRef}
          tabIndex={-1}
          aria-busy="true"
          aria-label={t("hub.region.loading")}
          className="grid grid-cols-1 content-start gap-tile-gap"
        >
          {/*
           * Layout-SHAPED, not a spinner: a filter control over a stack of
           * group headings. `max-w-48` and never a fixed `w-48` — a fixed
           * 192 px plus 16 px of gutter overflows a 195 px layout viewport,
           * which is the defect ledger `deferred-work.md:4794` records against
           * the leaderboards skeleton and which this story fixed there too.
           */}
          <div className="skeleton h-11 w-full max-w-xs" />
          <div className="skeleton mt-6 h-6 w-full max-w-48" />
          <div className="skeleton h-6 w-full max-w-48" />
          <div className="skeleton h-6 w-full max-w-48" />
        </div>
      ) : null}

      {/* One settled-state wrapper for all three branches, so the caret lands in
          the same place whether the retry succeeded, failed again or came back
          with the wrong schema. */}
      <div ref={settledRef} tabIndex={-1}>
        {status === "error" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
            <p className="type-body text-destructive">{t("hub.region.error")}</p>
            <Button
              variant="destructive"
              onClick={() => {
                setStatus("loading");
                setPlayers([]);
                setAttempt((a) => a + 1);
              }}
              className="mt-3 min-h-11"
            >
              {t("hub.region.retry")}
            </Button>
          </div>
        ) : null}

        {/* Arrived intact, wrong schema. No retry: re-fetching the same artifact
            cannot change the answer, and a button that provably does nothing is
            worse than none. */}
        {status === "invalid" ? (
          <EmptyStatePanel
            headline={t("hub.region.invalid")}
            explanation={t("hub.region.invalidExplanation")}
          />
        ) : null}

        {/*
         * THE BOUNDARY IS NOT OPTIONAL. `loadTournamentIndex` `as`-casts
         * unvalidated JSON and this region validates ONE scalar before declaring
         * success; everything below dereferences the payload freely into helpers
         * that throw BY DESIGN (`formatInteger`'s `assertFinite`). Those throws
         * happen during render, OUTSIDE the fetch promise, so the "error" branch
         * above cannot catch them — and on this route that would blank 48 groups
         * and take the site chrome's language and theme controls with it.
         */}
        {status === "loaded" ? (
          <TacticalErrorBoundary
            headlineKey="players.crashed"
            explanationKey="players.crashedExplanation"
            logLabel={PLAYERS_LOG_LABEL}
          >
            <PlayersIndex players={players} />
          </TacticalErrorBoundary>
        ) : null}
      </div>
    </div>
  );
}

/** The settled surface: the filter, then the 48 groups. */
function PlayersIndex({ players }: { players: readonly PlayerEntity[] }) {
  const t = useT();
  const { locale } = useLocale();
  const filterId = useId();
  const [query, setQuery] = useState("");

  /*
   * MEMOISED (code review 2026-08-27). `groupPlayersByTeam` runs 48 sorts with
   * an `Intl.Collator` comparator over ~1,248 entries, and `filterPlayerGroups`
   * folds every name through NFD normalisation. Both ran on EVERY render, so
   * both ran on every keystroke in the filter below. `/players` records the
   * lowest Lighthouse median on the site (70), which is the surface least able
   * to absorb it.
   *
   * The grouping depends only on `players`, so it survives typing entirely; only
   * the filter re-runs per keystroke, and it is the cheaper of the two.
   */
  const groups = useMemo(() => groupPlayersByTeam(players), [players]);
  const filtered = useMemo(() => filterPlayerGroups(groups, query), [groups, query]);

  /*
   * `placeholder` and `aria-label` are gated prop names, so both are resolved
   * into consts first. The visible <label> is the accessible name; the
   * placeholder is a hint and never the only label.
   */
  const filterLabel = t("players.filterLabel");
  const filterPlaceholder = t("players.filterPlaceholder");

  /*
   * THREE STATES IN THE COUNT LINE, NOT TWO (code review 2026-08-27), and this
   * is `LeaderboardsRegion.tsx:645-656`'s ruled lesson applied one surface over.
   *
   * This read "1.248 jugadores ENCONTRADOS" on first paint — reporting the
   * result of a search the reader had not run, in a polite live region, above an
   * empty filter box. `players.count` / `players.countOne` were minted for
   * exactly this unfiltered case (their docblock in `es.ts` even names this call
   * site) and were then never wired up, so the right string existed and was
   * bypassed. `/teams` had it right all along.
   */
  const searching = query.trim() !== "";
  const countKey: DictionaryKey = searching
    ? filtered.total === 1
      ? "players.filterResultsOne"
      : "players.filterResults"
    : filtered.total === 1
      ? "players.countOne"
      : "players.count";
  const countSentence = `${formatInteger(filtered.total, locale)}${COUNT_SEPARATOR}${t(countKey)}`;

  return (
    <div>
      <div className="mt-tile-gap">
        <label htmlFor={filterId} className="type-stat-label block text-ink-secondary">
          {filterLabel}
        </label>
        <input
          id={filterId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={filterPlaceholder}
          className="mt-1 min-h-11 w-full max-w-xs rounded-md border border-hairline bg-surface-raised px-3 type-body text-ink-primary"
        />
        {/*
         * THE COUNT IS A POLITE LIVE REGION, and it is RENDERED TEXT rather
         * than an announcement queued per keystroke.
         *
         * `LeaderboardsRegion` debounces into the shared sort announcer because
         * it is competing with sort announcements on a route with fifty sortable
         * headers. This surface has NO sortable table and therefore no
         * `SortAnnouncerProvider` (D9) — so the count lives in its own polite
         * region, which the browser coalesces on its own as the text changes.
         * That is the simpler correct mechanism, not a weaker one: nothing here
         * can clobber an in-flight announcement, because nothing else announces.
         */}
        <p aria-live="polite" className="mt-1 type-caption text-ink-secondary">
          {countSentence}
        </p>
      </div>

      {/*
       * ZERO-RESULT COPY, AND THE 48 HEADINGS STAY RENDERED BEHIND IT
       * (EXPERIENCE.md → State Patterns, D4). The filter narrows what is INSIDE
       * the groups; it never collapses the page's structure. `filterPlayerGroups`
       * is what guarantees that — it returns every group, with an empty
       * `players` array where nothing matched — and `players-index.test.ts`
       * asserts it directly.
       */}
      {/*
       * THREE STATES, NOT TWO (code review 2026-08-27): "nothing matched what
       * you typed" and "there is nothing here" are different facts and get
       * different copy. Branching on `filtered.total === 0` alone told a reader
       * with an untouched filter box to delete letters.
       */}
      {filtered.total === 0 ? (
        <div className="mt-tile-gap">
          <EmptyStatePanel
            headline={searching ? t("players.filterNoResults") : t("players.empty")}
            explanation={
              searching ? t("players.filterNoResultsExplanation") : t("players.emptyExplanation")
            }
          />
        </div>
      ) : null}

      <div className="mt-section-gap grid grid-cols-1 gap-tile-gap">
        {filtered.groups.map((group) => (
          <TeamGroup key={group.teamId} group={group} />
        ))}
      </div>
    </div>
  );
}

/**
 * One team's disclosure: the heading and its count OUTSIDE the control, the
 * table inside.
 */
function TeamGroup({ group }: { group: PlayerTeamGroup }) {
  const t = useT();
  const { locale } = useLocale();

  /*
   * 🔴 EACH OF THE 48 CONTROLS AND EACH OF THE 48 TABLES CARRIES ITS OWN NAME,
   * NAMING ITS TEAM. Forty-eight controls sharing one accessible name is a
   * screen-reader control list with no information in it — the reader hears
   * "Ver los datos" forty-eight times and cannot tell which team they are about
   * to open. `ViewDataDisclosure`'s `panelTitle` prop exists for exactly this
   * and already composes "Ver los datos: <panel>".
   *
   * ⚠️ `panelTitle` IS THE PANEL'S TITLE, NOT A COMMAND (code review
   * 2026-08-27). This passed the full phrase "Ver los jugadores de Argentina",
   * which `ViewDataDisclosure.tsx:109` then composed into
   * "Ver los datos: Ver los jugadores de Argentina" — two imperative verbs in
   * one accessible name, forty-eight times, in both locales. The prop's own
   * docblock gives the intended shape ("Ver los datos: Mapa de tiros"), so the
   * value is the team name alone and the control reads
   * "Ver los datos: Argentina".
   *
   * The team name passes through UNTRANSLATED — a proper noun, not a label
   * (AD-7).
   */
  const triggerName = group.teamName;
  const tableCaption = `${t("players.tableCaption")}${NAME_SEPARATOR}${group.teamName}`;
  const countLabel = `${formatInteger(group.count, locale)}${COUNT_SEPARATOR}${
    group.count === 1 ? t("players.teamCountOne") : t("players.teamCount")
  }`;

  return (
    <section className="rounded-md border border-hairline bg-surface-raised p-4">
      <h2 className="type-title text-ink-primary">{group.teamName}</h2>
      {/* OUTSIDE the disclosure: the size of the thing, before the decision to
          open it (SM-C2). */}
      <p className="type-caption mt-1 text-ink-secondary">{countLabel}</p>

      {/*
       * NO CONTROL ON AN EMPTY GROUP (code review 2026-08-27).
       *
       * `filterPlayerGroups` deliberately returns every group, with an empty
       * `players` array where nothing matched — that is D4's structural promise
       * and it stays. But the promise is about the HEADINGS AND THEIR COUNTS
       * staying rendered, not about offering a control that reveals nothing:
       * a query matching one player left 47 live "Ver los datos" triggers that
       * each expanded to a <thead> over an empty <tbody>, so the screen-reader
       * control list stayed 48 long while 47 of it was noise.
       *
       * The heading and the "0 jugadores" count remain, so the page's structure
       * is exactly as legible as before.
       */}
      {group.players.length === 0 ? null : (
      <ViewDataDisclosure panelTitle={triggerName} surface="canvas">
        <table className="w-full">
          <caption className="sr-only">{tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col" className="type-stat-label px-2 py-1 text-left text-ink-secondary">
                {t("players.columns.position")}
              </th>
              <th scope="col" className="type-stat-label px-2 py-1 text-left text-ink-secondary">
                {t("players.columns.name")}
              </th>
            </tr>
          </thead>
          <tbody>
            {group.players.map((entry) => (
              <PlayerRow key={entry.playerId} entry={entry} />
            ))}
          </tbody>
        </table>
      </ViewDataDisclosure>
      )}
    </section>
  );
}

/** Position + name. Two columns is what 390 px holds with no name truncated. */
function PlayerRow({ entry }: { entry: PlayerEntity }) {
  const t = useT();

  return (
    <tr className="border-t border-hairline">
      <td className="px-2 py-1">
        {/*
         * 🔴 THE EXPANSION ATTACHES TO THE CELL VALUE, NOT ONLY TO THE COLUMN
         * HEAD. Spanish TTS otherwise reads `DEL` and `DEF` as the function
         * words *del* and *def* — the abbreviation is a real word in the
         * surrounding language, so a column head three rows up does not
         * disambiguate it at the point of utterance.
         *
         * `ARQ` and not `POR`: `POR` abbreviates *portero*, a word this spine
         * rejected — `es.enums.position.gk` ships "Arquero", so `POR` would have
         * no full term here to expand to.
         */}
        <abbr title={t(positionLongKey(entry.position))} className="type-table-numeric text-ink-secondary no-underline">
          {t(positionShortKey(entry.position))}
        </abbr>
      </td>
      <th scope="row" className="px-2 py-1 text-left font-normal">
        {/*
         * EVERY ROW LINKS to that Player Profile. `playerHref` (Story 2.15 D10)
         * owns the trailing slash — `trailingSlash: true` makes it required, and
         * a slash-less href is a 301 hop.
         *
         * A PLAIN ANCHOR, NOT `next/link`, and prefetching is left off by that
         * choice rather than by a prop — ~26 rows per group across 48 groups,
         * where `<Link>`'s default would fire a prefetch for every row the
         * reader scrolls past (the 48 → 75 resource measurement
         * `LeaderboardsRegion` records). `TeamsIndexRegion` states the same
         * decision the same way.
         *
         * The comment here used to describe a `prefetch={false}` prop; there is
         * no `Link` and no such prop, and there never was (code review
         * 2026-08-27). The behaviour was always right; only the account of it
         * was wrong.
         */}
        <a
          href={playerHref(entry.playerId)}
          className="type-body text-ink-primary underline underline-offset-2 hover:no-underline"
        >
          {entry.name}
        </a>
      </th>
    </tr>
  );
}
