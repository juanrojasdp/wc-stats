import type { Tournament } from "@/lib/contract/contract-types";
import { fetchArtifact } from "@/lib/data";

/*
 * THE SHARED, LAZY `tournament.json` LOADER (Story 2.14, ruling 1).
 *
 * ═══ WHY THE HEADER DOES NOT FETCH ON LOAD ═══
 *
 * AC 1 says the typeahead runs over "the already-loaded index" with "no network
 * beyond" it. MEASURED ON THE BUILT EXPORT, that premise is false off the Hub:
 * `grep -rl "index/tournament.json" out/_next/` matches EXACTLY ONE chunk
 * (46,292 B raw / 12,924 B gzip), whose content is the minified
 * `TournamentHubRegion`. `out/index.html` references it; `out/matches/m001-…/`,
 * `out/about/`, `out/glossary/` and `out/404.html` reference it ZERO times. So
 * on four of the five routes there is no already-loaded index, and the module
 * that fetches it is not even shipped there.
 *
 * The header is global. Whatever it imports, every route pays for — and Story
 * 2.6's code review established the mechanism precisely: its eager-chunk
 * disclosure was caused by "a value import" creating a static module-graph edge.
 * A header importing the Hub region would recreate that on all five routes.
 *
 * The rule this collides with is live. `MatchBundleRegion.tsx` carries "FR-34:
 * no tournament.json at runtime", and Story 2.12 scoped it — "that rule is
 * scoped to the match route". Search ON the match route puts this module inside
 * that scope. Scale matters here: the real index is 409,524 B raw / 39,137 B
 * gzip, not the 7 KB fixture.
 *
 * ═══ RULED: LAZY, ON FIRST ENGAGEMENT, SHARED ═══
 *
 * Nothing is fetched until the reader focuses the input or opens the sheet. The
 * artifact is fetched AT MOST ONCE per page load and shared with the Hub, so a
 * Hub visitor who searches pays for it once rather than twice.
 *
 * Module-scope state of this shape is sanctioned rather than novel:
 * `use-glossary-popover.ts` cites "@/lib/i18n.ts's `reportedMissing` is the
 * shipped precedent for module-scope state of exactly this shape", and AD-10
 * bars a STORE, not a memo. Nothing here is written by a component, read back as
 * application state, or persisted.
 *
 * REJECTED, with their costs, so a review can overturn this cheaply:
 *  - Hoisting the fetch into `layout.tsx`. Satisfies AC 1's letter everywhere,
 *    at +39 KB gzip on four routes that today pay zero, and contradicts FR-34.
 *  - A separate `search.json`. The architecture forecloses it — "Search-index
 *    composition: derived client-side from tournament.json entities" — and it
 *    barely pays: the `entities` slice alone is 29,758 B gzip against the whole
 *    index's 39,137 B, for a new schema, an emitter and a change-set this story
 *    does not own.
 *
 * AC 7 is therefore discharged as: zero network beyond the already-loaded index
 * on `/`; on every other route, exactly one on-demand fetch of that same index,
 * once per page load, triggered by user engagement and NEVER by page load.
 *
 * ═══ WHAT THIS MODULE MUST NOT DO ═══
 *
 * It must never import `@/lib/build-data` — that is the build-time fs reader,
 * barred from `src/components/**` by the ESLint seam and structurally wrong here
 * (node:fs at module scope crashes in the browser). Runtime data goes through
 * `fetchArtifact` and nothing else (AD-11's two data paths).
 */

/**
 * The in-flight or fulfilled fetch, or `null` when no attempt is outstanding.
 *
 * 🔴 ONLY A FULFILLED PROMISE STAYS CACHED. A rejected promise cached here would
 * kill search for the entire page lifetime after one network blip, with no retry
 * path anywhere in the UI — every later engagement would re-await the same dead
 * promise. So the slot is cleared on rejection and the next engagement retries.
 *
 * The `.catch` below re-throws after clearing: the caller still sees the
 * failure and renders its `error` state. It is also what keeps the rejection
 * HANDLED — an unhandled rejection would violate the zero-console requirement
 * this story verifies in the browser.
 */
let pending: Promise<Tournament> | null = null;

/**
 * Fetch `/index/tournament.json` once per page load, sharing it across every
 * caller.
 *
 * 🔴 THE FETCH CALL IS WRITTEN VERBATIM AND MUST STAY THAT WAY:
 * `fetchArtifact<Tournament>("/index/tournament.json")` — explicit type
 * argument, inline string literal, NO extracted constant.
 * `src/app/static-output.test.ts`'s module-graph walk finds artifact paths with
 * `/fetchArtifact\s*<[^>]*>\s*\(\s*"([^"]+)"/`, so any other spelling silently
 * drops this artifact from `reachable` and reds three assertions in the one
 * describe in that file that is NOT `skipIf`-gated — i.e. it fails on a bare
 * `npm test`, with a message about the Hub rather than about this line.
 *
 * The caller validates `schemaVersion`. This module deliberately does not: the
 * Hub's status machine already distinguishes "error" (the fetch failed, retry
 * may help) from "invalid" (it arrived intact and failed the version gate, retry
 * cannot help), and folding that decision in here would either duplicate the
 * machine or collapse the two states into one.
 */
export function loadTournamentIndex(): Promise<Tournament> {
  if (pending === null) {
    pending = fetchArtifact<Tournament>("/index/tournament.json").catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

/**
 * Drop the cache. FOR TESTS ONLY — no component calls this.
 *
 * Module-scope state survives between test files' `it` blocks in a single vitest
 * worker, so without a reset the second test to exercise the loader would assert
 * against the first one's fetch.
 */
export function resetTournamentIndexCache(): void {
  pending = null;
}
