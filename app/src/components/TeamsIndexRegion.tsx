"use client";

import { useEffect, useRef, useState } from "react";

import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { TacticalErrorBoundary } from "@/components/TacticalErrorBoundary";
import { Button } from "@/components/ui/button";
import type { TeamEntity } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { formatInteger } from "@/lib/format";
import { teamHref } from "@/lib/hub-model";
import { useLocale, useT } from "@/lib/i18n-provider";
import { composeTeamRecord, teamIndexRows } from "@/lib/teams-index";
import { loadTournamentIndex } from "@/lib/tournament-index";

/*
 * ═══════════ `/teams` — THE TEAM INDEX, RUNTIME HALF (Story 3.9, D5/D5b) ════
 *
 * ⚠️ THIS SURFACE IS KNOWINGLY REDUNDANT, AND THE DOCBLOCK SAYS SO RATHER THAN
 * DRESSING IT UP (D5). `/tournament#standings` already carries these same 48
 * teams with more competitive context — rank, points, goal difference and the
 * form strip. `/teams` exists so that no member of the ruled badge grid resolves
 * to a FRAGMENT while its neighbours resolve to pages. That is a
 * navigation-consistency reason, not an information one, and it is recorded as a
 * cost.
 *
 * NO DISCLOSURE — 48 rows is not dense, and SM-C2's grammar is for surfaces that
 * are. `/players` needs it (1,248 rows); this one does not. Applying it here out
 * of symmetry would put a click in front of a list that fits.
 *
 * NO SORTING, so no `DataTable` and no `SortAnnouncerProvider` (D9). The rows
 * are in artifact order and the one competitive ordering that matters —
 * standings — is a click away on the surface that owns it.
 *
 * 🔴 A CLIENT FETCH, NOT A BUILD-TIME READ. The same AD-11 line `/players`
 * observes: `tournament.json` is 409,512 B raw and must not become HTML. The
 * page shell reads it for the `<title>` and nothing else. The status machine,
 * the retry, the focus handoff and the shared `loadTournamentIndex()` loader are
 * `TournamentHubRegion`'s, carried rather than re-implemented — this is the
 * fourth consumer of that shape, not a fifth implementation of it.
 *
 * This route is NOT dense and carries no performance expectation beyond not
 * regressing.
 */

/** Developer-facing, so `logLabel` and never `label` (a gated prop name). */
const TEAMS_LOG_LABEL = "TeamsIndex render failed";

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const COUNT_SEPARATOR = " ";

type Status = "loading" | "loaded" | "error" | "invalid";

/**
 * The route's `<h1>`. A CLIENT component for the reason
 * `PlayersIndexHeading` records: a server `t()` freezes canonical Spanish into
 * the export, so the heading would ignore the language toggle the body obeys.
 * Corrected at code review 2026-08-27.
 */
export function TeamsIndexHeading() {
  const t = useT();
  return <h1 className="type-display text-ink-primary">{t("teams.title")}</h1>;
}

export function TeamsIndexRegion() {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [teams, setTeams] = useState<readonly TeamEntity[]>([]);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef<HTMLDivElement>(null);

  /* The two-effect focus handoff, `TournamentHubRegion`'s pattern verbatim. */
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
        // Validate before declaring success: a stale CDN copy parses fine.
        if (payload.schemaVersion !== SCHEMA_VERSION) {
          setStatus("invalid");
          return;
        }
        /*
         * Shape-checked before dereference, and a failure is `invalid` rather
         * than `error` — see `PlayersIndexRegion` for the full reasoning. In
         * short: a throw inside this `.then` lands in the RETRYABLE state, but
         * `loadTournamentIndex` caches a FULFILLED promise, so the retry button
         * would re-await the same bad payload forever without ever fetching.
         */
        if (!Array.isArray(payload.entities?.teams)) {
          setStatus("invalid");
          return;
        }
        setTeams(payload.entities.teams);
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
      {/* Persistent polite region — never conditional; one that mounts already
          populated does not announce reliably. */}
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
          {/* Layout-shaped: one table block. `w-full`, never a fixed width —
              see `deferred-work.md:4794`. */}
          <div className="skeleton h-6 w-full max-w-48" />
          <div className="skeleton h-96 w-full" />
        </div>
      ) : null}

      <div ref={settledRef} tabIndex={-1}>
        {status === "error" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
            <p className="type-body text-destructive">{t("hub.region.error")}</p>
            <Button
              variant="destructive"
              onClick={() => {
                setStatus("loading");
                setTeams([]);
                setAttempt((a) => a + 1);
              }}
              className="mt-3 min-h-11"
            >
              {t("hub.region.retry")}
            </Button>
          </div>
        ) : null}

        {/* Arrived intact, wrong schema. No retry — it cannot change the answer. */}
        {status === "invalid" ? (
          <EmptyStatePanel
            headline={t("hub.region.invalid")}
            explanation={t("hub.region.invalidExplanation")}
          />
        ) : null}

        {status === "loaded" ? (
          <TacticalErrorBoundary
            headlineKey="teams.crashed"
            explanationKey="teams.crashedExplanation"
            logLabel={TEAMS_LOG_LABEL}
          >
            <TeamsIndex teams={teams} />
          </TacticalErrorBoundary>
        ) : null}
      </div>
    </div>
  );
}

