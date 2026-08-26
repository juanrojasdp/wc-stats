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
 * Segment kinds whose URL is NOT the directory name appended verbatim: route
 * groups `(x)` contribute no path segment, and parallel slots `@x` render into
 * another route. Neither exists in this tree today. Rather than guess a mapping
 * for one that appears later, this THROWS — a build that stops with a message
 * naming the directory is the correct outcome when the alternative is silently
 * publishing a `<loc>` that 404s, which is the failure this whole story exists
 * to prevent.
 *
 * `_private` FOLDERS ARE NOT IN THIS SET, AND MUST NOT BE (code review
 * 2026-08-26). It shipped throwing on them too, which reads symmetrical and is
 * not. Next's private-folder convention opts a directory AND ALL ITS CHILDREN
 * out of routing entirely, so such a folder has no URL to map and can never
 * produce a `<loc>` — there is no 404 to trade against, which is the entire
 * justification for the throw above. Throwing on it instead broke `next build`
 * during "Collecting page data" for `src/app/_components/`, a supported
 * colocation pattern. The walk skips them, which is what "never routable"
 * means.
 */
function assertPlainSegment(name: string): void {
  if (name.startsWith("(") || name.startsWith("@")) {
    throw new Error(
      `sitemap: src/app/${name} is a route group or parallel slot, whose URL is not its ` +
        `directory name. Teach this walk how to map it before adding it.`
    );
  }
}

/*
 * Every extension Next accepts as a page under the default `pageExtensions`
 * (unset in `next.config.ts`). It shipped as `name === "page.tsx"` (code review
 * 2026-08-26): a route added as `page.ts` or `page.jsx` was silently absent
 * from the sitemap, which is the precise failure mode this module's whole
 * architecture exists to make impossible — and it was silent, while a merely
 * ambiguous DIRECTORY NAME stops the build outright above.
 */
const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/;

/**
 * Every non-dynamic route path NOT NESTED BENEATH A DYNAMIC ONE, discovered by
 * walking `src/app` for directories that hold a page file.
 *
 * That qualifier is load-bearing and was missing from this docblock until the
 * 2026-08-26 code review: bracketed segments are skipped BEFORE recursing, so a
 * route like `teams/[slug]/squad/page.tsx` would not be found. None exists
 * today, and the fix is not a one-liner — such a route has to be expanded once
 * per manifest entity, a mapping this story did not rule — so it is filed in
 * `deferred-work.md` rather than guessed at here.
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
    if (entries.some((entry) => entry.isFile() && PAGE_FILE.test(entry.name))) {
      routes.push(routePath);
    }
    for (const entry of entries) {
      // `_private` is skipped, not thrown on — see `assertPlainSegment`.
      if (!entry.isDirectory() || entry.name.startsWith("[") || entry.name.startsWith("_")) {
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
    throw new Error(`sitemap: no page file found under ${APP_DIR}; the route walk resolved nowhere.`);
  }

  /*
   * SORTED, because `readdirSync` order is not a guarantee (code review
   * 2026-08-26). The docblock above cites Story 2.19's byte-identical build as
   * a reason to omit `lastModified`, then shipped these four entries in
   * filesystem enumeration order — NTFS locally and ext4 on Netlify need not
   * agree, so `out/sitemap.xml` could differ byte-for-byte between a local
   * build and the deploy for reasons unrelated to content. Every test that
   * could have caught it sorts first.
   */
  return routes.sort();
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
