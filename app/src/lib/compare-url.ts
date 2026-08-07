/*
 * THE `/compare` URL CONTRACT (Story 2.17, ruled D2 and AR-10).
 *
 * The URL is the ONLY comparison state. No component state holds `a` or `b`; if
 * you can break the page by editing the address bar, state is being held that
 * should not be. Swap-sides is a URL rewrite and nothing else.
 *
 * This module is PURE — no `window`, no `history`, no React. Every `window`
 * touch on this route lives in `use-url-query.ts`, which keeps this file
 * node-testable under the repo's default `environment: "node"` vitest config.
 *
 * 🔴 ONE HELPER, AND THE SLASH IS WRITTEN OUT. Before this story the route had
 * two disagreeing inbound links: `PlayerHero.tsx` interpolated `/compare/?…`
 * WITH the slash, `team-profile.ts`'s `compareTeamHref` returned `/compare?…`
 * WITHOUT it — and that helper's own docblock claimed it emitted the slash while
 * its body did not. `next.config.ts` sets `trailingSlash: true`, which rewrites a
 * slash-less path at render time, so BOTH pages have always emitted the slash
 * form in the exported HTML. Measured on the built export at this story's
 * baseline:
 *
 *     out/players/quinones-julian-mex/index.html → href="/compare/?type=players&a=…"
 *     out/teams/mexico/index.html                → href="/compare/?type=teams&a=mexico"
 *
 * A slash-less href is therefore a REDIRECT, not a link — the ruling
 * `hub-model.ts:171-173` already applies to the three entity hrefs. This helper
 * emits what actually ships, so `players/static-output.test.ts` stays green
 * byte-for-byte and `teams/static-output.test.ts`'s slash-less assertion (which
 * never matched the emitted markup) is corrected alongside it.
 */

/** The three comparable entity kinds. These are URL values, never display strings. */
export type CompareType = "players" | "teams" | "matches";

/**
 * Declaration order IS the type selector's segment order (AC 1:
 * "Jugadores/Equipos/Partidos").
 */
export const COMPARE_TYPES: readonly CompareType[] = ["players", "teams", "matches"];

/**
 * The fallback when `type` is absent or unrecognised (URL Contract, step 1).
 *
 * `players` rather than a null state: the picker must render something, and the
 * largest corpus is the least surprising default.
 */
export const DEFAULT_COMPARE_TYPE: CompareType = "players";

/** The route's own path. `trailingSlash: true` makes the slash mandatory. */
export const COMPARE_PATH = "/compare/";

export function isCompareType(value: string | null): value is CompareType {
  return value !== null && (COMPARE_TYPES as readonly string[]).includes(value);
}

/**
 * The canonical entry URL, e.g. `/compare/?type=players&a=quinones-julian-mex`.
 *
 * `a`/`b` are entity IDS, which are the slugs permanently (AD-3) — never display
 * names. `b` is omitted entirely when absent rather than emitted empty, so a
 * one-sided deep link round-trips through `parseCompareQuery` unchanged.
 */
export function compareHref(type: CompareType, a: string, b?: string): string {
  return `${COMPARE_PATH}?${compareSearch({ type, a, b: b ?? null })}`;
}

/** What the URL says, after validation. `a`/`b` are `null` when absent or blank. */
export type CompareParams = {
  type: CompareType;
  a: string | null;
  b: string | null;
  /**
   * True when `type` was PRESENT but unrecognised. Distinguishes "no type yet"
   * (a first visit — leave the URL alone) from "a bad type" (AC 5 — drop the
   * param), which are different writes.
   */
  droppedType: boolean;
};

/**
 * A blank or whitespace-only param is the same as an absent one.
 *
 * `?a=&b=mexico` is what a half-filled picker or a hand-edited URL produces, and
 * treating the empty string as a slug would send it to the manifest check and
 * render the invalid state over what is really the partial state.
 */
function normalizeId(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parse `window.location.search` into the route's state.
 *
 * Accepts the leading `?` or not, and tolerates a bare `""` — which is what
 * `useUrlQuery`'s server snapshot returns, and what the exported document
 * renders under.
 */
export function parseCompareQuery(search: string): CompareParams {
  const params = new URLSearchParams(search);
  const rawType = params.get("type");
  return {
    type: isCompareType(rawType) ? rawType : DEFAULT_COMPARE_TYPE,
    a: normalizeId(params.get("a")),
    b: normalizeId(params.get("b")),
    droppedType: rawType !== null && !isCompareType(rawType),
  };
}

/**
 * Serialise params back to a query string WITHOUT the leading `?`.
 *
 * 🔴 KEY ORDER IS FIXED at `type`, `a`, `b` — `URLSearchParams` preserves
 * insertion order, and a stable order is what makes a pasted URL, a swapped URL
 * and a freshly picked URL compare equal as strings. `replaceUrlQuery`'s
 * re-entry guard is a string equality check, so an unstable order would defeat
 * it and spin the page.
 *
 * Entity ids are ASCII slugs (AD-3), so percent-encoding is a no-op on real
 * input; `URLSearchParams` is used anyway so a hand-edited URL cannot inject
 * raw `&` or `=` into the next href this route emits.
 */
export function compareSearch(params: {
  type: CompareType;
  a: string | null;
  b: string | null;
}): string {
  const search = new URLSearchParams();
  search.set("type", params.type);
  if (params.a !== null && params.a !== "") {
    search.set("a", params.a);
  }
  if (params.b !== null && params.b !== "") {
    search.set("b", params.b);
  }
  return search.toString();
}

/**
 * Exchange the two sides (AC 2).
 *
 * A pure params→params function precisely so swap-sides cannot become component
 * state: the caller writes the result to the URL and re-renders from it.
 * Swapping a one-sided comparison moves the single entity from A to B rather
 * than no-oping, which is what a reader who wants their pick on the right side
 * means by pressing it.
 */
export function swapSides(params: CompareParams): CompareParams {
  return { ...params, a: params.b, b: params.a };
}
