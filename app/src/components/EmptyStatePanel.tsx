"use client";

import { useT } from "@/lib/i18n-provider";

/*
 * The shared absence pattern (Task 2, FR-22 / UX-DR13). Visual spec
 * {components.empty-state-panel}: surface-raised, DASHED hairline border,
 * rounded-md, centered title headline + body explanation, generous padding so
 * the panel occupies the missing content's slot — the layout never collapses
 * silently.
 *
 * Two variants share one shell and must never share copy:
 *   EmptyStatePanel     — the bundle does not carry this section's data.
 *   PendingSectionPanel — the data IS there, the view has not shipped yet.
 * Ruled decision 9: telling Diego "the official report does not include this
 * section" about a section whose data is sitting in the bundle is exactly the
 * dishonesty FR-22 exists to prevent, and UJ-2's failure path is where his
 * trust in everything else is won or lost.
 *
 * No icon: DESIGN's muted glyph is optional and ink-muted is a ≥3:1 non-text
 * token only — copy must never be rendered in it.
 */

function Panel({ headline, explanation }: { headline: string; explanation: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-surface-raised px-6 py-8 text-center">
      <p className="type-title text-ink-primary">{headline}</p>
      <p className="type-body text-ink-secondary">{explanation}</p>
    </div>
  );
}

/*
 * `headline` / `explanation` are already-resolved strings passed in by the
 * caller: the i18n gate reserves `message`/`caption`/`heading`/`text`/
 * `description`/`label` as gated prop names, and these two are deliberately
 * outside that set so a caller can pass t() output without fighting the rule.
 * Default copy lives at tactical.empty.*.
 */
export function EmptyStatePanel({
  headline,
  explanation,
}: {
  headline: string;
  explanation: string;
}) {
  return <Panel headline={headline} explanation={explanation} />;
}

/**
 * AC 3's copy names what is missing: "Sin datos de {sección} para este
 * partido." t() carries no interpolation by design, so the headline is composed
 * around an already-resolved title — the section's own <h2> for a whole-section
 * absence, or a panel's own <h3> for a panel-level one (Story 2.7 Task 8.2).
 *
 * Extracted here in Story 2.7 and used by BOTH call sites: two independent
 * copies of the same composition diverge the first time the copy changes, and
 * the 2.5 review already spent a decision getting this wording right.
 */
export function useEmptyHeadline(): (title: string) => string {
  const t = useT();
  return (title: string) =>
    `${t("tactical.empty.headlineBefore")} ${title} ${t("tactical.empty.headlineAfter")}`;
}

/**
 * Placeholder for a `ready` section whose content component has not shipped
 * yet (sections 2-11 during 2.5 → 2.10). Each of those stories deletes its own
 * section's placeholder when it lands, so the copy is fixed and resolved here.
 */
export function PendingSectionPanel() {
  const t = useT();
  return (
    <Panel headline={t("tactical.pending.headline")} explanation={t("tactical.pending.explanation")} />
  );
}
