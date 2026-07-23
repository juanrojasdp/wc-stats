"use client";

import { useT } from "@/lib/i18n-provider";

/*
 * Body of the minimal /about stub: page copy must swap with the language
 * toggle, so it renders through useT() (a server-side t() call would emit
 * static Spanish). Attribution + independence framing only — methodology,
 * glossary and credits are Story 2.18.
 */
export function AboutContent() {
  const t = useT();
  return (
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      <h1 className="type-headline text-ink-primary">{t("about.title")}</h1>
      <p className="type-body mt-tile-gap max-w-prose text-ink-secondary">
        {t("chrome.footer.attribution")}
      </p>
    </div>
  );
}
