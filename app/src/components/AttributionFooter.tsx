"use client";

import Link from "next/link";

import { useT } from "@/lib/i18n-provider";

/*
 * Attribution footer (DESIGN.md / EXPERIENCE.md, OQ-3): one caption line in
 * ink-secondary on surface-base, hairline top rule, /about link in
 * accent-cyan. Present on every route, NOT dismissible — no close affordance
 * of any kind.
 *
 * The /glossary link is Story 2.18 (AC 3's binding). EXPERIENCE.md's IA route
 * table names the footer as /glossary's reach path ("Footer, every glossary
 * tooltip's 'see more'"); DESIGN.md's footer bullet mentions only the about
 * link and is STALE. The spine disagreement is filed in deferred-work.md rather
 * than resolved by editing DESIGN.md — that is not this story's artifact.
 */
export function AttributionFooter() {
  const t = useT();
  return (
    <footer className="border-t border-hairline bg-surface-base">
      <div className="mx-auto max-w-6xl px-gutter-mobile py-4 md:px-gutter-desktop">
        <p className="type-caption text-ink-secondary">
          {t("chrome.footer.attribution")}
          <Link href="/about" className="ml-1 text-accent-cyan hover:underline">
            {t("chrome.footer.aboutLink")}
          </Link>
          <Link href="/glossary" className="ml-3 text-accent-cyan hover:underline">
            {t("chrome.footer.glossaryLink")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
