import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Inter } from "next/font/google";

import { AttributionFooter } from "@/components/AttributionFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { bootstrapScript } from "@/lib/bootstrap";
import { t } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n-provider";
import { SITE_ORIGIN } from "@/lib/site-origin";
import { ThemeProvider } from "@/lib/theme-provider";

import "./globals.css";

/*
 * Both are variable fonts, so no `weight` is passed. next/font downloads them
 * at build time and serves the woff2 from /_next/static/media/ — zero runtime
 * requests to Google (AR-11).
 */
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

/*
 * `metadataBase` IS THE ORIGIN EVERY ABSOLUTE URL IN THE EXPORT IS RESOLVED
 * AGAINST (Story 3.2, AC1), and it is imported — never spelled. A second copy
 * of the domain turns `site-origin.test.ts` red; that suite exists precisely
 * because the origin gate and the emitted canonicals drifting apart red-builds
 * all ~1,406 pages with an error naming AR-11.
 *
 * THE CANONICAL IS AUTHORED ONCE, HERE, AS THE RELATIVE `"./"` (D1). Next
 * resolves it PER ROUTE, not once for the tree: `accumulateMetadata` threads
 * the leaf route's own pathname through every `mergeMetadata` call, so
 * `resolveAbsoluteUrlWithPathname` turns `"./"` into that leaf's pathname and
 * composes it with `metadataBase`. The trailing slash is appended by the
 * `trailingSlash` branch of the same resolver, because `next.config.ts` sets
 * `trailingSlash: true` and Netlify therefore SERVES the slashed URL — a
 * canonical that disagrees with the served URL is worse than none (AC2).
 *
 * Writing it here rather than as four per-route literals is what reaches
 * `/about`, `/glossary` and `/compare`, all three of which carry standing
 * docblock rulings AGAINST a `metadata` export; and it is what covers the
 * routes story 3.9 is about to add without 3.9 having to open this file.
 *
 * `openGraph` is here for the same three static routes and the 404 — but it
 * does NOT reach `/`, `/matches/[slug]`, `/players/[slug]` or `/teams/[slug]`.
 * `openGraph` is replaced WHOLESALE by a child that declares it, per top-level
 * key, so those four author their own `url` AND their own `locale`.
 * `alternates` is absent from all four, so they inherit the canonical above.
 * The asymmetry is the trap; it is not symmetric and it is not intuitive (D2).
 *
 * ── `alternates` CARRIES THE SAME TRAP, AND IT IS SHARPER ──────────────────
 * `mergeMetadata` branches on KEY PRESENCE, not on `canonical`. A future route
 * that declares `alternates` for ANY reason — an `application/rss+xml` feed
 * under `types`, a `media` entry, even a bare `{}` — replaces this object
 * wholesale and ships with NO `<link rel="canonical">` at all. The canonical it
 * loses is the one authored above, so nothing in that route's own file will
 * look wrong. Story 3.9's routes inherit from here; if any of them needs
 * `alternates`, it must re-declare `canonical: "./"` alongside whatever it adds.
 * `canonical-output.test.ts` is the gate, but only over a FRESH export.
 *
 * ── THE CARD IS NOT FREE, AND THAT IS ACCEPTED (review 2026-08-26) ─────────
 * Declaring `openGraph` AT ALL makes `postProcessMetadata` back-fill
 * `og:title`/`og:description` from this object's `title`/`description` and then
 * run `resolveTwitter` over them. So `/about`, `/glossary`, `/compare` and the
 * three not-found artifacts each grew SIX tags here, not one: a full Spanish OG
 * and Twitter card where previously `openGraph` resolved null and they carried
 * none. §D8 predicted `og:url` "and nothing else" and was WRONG — it read
 * `resolve-opengraph.js:150` as the last word; the post-process step is. The
 * card is the price of AC2 (`og:url` must agree with the canonical on EVERY
 * route) and is accepted: reverting this key would break AC2 and the
 * byte-identity gate. Story 3.3 therefore inherits four routes that already
 * carry a card, and adds `images`, `type` and `siteName` — not `locale`.
 *
 * `locale: "es_ES"` is set because the Open Graph default for a missing
 * `og:locale` is `en_US`, and every document in this export is Spanish (D17,
 * upheld by D20 — ONE locale per route, so this is a constant, not a variable).
 *
 * NO `alternates.languages`, NO `hreflang`, NO `x-default`, NO per-locale URLs
 * (D17, upheld by D20; AC4). `canonical-output.test.ts` makes that a gate.
 */
/*
 * `verification.google` IS SEARCH CONSOLE'S OWNERSHIP PROOF, AND IT IS NOT
 * A SECRET (Story 3.4, AC8, 2026-08-27).
 *
 * Next emits it as `<meta name="google-site-verification">` on all ~1,406
 * routes. That is how the tag works — it is a public claim of ownership, is
 * inert to every crawler except Google's verifier, and grants nothing to
 * anyone who reads it. It is committed rather than injected from an env var
 * ON PURPOSE: `output: "export"` with NO `process.env` read is AD-13/NFR-8, a
 * shipped property this story is not permitted to break, and a build-time
 * secret in a static export is not a secret anyway — it lands in the HTML
 * either way.
 *
 * DO NOT REMOVE IT once verification succeeds. Search Console re-checks the
 * token periodically and silently un-verifies the property when it disappears,
 * which would stop the sitemap being read and end the D20-b measurement this
 * story exists to start.
 *
 * The property is the URL-prefix form rooted at `SITE_ORIGIN`, chosen over a
 * DNS-verified Domain property because this repo ships no `app/public/` and no
 * analytics, so the meta tag was the one method available without touching DNS.
 *
 * THE ORIGIN IS NOT SPELLED OUT ABOVE, AND THAT IS NOT PEDANTRY. The first
 * draft of this comment wrote the domain literally, and `site-origin.test.ts`
 * went red inside a minute: story 3.1's drift gate counts occurrences of the
 * string ANYWHERE under `app/`, comments included, and allows exactly one —
 * `site-origin.ts`. That is the gate doing its job, not a false positive, so
 * the prose refers to the constant rather than restating its value.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: t("meta.title"),
  description: t("meta.description"),
  alternates: { canonical: "./" },
  openGraph: { url: "./", locale: "es_ES" },
  verification: { google: "TgrS4P6p1SXEE0iEzkKOBjsny6S04eEPzPP56tjtLzs" },
};

/*
 * Canonical server markup (AD-12): lang="es" plus the font variable classes,
 * no theme class — dark is canonical via :root in globals.css, so no-JS
 * visitors still get dark. The ONE inline pre-paint script (first element in
 * <body>, ahead of any content paint) sets <html lang>, the locale class and
 * the theme class from a persisted preference if there is one, otherwise from
 * what the browser itself asks for — navigator.language for the locale
 * (Story 3.5, FR-37), prefers-color-scheme for the theme — otherwise the
 * canonical es/dark. A detected value is never persisted; only an explicit
 * toggle writes. suppressHydrationWarning scopes to <html>'s own attributes,
 * which the script legitimately mutates before React hydrates.
 */
const htmlClassName = [archivo.variable, inter.variable].join(" ");

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={htmlClassName} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        <LocaleProvider>
          <ThemeProvider>
            <SiteHeader />
            {/* Skip-link target; tabIndex lets fragment navigation move focus. */}
            <main id="main-content" tabIndex={-1} className="flex-1">
              {children}
            </main>
            <AttributionFooter />
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
