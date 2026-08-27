import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_DESTINATIONS } from "@/lib/nav-destinations";
import { en } from "@/locales/en";
import { es } from "@/locales/es";

/*
 * ═══════ THE AVAILABILITY GATE — Story 3.10, D8 (AC 1, A1, A2) ═══════════════
 *
 * `nav-destinations.ts` declares nine destinations. ALL NINE ARE REACHABLE
 * SINCE STORY 3.9, which minted `/tournament`, `/tops`, `/players` and `/teams`
 * — four page files — and flipped FIVE flags (`matches` shares `/tournament/`
 * with `tournament` and differs only by the `#results` fragment; every other
 * artifact in the repo said "four booleans" and was off by one).
 *
 * Before that, linking to an unbuilt route would have shipped a dead link into
 * the site chrome of every one of 1,406 pre-rendered routes.
 *
 * 🔴 THIS FILE IS WHAT BINDS THE `available` FLAG TO REALITY, and without it the
 * flag would be a comment that lies. `SiteHeader` is a client component
 * pre-rendered into 1,410 HTML files: it has no filesystem and cannot probe the
 * route tree at runtime. So the flag is static data, and the gate is a
 * BIJECTION checked in BOTH directions at test time:
 *
 *   1. every `available: true` destination HAS a page.tsx, and
 *   2. every `available: false` destination has NONE.
 *
 * DIRECTION 2 EARNED ITS KEEP AND IS NOW VACUOUS — both facts, in that order.
 * Without it, 3.9 could have minted `/tournament` and left the nav silently four
 * entries wide: a route that exists but is unlinked, failing open and invisibly.
 * With it, 3.9's first route made this file RED and the only way back to green
 * was flipping the five booleans. That coupling did its job. With every flag now
 * `true` the loop body no longer executes, which the case itself states and
 * asserts rather than leaving to be discovered — see its comment.
 *
 * INDEX IS NOT PROFILE, AND THAT CONFLATION IS THE TRAP. `/players` resolves to
 * `src/app/players/page.tsx` — a DIFFERENT file from
 * `src/app/players/[slug]/page.tsx`, and one that did not exist until story 3.9.
 * A directory-level check would have reported `players/` present and marked
 * *Jugadores* available throughout the 1,248 profiles' existence, shipping a
 * link to a 404 on every route. So a `route` carrying a dynamic segment is still
 * rejected outright rather than resolved — the index's arrival retires the
 * example, not the rule.
 *
 * 🔴 AND `pageFor()` BUILDS ONE LITERAL PATH, WHICH IS WHY THE FOUR NEW ROUTE
 * FILES HAD TO BE PLAIN `src/app/<name>/page.tsx` (`deferred-work.md:4826`,
 * owner: story 3.9). A route minted inside a group — `src/app/(landing)/tops/`
 * — or written as `page.jsx` resolves to nothing here, so direction 2 would NOT
 * have gone red, the booleans would never have been flipped, and the nav would
 * have shipped four entries wide beside four live, unreachable pages. Green.
 * The `assertPlainSegment` throw in `sitemap.ts` is the second, independent
 * guard on the same shape; this comment is the first.
 *
 * RELATIVE PATHS ONLY (A2), on `reflow-guards.test.ts`'s footing: node built-ins
 * and `process.cwd()/src`, so the suite gains no dependency to read a directory.
 */

const SRC = path.join(process.cwd(), "src");

/**
 * `href` → the route it lands on, with any fragment stripped.
 *
 * Entry 4 (`/tournament#results`) is the only destination carrying a fragment,
 * and it is why `route` is a declared field rather than derived at the call
 * site: availability is a property of the ROUTE, and two destinations may share
 * one.
 */
function routeOf(href: string): string {
  return href.split("#")[0];
}

/**
 * `route` → the `page.tsx` that would serve it, as a `SRC`-relative path.
 *
 * The trailing slash comes OFF here and only here. `next.config.ts` sets
 * `trailingSlash: true`, so every declared path ends in one (2026-08-26 code
 * review) — but the filesystem has no such slash, and `app/compare//page.tsx`
 * resolves to nothing.
 */
function pageFor(route: string): string {
  const bare = route.length > 1 && route.endsWith("/") ? route.slice(0, -1) : route;
  return bare === "/" ? "app/page.tsx" : `app${bare}/page.tsx`;
}

