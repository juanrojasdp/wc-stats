import { readdirSync } from "node:fs";
import path from "node:path";

import type { MetadataRoute } from "next";

import { readTournament } from "@/lib/build-data";
import { SITE_ORIGIN } from "@/lib/site-origin";

/**
 * THE SITEMAP — every indexable route, DERIVED, never enumerated (Story 3.4).
 *
 * A Next 16 metadata route under `output: "export"`. It compiles to an app
 * ROUTE HANDLER, not a page, so it is copied flat to `out/sitemap.xml` rather
 * than to `out/sitemap.xml/index.html` — `trailingSlash: true` renames only
 * page routes (`next/dist/export/index.js:728-735` returns before the
 * `subFolders` naming). Verified on disk at Story 3.4 Task 2.2, not assumed.
 *
 * FOUR PROPERTIES, each load-bearing:
 *
 *   - THE ORIGIN COMES FROM THE ONE DEFINITION. `SITE_ORIGIN` is imported;
 *     this file carries NO origin literal. `site-origin.test.ts` scans
 *     `src/**` and asserts the string appears exactly once under `app/`, so a
 *     second copy here turns that gate red — which is the point.
 *
 *   - THE ENTITY URLS ARE THE MANIFEST, MAPPED 1:1. Same source and same shape
 *     as the three `generateStaticParams` (`entities.matches` / `.players` /
 *     `.teams`), with no length literal, no slice, no filter and no hard-coded
 *     slug. AD-3 makes the id the slug; it is not re-derived here. Because the
 *     routes are generated from this same list with `dynamicParams = false`,
 *     coverage is equal BY CONSTRUCTION rather than by a number anyone
 *     maintains.
 *
 *   - THE STATIC ROUTES ARE DISCOVERED FROM THE ROUTE TREE, NOT LISTED. Story
 *     3.9 adds `/tournament`, `/tops`, `/players` and `/teams` (UX-DR24). A
 *     literal list would mean 3.9 has to remember to edit a file it has no
 *     reason to open, and four new routes silently miss the sitemap. The walk
 *     below picks them up with NO EDIT HERE. Today it yields exactly four:
 *     `/`, `/about/`, `/compare/`, `/glossary/`.
 *
 *   - `<loc>` ONLY — no `lastModified`, no `changeFrequency`, no `priority`.
 *     (1) Reproducibility is a shipped property of this project (Story 2.19
 *     verified the live chunk set byte-identical to a local build); a
 *     `new Date()` here makes every build differ for no information gained.
 *     (2) There is no per-entity mtime in the manifest, so any date would be
 *     INVENTED — and Google demotes sitemaps whose dates it learns not to
 *     trust, which is worse than omitting them. (3) Google ignores
 *     `changeFrequency` and `priority` outright.
 *
 * `/compare` IS LISTED BARE (AC4). Its content is selection-dependent and
 * query-driven, so only `/compare/` appears; parameterized variants are
 * near-duplicate noise and no `?` may appear in any `<loc>`.
 *
 * `export const dynamic = "force-static"` IS REQUIRED, and the story's D5 said
 * it would not be. D5 read `next/dist/export/routes/app-route.js:73`, where
 * `isPageMetadataRoute` genuinely does exempt metadata routes from the
 * static-generation bail — but that check is on the EXPORT path and is never
 * reached, because `AppRouteRouteModule`'s constructor throws first, during
 * "Collecting page data", and it has no such exemption: it demands
 * `dynamic === "force-static"`, `"error"`, a `revalidate`, or a
 * `generateStaticParams`. Without the line below the build fails with
 * `Failed to collect page data for /sitemap.xml`. Recorded rather than
 * silently added, per Task 2.4.
 *
 * `not-found.tsx` is not a `page.tsx`, so `/404` and `/_not-found` never enter
 * the walk — exactly right, they must never be in a sitemap.
 */

const APP_DIR = path.join(process.cwd(), "src", "app");

export const dynamic = "force-static";

/*
 * Segment kinds whose URL is NOT the directory name appended verbatim:
 * route groups `(x)` contribute no path segment, parallel slots `@x` render
 * into another route, and `_x` is private and never routable. None exists in
 * this tree today. Rather than guess a mapping for one that appears later,
 * this THROWS — a build that stops with a message naming the directory is the
 * correct outcome when the alternative is silently publishing a `<loc>` that
 * 404s, which is the failure this whole story exists to prevent.
 */
function assertPlainSegment(name: string): void {
  if (name.startsWith("(") || name.startsWith("@") || name.startsWith("_")) {
    throw new Error(
      `sitemap: src/app/${name} is a route group, parallel slot or private folder, ` +
        `whose URL is not its directory name. Teach this walk how to map it before adding it.`
    );
  }
}

/**
 * Every non-dynamic route path, discovered by walking `src/app` for
 * directories that hold a `page.tsx`.
 *
 * Bracketed segments are skipped: the three dynamic routes are covered by the
 * manifest map above and enumerating them from the tree would double them.
 * Paths are cwd-relative, which is `app/` under both `next build` and vitest —
 * the same resolution `build-data.ts`'s `DATA_ROOT` uses.
 */
function discoverStaticRoutes(): string[] {
  const routes: string[] = [];

  function walk(directory: string, routePath: string): void {
    const entries = readdirSync(directory, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && entry.name === "page.tsx")) {
      routes.push(routePath);
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("[")) {
        continue;
      }
      assertPlainSegment(entry.name);
      walk(path.join(directory, entry.name), `${routePath}${entry.name}/`);
    }
  }

  walk(APP_DIR, "/");

  /*
   * A mis-resolved APP_DIR would readdir a directory with no `page.tsx`
   * anywhere and emit an ENTITY-ONLY sitemap — 1,400 correct URLs and four
   * missing ones, which is exactly the shape nobody notices. Fail loud.
   */
  if (routes.length === 0) {
    throw new Error(`sitemap: no page.tsx found under ${APP_DIR}; the route walk resolved nowhere.`);
  }

  return routes;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const { entities } = readTournament();

  const urls = [
    ...discoverStaticRoutes(),
    ...entities.matches.map((match) => `/matches/${match.matchId}/`),
    ...entities.players.map((player) => `/players/${player.playerId}/`),
    ...entities.teams.map((team) => `/teams/${team.teamId}/`),
  ];

  return urls.map((url) => ({ url: `${SITE_ORIGIN}${url}` }));
}
