"use client";

import Link from "next/link";

import { useT } from "@/lib/i18n-provider";

/*
 * Body of the static 404: rendered through useT() so the authored en string
 * is reachable via the language toggle (server-side t() would bake static
 * Spanish into every locale). The home link targets `/` — the hub carries
 * the match list; there is no separate /matches index route.
 */
export function NotFoundContent() {
  const t = useT();
  return (
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      <h1 className="type-headline text-ink-primary">{t("notFound.message")}</h1>
      <p className="type-body mt-tile-gap">
        {/* Underlined, not hue-only — see AttributionFooter (axe
            link-in-text-block, WCAG 1.4.1). */}
        <Link
          href="/"
          className="text-accent-cyan underline underline-offset-2 hover:no-underline"
        >
          {t("notFound.homeLink")}
        </Link>
      </p>
    </div>
  );
}
