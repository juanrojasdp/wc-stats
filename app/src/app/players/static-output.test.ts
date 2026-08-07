import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readTournament } from "@/lib/build-data";
import { es } from "@/locales/es";

/*
 * Verifies the EXPORTED /players/[slug] HTML, not live components (node env, no
 * jsdom). Kept out of the [slug]/ directory by convention — bracketed CLI
 * path-filters trip shell quoting — exactly as `matches/static-output.test.ts`
 * is. `npm run build` precedes `npm test`, so out/ exists.
 *
 * THE SKIP GUARD KEYS ON out/, NOT ON out/players/. Keying on the route
 * directory would make "the route produced nothing at all" indistinguishable
 * from "no build ran", and a build that emitted the shell and zero player routes
 * would report a screen of green skips. The first assertion below is what makes
 * a partial export fail loudly instead.
 */

const OUT_DIR = fileURLToPath(new URL("../../../out/", import.meta.url));
const PLAYERS_DIR = OUT_DIR + "players/";
const anyBuilt = existsSync(OUT_DIR);

// trailingSlash: true → out/players/{playerId}/index.html.
function playerHtml(playerId: string): string {
  return readFileSync(`${PLAYERS_DIR}${playerId}/index.html`, "utf8");
}

/*
 * Count a class only where it appears as a real DOM `class="..."` attribute —
 * the RSC flight payload carries "className" strings that must not be counted.
 * Lifted from `matches/static-output.test.ts`, whose suite learned this the hard
 * way.
 */
function classAttrCount(html: string, token: string): number {
  const pattern = new RegExp(`class="[^"]*\\b${token}\\b[^"]*"`, "g");
  return (html.match(pattern) ?? []).length;
}

function documentTitle(html: string): string {
  return html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
}

/*
 * Slice the document down to the Hero's own `<header>`, so Hero-scoped
 * assertions cannot be satisfied — or broken — by markup the shell owns or by
 * the RSC FLIGHT PAYLOAD.
 *
 * The flight payload is why this matters here specifically. It serializes the
 * Hero's props, so the RAW artifact numbers ("value":47274.9) are legitimately
 * present in the document even though the rendered DOM shows only the formatted
 * "47.274,9". A whole-document `not.toContain("47274.9")` therefore asserts
 * something false about a correct page — the same class of mistake as counting
 * "className" strings out of the flight payload as class attributes.
 */
function heroHeader(html: string): string {
  const start = html.indexOf('<header class="pt-layer-gap"');
  expect(start, "Hero <header> not found in the exported HTML").toBeGreaterThan(-1);
  const end = html.indexOf("</header>", start);
  expect(end, "Hero </header> not found in the exported HTML").toBeGreaterThan(start);
  return html.slice(start, end);
}

function metaContent(html: string, attribute: string, name: string): string | null {
  const pattern = new RegExp(`<meta[^>]*${attribute}="${name}"[^>]*content="([^"]*)"`);
  return html.match(pattern)?.[1] ?? null;
}

/*
 * FIXTURE LITERALS, hand-copied out of the JSON — never composed by calling
 * `composePlayerTitle`, which is the function under test. "An expectation built
 * by the function under test reproduces that function's bugs and can only prove
 * it was called."
 */
const QUINONES = "quinones-julian-mex";
const ACEVEDO = "acevedo-carlos-mex";
const QUINONES_NAME = "Julian QUINONES";
const ACEVEDO_NAME = "Carlos ACEVEDO";
const TEAM_NAME = "Mexico";
const SITE_NAME = "WC Stats";
const SEPARATOR = " · ";