/** The settled surface: one flat table of 48. */
function TeamsIndex({ teams }: { teams: readonly TeamEntity[] }) {
  const t = useT();
  const { locale } = useLocale();

  const rows = teamIndexRows(teams);
  const recordSeparator = t("team.meta.recordSeparator");
  const countLabel = `${formatInteger(rows.length, locale)}${COUNT_SEPARATOR}${
    rows.length === 1 ? t("teams.countOne") : t("teams.count")
  }`;
  const recordExpansion = t("teams.recordExpansion");

  /*
   * AN EMPTY STATE, BECAUSE THERE WAS NONE (code review 2026-08-27). With an
   * empty `teams` array this rendered a header-only table with zero rows, a
   * "0 selecciones" count, and an `sr-only` caption announcing "Las 48
   * selecciones del torneo" over nothing at all — a screen-reader user was told
   * the table held 48 rows while it held none.
   */
  if (rows.length === 0) {
    return (
      <div className="mt-tile-gap">
        <EmptyStatePanel
          headline={t("teams.empty")}
          explanation={t("teams.emptyExplanation")}
        />
      </div>
    );
  }

  return (
    <div>
      <p className="type-caption mt-1 text-ink-secondary">{countLabel}</p>

      {/* Wide at 390 px: the table scrolls INSIDE its own container, never the
          page (UX-DR16's data-table exception). */}
      <div className="mt-tile-gap w-full overflow-x-auto">
        <table className="w-full">
          <caption className="sr-only">{t("teams.tableCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" className="type-stat-label px-2 py-1 text-left text-ink-secondary">
                {t("teams.columns.name")}
              </th>
              <th scope="col" className="type-stat-label px-2 py-1 text-left text-ink-secondary">
                {t("teams.columns.group")}
              </th>
              <th scope="col" className="type-stat-label px-2 py-1 text-left text-ink-secondary">
                {/*
                 * THE ABBREVIATION EXPANDS AT THE HEAD, where a column head can
                 * carry it: unlike the position cells on `/players`, "PJ-G-E-P"
                 * is not a word in the surrounding language, so there is no
                 * per-cell misreading to prevent — and the expansion belongs
                 * once, on the thing it names, rather than 48 times.
                 */}
                <abbr title={recordExpansion} className="no-underline">
                  {t("teams.columns.record")}
                </abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className="border-t border-hairline">
                <th scope="row" className="px-2 py-1 text-left font-normal">
                  {/*
                   * EVERY ROW LINKS to that Team Profile. `teamHref` owns the
                   * trailing slash. `prefetch` is left off by using a plain
                   * anchor: 48 rows visible at once would otherwise prefetch 48
                   * documents on arrival.
                   */}
                  <a
                    href={teamHref(row.teamId)}
                    className="type-body text-ink-primary underline underline-offset-2 hover:no-underline"
                  >
                    {row.name}
                  </a>
                </th>
                <td className="px-2 py-1 type-table-numeric text-ink-secondary">
                  {row.groupLabel}
                </td>
                <td className="px-2 py-1 type-table-numeric text-ink-primary">
                  {composeTeamRecord(row.record, recordSeparator)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
