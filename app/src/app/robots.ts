import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site-origin";

/**
 * `robots.txt` — allow everything, and point at the sitemap (Story 3.4, AC7).
 *
 * A Next 16 metadata route, emitted flat to `out/robots.txt` for the same
 * reason `sitemap.ts` is emitted flat to `out/sitemap.xml`: both compile to app
 * route handlers, which the exporter copies verbatim before `trailingSlash`
 * naming applies. `force-static` is required here for the same reason it is
 * required there — see `sitemap.ts`'s docblock; the bail happens in the route
 * module's constructor during "Collecting page data", which has no metadata
 * exemption.
 *
 * THE ORIGIN COMES FROM THE ONE DEFINITION. No literal here either;
 * `site-origin.test.ts` scans this file.
 *
 * ==========================================================================
 * THERE IS DELIBERATELY NO `Disallow: /data/`. DO NOT ADD ONE.
 * ==========================================================================
 *
 * This reads like an oversight and is the opposite of one. Googlebot renders
 * pages with JavaScript, and EVERY data-bearing route in this app fetches
 * `/data/*.json` at runtime (`src/lib/data.ts`). Blocking `/data/` would stop
 * the renderer from fetching those artifacts and strip the rendered pages of
 * their content — actively harming the exact indexing this sitemap exists to
 * enable. There is no SEO benefit on the other side of that trade: JSON
 * artifacts are not indexed as pages, so disallowing them buys nothing and
 * costs the content of ~1,400 routes.
 *
 * `sitemap.test.ts` asserts `Disallow:` appears ZERO times in the emitted
 * file. An unstated omission is not a property; something has to fail on its
 * return.
 */

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
