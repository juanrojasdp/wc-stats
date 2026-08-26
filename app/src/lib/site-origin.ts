/**
 * THE SITE'S OWN ORIGIN — THE ONE DEFINITION (Story 3.1, AC1).
 *
 * Three consumers derive from this constant and NONE of them may carry its
 * own copy of the domain:
 *
 *   - `metadataBase` on the root layout (story 3.2), from which every
 *     `<link rel="canonical">` and `hreflang` alternate on ~1,406 routes is
 *     resolved;
 *   - the sitemap's `<loc>` entries (story 3.4);
 *   - `scripts/assert-no-external-origins.mjs`, the post-export origin gate,
 *     which reads the line below BY REGEX because it runs on Netlify with
 *     `app/`'s install alone and may import nothing outside `node:*`
 *     (`assert-schema-version.mjs:26-37` is the shipped precedent).
 *
 * A SECOND COPY DRIFTS SILENTLY IN THE DIRECTION THAT MATTERS. If the gate's
 * allow-list and the emitted canonicals disagree, the gate red-builds every
 * page in the export with an error naming AR-11 and NFR-9 — which is the
 * exact failure story 3.1 exists to remove. `site-origin.test.ts` asserts
 * mechanically that the string below appears exactly once under `app/`.
 *
 * SHAPE CONSTRAINTS, both load-bearing:
 *
 *   - The DECLARATION IS ONE LINE and is matched by
 *     `/^export const SITE_ORIGIN = ["'`]([^"'`]+)["'`];$/m`. Reformatting it
 *     across two lines does not degrade gracefully — the gate exits 2 and
 *     says so, rather than falling back to a default.
 *   - The VALUE IS A BARE ORIGIN: no trailing slash, no path, so that
 *     `new URL(SITE_ORIGIN).origin === SITE_ORIGIN` and `new URL(path, base)`
 *     resolves the way `metadataBase` expects.
 */
export const SITE_ORIGIN = "https://mundial-stats.juancr.dev";
