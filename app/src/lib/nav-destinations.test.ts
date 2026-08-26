import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_DESTINATIONS } from "@/lib/nav-destinations";
import { en } from "@/locales/en";
import { es } from "@/locales/es";

/*
 * ═══════ THE AVAILABILITY GATE — Story 3.10, D8 (AC 1, A1, A2) ═══════════════
 *
 * `nav-destinations.ts` declares nine destinations, four of which are reachable
 * on `main` today. The other five are story 3.9's, and until 3.9 mints their
 * routes they must not render — a nav that 404s is worse than a nav that is
 * honest about its size, and a dead link in the site chrome appears on every one
 * of 1,406 routes.
 *
 * 🔴 THIS FILE IS WHAT BINDS THE `available` FLAG TO REALITY, and without it the
 * flag would be a comment that lies. `SiteHeader` is a client component
 * pre-rendered into 1,406 HTML files: it has no filesystem and cannot probe the
 * route tree at runtime. So the flag is static data, and the gate is a
 * BIJECTION checked in BOTH directions at test time:
 *
 *   1. every `available: true` destination HAS a page.tsx, and
 *   2. every `available: false` destination has NONE.
 *
 * Direction 2 is the half that earns its keep. Without it, 3.9 could mint
 * `/tournament` and the nav would silently stay four entries wide — a route that
 * exists but is unlinked, failing open and invisibly. With it, 3.9's first
 * route makes this file RED, and the only way back to green is flipping the
 * four booleans. That coupling is the point.
 *
 * INDEX IS NOT PROFILE, AND THAT CONFLATION IS THE TRAP. `/players` resolves to
 * `src/app/players/page.tsx`, which does NOT exist — only
 * `src/app/players/[slug]/page.tsx` does. A directory-level check would report
 * `players/` present and mark *Jugadores* available, shipping a link to a 404 on
 * every route. So a `route` carrying a dynamic segment is rejected outright
 * rather than resolved.
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

/** `route` → the `page.tsx` that would serve it, as a `SRC`-relative path. */
function pageFor(route: string): string {
  return route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
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

  it("renders FOUR today — the pre-3.9 truth, stated rather than implied", () => {
    expect(
      NAV_DESTINATIONS.filter((destination) => destination.available).map((d) => d.key)
    ).toEqual(["home", "compare", "glossary", "about"]);
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
          "nav ships a link to a 404 on every one of 1,406 routes.\n\n" +
          "Either the route was deleted, or a flag was flipped ahead of the route it names."
      ).toBe(true);
    }
  });

  it("direction 2 — every UNAVAILABLE destination has NO page.tsx", () => {
    for (const destination of NAV_DESTINATIONS.filter((d) => !d.available)) {
      const page = pageFor(destination.route);
      expect(
        existsSync(path.join(SRC, page)),
        `${destination.key} is marked available:false but ${page} EXISTS.\n\n` +
          "This is the half of the gate that catches story 3.9: the route has been " +
          "minted and the nav is silently still four entries wide, so a shipped page " +
          "is unreachable from the site chrome. Flip `available` to true in " +
          "nav-destinations.ts — no component changes, the nav completes itself."
      ).toBe(false);
    }
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
    expect(matches?.href).toBe("/tournament#results");
    expect(matches?.route).toBe("/tournament");
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