function resolvesInDictionary(dictionary: unknown, key: string): boolean {
  let node: unknown = dictionary;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) {
      return false;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

/** The ruled order, EXPERIENCE.md → Navigation, cross-checked against frames A and C. */
const RULED_ORDER = [
  "home",
  "compare",
  "tournament",
  "matches",
  "tops",
  "players",
  "teams",
  "glossary",
  "about",
] as const;

describe("the destination table is the ruled one (D1)", () => {
  it("declares all nine destinations, in the ruled order", () => {
    expect(NAV_DESTINATIONS.map((destination) => destination.key)).toEqual([...RULED_ORDER]);
  });

  it("renders ALL NINE — the post-3.9 truth, stated rather than implied", () => {
    /*
     * THIS CASE USED TO PIN THE PRE-3.9 TRUTH — `["home", "compare", "glossary",
     * "about"]`, as a hardcoded literal — and it went RED on the boolean flip
     * regardless of the filesystem, exactly as intended. Story 3.9 is what ended
     * that world, so 3.9 is what rewrites the case rather than deleting it (A1:
     * deleting an assertion is never how a gate is satisfied).
     *
     * Still a LITERAL and still not derived from `NAV_DESTINATIONS`: deriving it
     * would make the assertion "the available ones are the available ones". The
     * literal is what makes a flag flipped by accident — in either direction —
     * a failure with a name on it.
     */
    expect(
      NAV_DESTINATIONS.filter((destination) => destination.available).map((d) => d.key)
    ).toEqual([...RULED_ORDER]);
  });

  it("gives every destination a route its href actually lands on", () => {
    for (const destination of NAV_DESTINATIONS) {
      expect(
        routeOf(destination.href),
        `${destination.key}: href "${destination.href}" does not land on its declared ` +
          `route "${destination.route}". Availability is a property of the ROUTE, so a ` +
          "route that disagrees with its href makes the gate below check the wrong file."
      ).toBe(destination.route);
    }
  });

  /*
   * 🔴 THE SLASH GATE (2026-08-26 code review). This is the gate that was
   * missing, and its absence cost BOTH halves of the table at once.
   *
   * `next.config.ts` sets `trailingSlash: true`. On `href` that makes a
   * slash-less path a 301 rather than a link — this repo already rules it in
   * `compare-url.ts` ("the slash is mandatory") and `PlayerHero.tsx` ("a
   * slash-less `/compare?…` is a REDIRECT rather than a link"). On `route` it is
   * worse than cosmetic: Next 16 derives `usePathname()` from `location.href`
   * with NO normalisation, so the live value carries the slash and an exact
   * comparison against a slash-less literal NEVER matched — `aria-current`, the
   * inline underline and the sheet's lime marker were all silently absent on
   * every destination except `/`.
   *
   * The component tests could not catch it: they MOCK `usePathname` and so
   * supplied the slash-less input the app cannot actually produce. Only a gate
   * over the data itself sees it.
   */
  it("ends every href and every route in a slash — trailingSlash: true is ruled", () => {
    for (const destination of NAV_DESTINATIONS) {
      expect(
        destination.route.endsWith("/"),
        `${destination.key}: route "${destination.route}" has no trailing slash. ` +
          "`usePathname()` returns one under `trailingSlash: true`, so this route can " +
          "never equal a live pathname and `aria-current=\"page\"` will never render."
      ).toBe(true);

      expect(
        routeOf(destination.href).endsWith("/"),
        `${destination.key}: href "${destination.href}" has no trailing slash before its ` +
          "fragment (if any). Under `trailingSlash: true` that ships a 301 hop into the " +
          "site chrome of every route, and a fragment that rides a redirect."
      ).toBe(true);
    }
  });

  /*
   * The pairing no type can express across an array literal (2026-08-26 code
   * review). `key` is a union now, so the dictionary casts at three call sites
   * are checked — but nothing stops a row pairing `key: "teams"` with
   * `labelKey: "nav.destinations.players"`. That row renders "Jugadores"
   * pointing at `/teams/`, and the static-output guard then looks up
   * `es.nav.destinations.teams`, counts zero, and PASSES.
   */
  it("pairs every labelKey with its own key", () => {
    for (const destination of NAV_DESTINATIONS) {
      expect(
        destination.labelKey,
        `${destination.key}: labelKey "${destination.labelKey}" belongs to a different ` +
          "destination. A mis-paired row renders the wrong name against the right href " +
          "and every downstream gate looks up the label it expected rather than the one " +
          "that ships."
      ).toBe(`nav.destinations.${destination.key}`);
    }
  });
});

describe("D8 — the availability gate, a bijection in BOTH directions", () => {
  it("rejects any route with a dynamic segment before resolving it", () => {
    /*
     * The index-vs-profile trap, pinned. `/players/[slug]` is not `/players`,
     * and a `route` that carries a segment could never be resolved to a single
     * page.tsx anyway — so the gate refuses rather than guessing.
     */
    for (const destination of NAV_DESTINATIONS) {
      expect(
        destination.route.includes("["),
        `${destination.key}: "${destination.route}" carries a dynamic segment. A nav ` +
          "destination must name an INDEX route. `/players` (the index) and " +
          "`/players/[slug]` (a profile) are different things, and conflating them is " +
          "exactly how a nav entry comes to point at a 404."
      ).toBe(false);
    }
  });

  it("direction 1 — every AVAILABLE destination has a page.tsx", () => {
    for (const destination of NAV_DESTINATIONS.filter((d) => d.available)) {
      const page = pageFor(destination.route);
      expect(
        existsSync(path.join(SRC, page)),
        `${destination.key} is marked available:true but ${page} does not exist, so the ` +
          "nav ships a link to a 404 on every one of 1,410 routes.\n\n" +
          "Either the route was deleted, or a flag was flipped ahead of the route it names."
      ).toBe(true);
    }
  });

  it("direction 2 — every UNAVAILABLE destination has NO page.tsx", () => {
    /*
     * ⚠️ VACUOUS SINCE STORY 3.9, DELIBERATELY, AND SAID OUT LOUD RATHER THAN
     * LEFT TO BE DISCOVERED (A1/A2).
     *
     * All nine flags now read `true`, so this filter is EMPTY and the loop body
     * never executes. This repo has a named lesson for exactly that shape — the
     * `scanned === 0` rule at `canonical-output.test.ts:116-121` — and three
     * cases in this change-set became no-ops at the same moment (this one,
     * `SiteNav.test.tsx`'s unavailable half, and `static-output.test.ts:905-928`).
     *
     * IT IS KEPT, NOT DELETED, because it is a STANDING GUARD in the other
     * direction: it is what turns red if a future story DELETES a route's
     * `page.tsx` and sets its flag to `false` while some other surface still
     * links to it — or, more likely, sets the flag to `false` and leaves the page
     * shipped and unreachable. The bijection is only a bijection while both
     * halves exist.
     *
     * The non-vacuity assertion below is what keeps the CASE honest: it asserts
     * the reason the loop is empty, so this can never silently become "the gate
     * stopped seeing anything" instead of "there is nothing left to see".
     */
    const unavailable = NAV_DESTINATIONS.filter((d) => !d.available);

    /*
     * THE LOOP RUNS FIRST, AND THAT ORDERING IS DELIBERATE. The non-vacuity
     * assertion below would otherwise fire first on exactly the input this gate
     * exists to catch — a flag turned back to `false` beside a shipped page —
     * and would report "expected 1 to be 0" instead of the message naming the
     * destination and the file. The guard is about the CASE; the loop is about
     * the CODE, and the code's failure must be the one a reader sees.
     */
    for (const destination of unavailable) {
      const page = pageFor(destination.route);
      expect(
        existsSync(path.join(SRC, page)),
        `${destination.key} is marked available:false but ${page} EXISTS.\n\n` +
          "This is the half of the gate that CAUGHT story 3.9: a route has been " +
          "minted while the nav stayed narrower than the site, so a shipped page " +
          "is unreachable from the site chrome. Flip `available` to true in " +
          "nav-destinations.ts — no component changes, the nav completes itself."
      ).toBe(false);
    }

    expect(
      unavailable.length,
      "This case is vacuous BY DESIGN since story 3.9 flipped the last five flags — " +
        "but only while every destination really is available. A non-zero count here " +
        "means the loop above is live again and this guard should go with it; a " +
        "shrunken TABLE means the bijection has lost a half."
    ).toBe(0);
    expect(NAV_DESTINATIONS.filter((d) => d.available)).toHaveLength(RULED_ORDER.length);
  });
});

/*
 * ═══ THE ROUTE-SHAPE GUARD — ledger `deferred-work.md:4826`, CLOSED BY 3.9 ═══
 *
 * That entry names story 3.9 as its owner, and this is the gate that closes it.
 *
 * 🔴 THE BLIND SPOT. `pageFor()` above resolves a declared route to
 * `src/app{route}/page.tsx` LITERALLY. So a route minted inside a ROUTE GROUP
 * (`src/app/(landing)/tops/page.tsx`) or written as `page.jsx` resolves to
 * nothing here — direction 2 does NOT go red, the `available` boolean is never
 * flipped, and the nav ships narrower than the site beside a live, unreachable
 * page. Green. That is the precise failure direction 2 exists to catch, defeated
 * by a filename.
 *
 * `sitemap.ts`'s `assertPlainSegment` throws on a parenthesised segment, so a
 * route GROUP would at least fail the build — but it fails it in "Collecting
 * page data" with a message about the sitemap, nowhere near the nav. And it says
 * nothing at all about `page.jsx`, which builds fine.
 *
 * So this asserts the SHAPE of the route tree directly, which is the only place
 * the assumption `pageFor()` rests on can be stated.
 */
describe("route files are the plain shape the availability gate can see (L4826)", () => {
  /** Every `page.*` file under `src/app`, as a `src/app`-relative path. */
  function pageFiles(directory: string, prefix: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const next = `${prefix}${entry.name}`;
      if (entry.isDirectory()) {
        found.push(...pageFiles(path.join(directory, entry.name), `${next}/`));
      } else if (/^page\.[a-z]+$/.test(entry.name)) {
        found.push(next);
      }
    }
    return found;
  }

  const APP_DIR = path.join(SRC, "app");

  it("finds the route files at all — this gate must not run over nothing", () => {
    // The `scanned === 0` rule (`canonical-output.test.ts:116-121`): a walk that
    // finds nothing satisfies every "none of them is bad" assertion below.
    expect(pageFiles(APP_DIR, "").length).toBeGreaterThanOrEqual(
      NAV_DESTINATIONS.filter((destination) => destination.available).length - 1
    );
  });

  it("writes every route file as page.tsx — never page.jsx (L4826)", () => {
    const wrong = pageFiles(APP_DIR, "").filter((file) => !file.endsWith("/page.tsx") && file !== "page.tsx");
    expect(
      wrong,
      `these route files are not .tsx: ${wrong.join(", ")}. ` +
        "`pageFor()` in this file builds one literal `page.tsx` path, so a `.jsx` " +
        "route is INVISIBLE to the availability gate — the flag is never forced " +
        "true and the nav ships narrower than the site, green."
    ).toEqual([]);
  });

  it("puts no route file inside a ROUTE GROUP or a private folder (L4826)", () => {
    const grouped = pageFiles(APP_DIR, "").filter((file) =>
      file.split("/").some((segment) => segment.startsWith("(") || segment.startsWith("@") || segment.startsWith("_"))
    );
    expect(
      grouped,
      `these route files sit inside a route group, parallel route or private folder: ` +
        `${grouped.join(", ")}. The availability gate resolves a declared route to ` +
        "`src/app{route}/page.tsx` LITERALLY, so a grouped route defeats it SILENTLY; " +
        "and `sitemap.ts`'s assertPlainSegment throws on `(` during `next build`."
    ).toEqual([]);
  });
});

