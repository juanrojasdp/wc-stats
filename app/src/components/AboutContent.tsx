"use client";

import { useT } from "@/lib/i18n-provider";

/*
 * /about (Story 2.18, AC 3). Page copy must swap with the language toggle, so
 * it renders through useT() — a server-side t() call would emit static Spanish.
 *
 * The route is NOT recreated here; the 2.2 attribution-only stub is FILLED, and
 * its "Story 2.18 replaces this" docblock is discharged.
 *
 * THE ATTRIBUTION LONG FORM IS NOT RE-MINTED. chrome.footer.attribution is
 * already ruled and already byte-identical to EXPERIENCE.md's wording, and the
 * independence disclaimer AC 3 asks for standing alone is its SECOND SENTENCE.
 * Splitting it here is the alternative to duplicating a ruled string into a new
 * key, which is the one thing a terminology story must not do.
 */

/**
 * Split the ruled attribution at its sentence boundary. Degrades to the whole
 * string in one paragraph if the copy is ever reworded into one sentence — a
 * copy change must not blank half the page.
 */
function splitAttribution(full: string): { data: string; independence: string | null } {
  const at = full.indexOf(". ");
  if (at < 0) {
    return { data: full, independence: null };
  }
  return { data: full.slice(0, at + 1), independence: full.slice(at + 2) };
}

export function AboutContent() {
  const t = useT();
  const attribution = splitAttribution(t("chrome.footer.attribution"));

  return (
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      <h1 className="type-headline text-ink-primary">{t("about.title")}</h1>

      <h2 className="type-title mt-layer-gap text-ink-primary">{t("about.dataTitle")}</h2>
      <p className="type-body mt-tile-gap max-w-prose text-ink-secondary">{attribution.data}</p>
      {attribution.independence === null ? null : (
        <p className="type-body mt-2 max-w-prose text-ink-secondary">{attribution.independence}</p>
      )}

      {/*
       * RULED VERBATIM (decision 1, Juan). The AC's own parenthetical — "xG used
       * as-is, never recomputed" — is true of the team totals and MISLEADING
       * about per-shot values: FD-1 records that per-shot xG does not exist in
       * the source at all, which is why every shot marker is drawn at the same
       * size. This is the page whose entire purpose is to explain the data
       * honestly, so it ships the two-sentence honest form. It agrees with
       * glossary.xg.definition — two surfaces, one claim.
       */}
      <h2 className="type-title mt-layer-gap text-ink-primary">{t("about.methodologyTitle")}</h2>
      <p className="type-body mt-tile-gap max-w-prose text-ink-secondary">
        {t("about.methodology")}
      </p>

      <h2 className="type-title mt-layer-gap text-ink-primary">{t("about.creditsTitle")}</h2>
      <p className="type-body mt-tile-gap max-w-prose text-ink-secondary">{t("about.credits")}</p>

      <h2 className="type-title mt-layer-gap text-ink-primary">{t("about.projectTitle")}</h2>
      <p className="type-body mt-tile-gap max-w-prose text-ink-secondary">{t("about.project")}</p>
    </div>
  );
}
