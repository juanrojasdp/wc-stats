"use client";

import { useEffect, useRef, useState } from "react";

import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { TacticalErrorBoundary } from "@/components/TacticalErrorBoundary";
import { TournamentHub } from "@/components/TournamentHub";
import { Button } from "@/components/ui/button";
import type { Tournament } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { fetchArtifact } from "@/lib/data";
import { useT } from "@/lib/i18n-provider";

/*
 * The Hub's runtime data region (Story 2.12, ruled D1). On mount it fetches
 * EXACTLY ONE artifact — `/index/tournament.json` — through the sole fetch
 * path, and holds it in ephemeral state (AD-10: no cache, no store).
 *
 * WHY A CLIENT FETCH RATHER THAN A BUILD-TIME READ. AD-11 defines exactly two
 * data paths and bans a third. The build-time `readTournament()` read is used
 * on this route for `<title>`/OG metadata ONLY; the tables come down the client
 * path, because AD-11 also bans "inlining full bundles into HTML" and the
 * full-scale index measures ~400 KB raw (Story 1.17 measured 409,512 B on the
 * real corpus) — that must not become HTML. FR-26's "the INITIALLY LOADED
 * Tournament Index" says the same thing from the requirement side.
 *
 * `MatchBundleRegion.tsx` carries the comment "FR-34: no tournament.json at
 * runtime". That rule is scoped to the MATCH route, which needs only its own
 * bundle; it does not bar the Hub from fetching its own index.
 *
 * THE STATUS MACHINE MIRRORS `MatchBundleRegion` EXACTLY, including the part
 * that matters most: "error" and "invalid" are distinct. A fetch that failed is
 * a network problem the reader can retry; a payload that ARRIVED INTACT and
 * then failed the schemaVersion gate is a data-integrity problem, and a retry
 * button there re-fetches the identical bad artifact forever. So `invalid`
 * carries NO retry.
 */

type Status = "loading" | "loaded" | "error" | "invalid";

/** Developer-facing, so `logLabel` and never `label` (a gated prop name). */
const HUB_LOG_LABEL = "TournamentHub render failed";

export function TournamentHubRegion() {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef<HTMLDivElement>(null);

  /*
   * FOCUS SURVIVES THE WHOLE RETRY, both ends of it.
   *
   * Retry unmounts the error panel that owns focus, which would drop the caret
   * to <body>; `attempt` only ever increments on a retry click, so focus moves
   * to the (named, aria-busy) skeleton. But the skeleton is itself temporary —
   * when the fetch settles it is replaced by the tables or by a fresh error
   * panel, and the caret fell to <body> anyway, at the top of a thirty-table
   * document. So the second effect hands focus ON at the transition OUT,
   * completing the move rather than deferring the loss by one round trip.
   *
   * Both are keyed off `attempt > 0`: on a first, uninterrupted load nothing
   * moves focus at all, which is correct — the reader never gave it to us.
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
    // Initial state is already "loading"; retry resets it in its handler, so
    // the effect never sets state synchronously (react-hooks/set-state-in-effect).
    let cancelled = false;
    fetchArtifact<Tournament>("/index/tournament.json")
      .then((payload) => {
        if (cancelled) {
          return;
        }
        /*
         * Validate before declaring success. A stale CDN copy or a redirected
         * 200 parses fine and would render another schema's shapes against this
         * reader. SCHEMA_VERSION comes from the GENERATED module and is never
         * hardcoded — `npm run assert:schema-version` is the gate that keeps it
         * honest.
         *
         * There is no id to check here, unlike the match bundle: the index is
         * the only artifact at its path.
         */
        if (payload.schemaVersion !== SCHEMA_VERSION) {
          setStatus("invalid");
          return;
        }
        setTournament(payload);
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
       * never conditionally, because a live region that mounts already
       * populated does not announce reliably. It announces when its text
       * changes, i.e. once the fetch resolves, and again on a locale toggle.
       * Failure announces too: silence on the one state that needs feedback
       * strands a screen-reader user.
       *
       * This is NOT the sort announcer. That one is `SortAnnouncerProvider`,
       * mounted once by the route (2.11a decision 9 allows exactly one polite
       * region for sort announcements, and this is a different, pre-existing
       * class of region — the same pairing `MatchBundleRegion` already ships).
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
          className="grid gap-tile-gap"
        >
          {/* Layout-SHAPED, not a spinner: a heading block, then two table
              blocks roughly the height of a group standings table. */}
          <div className="skeleton h-8 w-48" />
          <div className="skeleton mt-6 h-56 w-full" />
          <div className="skeleton mt-6 h-56 w-full" />
        </div>
      ) : null}

      {/* The settled-state wrapper is the focus target the retry hands off TO.
          One node for all three settled branches, so the caret lands in the
          same place whether the retry succeeded, failed again or came back with
          the wrong schema. `tabIndex={-1}` makes it programmatically focusable
          without adding a tab stop. */}
      <div ref={settledRef} tabIndex={-1}>
      {status === "error" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <p className="type-body text-destructive">{t("hub.region.error")}</p>
          <Button
            variant="destructive"
            onClick={() => {
              setStatus("loading");
              setTournament(null);
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
       * THE BOUNDARY MATTERS MORE HERE THAN ON THE MATCH ROUTE, which is why
       * mirroring `MatchBundleRegion`'s status machine without also mirroring
       * its boundary was the gap. `fetchArtifact` `as`-casts unvalidated JSON
       * and this region validates one scalar (`schemaVersion`) before declaring
       * success; everything below then dereferences the payload freely into
       * helpers that throw BY DESIGN — `formatInteger`'s `assertFinite`,
       * `formatDate`, `formatKickoff`, and `decidedByCaption`'s null-shootout
       * throw. Those throws happen during render, OUTSIDE the fetch promise, so
       * the "error" branch above cannot catch them.
       *
       * On `/matches/{id}` that costs one bundle. On `/` — the site's entry
       * route, where one artifact carries up to 104 result rows and 48
       * standings rows — it replaced the whole page, both surfaces and 2.13's
       * section with Next's client-exception screen. The boundary degrades it
       * to a named panel while the heading, the site chrome and the
       * language/theme controls stay usable.
       *
       * HUB-SCOPED CRASH COPY: the boundary's defaults are
       * `match.bundle.crashed*` — "el análisis táctico de este partido", a
       * false statement on a tournament-wide route (ruled D8).
       */}
      {status === "loaded" && tournament !== null ? (
        <TacticalErrorBoundary
          headlineKey="hub.region.crashed"
          explanationKey="hub.region.crashedExplanation"
          logLabel={HUB_LOG_LABEL}
        >
          <TournamentHub tournament={tournament} />
        </TacticalErrorBoundary>
      ) : null}
      </div>
    </div>
  );
}