describe.skipIf(!anyBuilt)("exported /players/[slug] routes", () => {
  it("emitted the player routes at all (a build that skipped them fails here)", () => {
    expect(existsSync(PLAYERS_DIR)).toBe(true);
  });

  it("pre-renders exactly the manifest players — no extra, no missing (bijection)", () => {
    /*
     * AC 5's "every player in the route manifest pre-renders", stated as the
     * bijection AD-4 asserts. `generateStaticParams` maps the manifest 1:1 with
     * NO existence filter (ruled D10) precisely so a listed player with no
     * artifact breaks the build rather than silently vanishing — this is the
     * assertion that would catch a filter creeping back in.
     */
    const manifest = readTournament()
      .entities.players.map((player) => player.playerId)
      .sort();
    const built = readdirSync(PLAYERS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(built).toEqual(manifest);
    expect(manifest.length).toBeGreaterThan(0);
  });

  describe("<title> and OpenGraph (AC 5)", () => {
    it("carries the player's name and team, composed from fixture literals", () => {
      const expected = `${QUINONES_NAME}${SEPARATOR}${TEAM_NAME}${SEPARATOR}${SITE_NAME}`;
      expect(documentTitle(playerHtml(QUINONES))).toBe(expected);
    });

    it("emits BOTH og:title and og:description — a description alone emits no OG", () => {
      const html = playerHtml(QUINONES);
      expect(metaContent(html, "property", "og:title")).toBe(
        `${QUINONES_NAME}${SEPARATOR}${TEAM_NAME}${SEPARATOR}${SITE_NAME}`
      );
      expect(metaContent(html, "property", "og:description")).toBe(
        `${es.enums.position.fw}${SEPARATOR}${TEAM_NAME}`
      );
    });

    it("emits NO og:image (AR-11 permits zero external or asset requests)", () => {
      expect(playerHtml(QUINONES)).not.toContain("og:image");
    });

    it("titles the zero-appearance goalkeeper identically — no shape branch", () => {
      expect(documentTitle(playerHtml(ACEVEDO))).toBe(
        `${ACEVEDO_NAME}${SEPARATOR}${TEAM_NAME}${SEPARATOR}${SITE_NAME}`
      );
      expect(metaContent(playerHtml(ACEVEDO), "property", "og:description")).toBe(
        `${es.enums.position.gk}${SEPARATOR}${TEAM_NAME}`
      );
    });
  });

  describe("the AD-11 split — a projection, never the artifact", () => {
    /*
     * A SHAPE GUARD, not a byte threshold, "so it fails on the first row rather
     * than at some threshold". `aggregation` and `perNinety` are keys that exist
     * ONLY inside `aggregates[]`: if either reaches the HTML, the whole artifact
     * was serialized into the pre-render rather than the Hero projection.
     *
     * `perNinety` doubles as D3's guard — it must not reach ANY surface on this
     * route, pre-rendered or not.
     */
    it("inlines no aggregate internals", () => {
      for (const slug of [QUINONES, ACEVEDO]) {
        const html = playerHtml(slug);
        expect(html).not.toContain("aggregation");
        expect(html).not.toContain("perNinety");
      }
    });

    it("inlines no physical, trend or per-match rows", () => {
      const html = playerHtml(QUINONES);
      // Keys and ids that appear only below the Hero, fetched at runtime.
      expect(html).not.toContain("distanceZone3");
      expect(html).not.toContain("passesAttempted");
      expect(html).not.toContain("m053-czechia-mexico");
    });
  });

  describe("the pre-rendered Hero", () => {
    /*
     * SCOPED TO THE HERO, not the document (code review 2026-08-07). Asserted
     * against the raw HTML, both of these were satisfied by the `<meta>` tags
     * three tests above: "Julian QUINONES" is in `<title>` and `og:title`, and
     * "Delantero" is in `og:description` — so a build that emitted correct
     * metadata over an EMPTY `<header>` passed. `heroHeader()` exists for
     * exactly this, and its docblock says so: Hero-scoped assertions must not be
     * satisfiable "by markup the shell owns or by the RSC FLIGHT PAYLOAD".
     */
    it("renders the player's own name and position, source-passthrough (AD-7)", () => {
      const hero = heroHeader(playerHtml(QUINONES));
      expect(hero).toContain(QUINONES_NAME);
      expect(hero).toContain(es.enums.position.fw);
    });

    it("renders LOCALE-FORMATTED values, which proves the component ran", () => {
      /*
       * es-CO grouping and comma decimals: 47274.9 -> "47.274,9". A raw
       * "47274.9" in the HTML would mean the tile printed the artifact number
       * instead of going through the format layer.
       */
      const hero = heroHeader(playerHtml(QUINONES));
      expect(hero).toContain("47.274,9");
      // The RAW value must not reach the rendered Hero. It IS in the document,
      // inside the flight payload that carries the projection — see heroHeader.
      expect(hero).not.toContain("47274.9");
      expect(hero).toContain("82,2%");
      // km/h at 1 dp: 33 -> "33,0", never a bare "33".
      expect(hero).toContain("33,0");
    });

    it("links the team through teamHref, trailing slash included", () => {
      expect(playerHtml(QUINONES)).toContain('href="/teams/mexico/"');
    });

    it("deep-links Comparar with the slug (AC 4)", () => {
      /*
       * `&` is HTML-escaped in an attribute value, and the SLASH before the
       * query string is `trailingSlash: true`'s doing — asserting the AC's
       * literal slash-less form would pass on a document that links to a
       * redirect (2.18's static-output patch, same trap).
       */
      expect(playerHtml(QUINONES)).toContain(
        `href="/compare/?type=players&amp;a=${QUINONES}"`
      );
      expect(playerHtml(ACEVEDO)).toContain(
        `href="/compare/?type=players&amp;a=${ACEVEDO}"`
      );
    });

    it("prints real zeros for the zero-appearance goalkeeper (D4a, D8)", () => {
      /*
       * 209 players (16.7%) never appeared and 20 more have minutesPlayed 0 with
       * played > 0. Story 1.18: "0 is the honest floor." The em dash is this
       * codebase's MISSING-data glyph and must not appear in an appearances line
       * where the information exists.
       */
      const html = playerHtml(ACEVEDO);
      expect(html).toContain(`${es.player.appearances.minutes}: 0`);
      expect(html).toContain(`${es.player.appearances.played}: 0`);
    });

    it("renders exactly four Hero tiles (D5's ruled selection)", () => {
      /*
       * The FULL tile-card class string, not the bare token: `bg-surface-raised`
       * alone also matches the skip link's `focus:bg-surface-raised` and the
       * header search input, which is how this assertion first read 6.
       */
      for (const slug of [QUINONES, ACEVEDO]) {
        const hero = heroHeader(playerHtml(slug));
        expect(classAttrCount(hero, "rounded-md bg-surface-raised p-3")).toBe(4);
      }
    });

    it("gives a single-entity tile NO leader glyph and no side accent (D5)", () => {
      /*
       * `ProfileStatTiles` is a new component rather than a widened
       * `StoryStatTiles` precisely because a profile has no leader. These three
       * are the head-to-head marks that must never appear here.
       */
      const hero = heroHeader(playerHtml(QUINONES));
      expect(hero).not.toContain("▲");
      expect(hero).not.toContain("text-viz-team-a");
      expect(hero).not.toContain("text-viz-team-b");
    });

    it("emits exactly one <h1>, and it is sr-only (MatchHero's ruled shape)", () => {
      const html = playerHtml(QUINONES);
      expect((html.match(/<h1/g) ?? []).length).toBe(1);
      expect(html).toMatch(/<h1[^>]*class="sr-only"/);
    });
  });

  describe("the below-Hero region is client-fetched, not inlined", () => {
    /*
     * NAMED FOR WHAT IT ASSERTS (code review 2026-08-07). This was titled "ships
     * the artifact path as the region's ONLY fetch", which it never checked —
     * the path lives in the client chunk, not the document, and the allow-list
     * that does pin it is `app/static-output.test.ts`'s per-route walker. A
     * green test name claiming coverage it does not have is worse than no test,
     * and this file polices exactly that elsewhere ("a vacuous sweep is not a
     * pass").
     */
    it("renders the LOADING state, which is the proof the AD-11 split holds", () => {
      // A pre-rendered table would have no aria-busy skeleton at all, and the
      // skeleton must carry a role that can take a name — see PlayerProfileRegion.
      const html = playerHtml(QUINONES);
      expect(html).toContain('aria-busy="true"');
      expect(html).toMatch(/role="group"[^>]*aria-busy="true"|aria-busy="true"[^>]*role="group"/);
    });
  });
});
