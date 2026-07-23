"use client";

import Link from "next/link";

import { useT } from "@/lib/i18n-provider";

/*
 * Attribution footer (DESIGN.md / EXPERIENCE.md, OQ-3): one caption line in
 * ink-secondary on surface-base, hairline top rule, /about link in
 * accent-cyan. Present on every route, NOT dismissible — no close affordance
 * of any kind.
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
        </p>
      </div>
    </footer>
  );
}