describe("D2 — one deep-link mechanism, not two (AC 2)", () => {
  it("points no destination into a match route", () => {
    /*
     * AC 2 is satisfied BY CONSTRUCTION — no nav entry is a match route — and
     * this is what keeps it so. A later editor adding `/matches/{slug}#momentum`
     * is told, at that moment, that a match deep link must route through story
     * 3.8's shipped nonce path (`use-anchor-nonce.ts`) rather than through a
     * bare <Link>, because a bare link scrolls to a collapsed panel and opens
     * nothing.
     */
    for (const destination of NAV_DESTINATIONS) {
      expect(
        /^\/matches\//.test(destination.href),
        `${destination.key} points into a match route ("${destination.href}").\n\n` +
          "Story 3.8 owns match deep links and its nonce path is the ONE mechanism " +
          "(AC 2). A <Link> here would be a second one: it would scroll to the section " +
          "but leave the panel closed. Route it through use-anchor-nonce.ts instead."
      ).toBe(false);
    }
  });

  it("keeps #results a SURFACE fragment, hanging off the Hub and not a match", () => {
    const matches = NAV_DESTINATIONS.find((destination) => destination.key === "matches");
    /*
     * THE SLASH BEFORE THE `#` IS PART OF THE PIN (2026-08-26 code review), not
     * incidental formatting. `PlayerMatchesSection.tsx` and
     * `TeamMatchesSection.tsx` both rule it verbatim — "THE TRAILING SLASH
     * BEFORE `#` IS MANDATORY" — because under `trailingSlash: true` the
     * slash-less form is a 301, and a fragment that rides a redirect is not
     * reliably honoured. This shipped as `/tournament#results`.
     */
    expect(matches?.href).toBe("/tournament/#results");
    expect(matches?.route).toBe("/tournament/");
  });
});

describe("D14 — every label is a locale key, in BOTH dictionaries", () => {
  it("resolves every labelKey in es AND en", () => {
    for (const destination of NAV_DESTINATIONS) {
      expect(
        resolvesInDictionary(es, destination.labelKey),
        `${destination.key}: "${destination.labelKey}" does not resolve in es.`
      ).toBe(true);
      expect(
        resolvesInDictionary(en, destination.labelKey),
        `${destination.key}: "${destination.labelKey}" does not resolve in en. ` +
          "`Dictionary` guards key SHAPE at compile time, so this can only fail if the " +
          "key is reached through an untyped boundary — but the nav's accessible names " +
          "come from here and a missing leaf would ship a raw dot-path as a link name."
      ).toBe(true);
    }
  });

  it("names no destination with a bare literal", () => {
    for (const destination of NAV_DESTINATIONS) {
      expect(destination.labelKey.startsWith("nav.destinations.")).toBe(true);
    }
  });
});
