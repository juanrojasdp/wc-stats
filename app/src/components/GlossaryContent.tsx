"use client";

import {
  GLOSSARY_GLOSS_KEY,
  GLOSSARY_POLICY,
  GLOSSARY_TERMS,
  glossaryDefinitionKey,
  glossaryTermEnKey,
  glossaryTermEsKey,
  type GlossaryTermId,
} from "@/lib/glossary";
import { useLocale, useT } from "@/lib/i18n-provider";

/*
 * /glossary (Story 2.18, AC 2). A "use client" body behind a thin server page,
 * exactly like /about and /404: a server t() call emits FROZEN Spanish, and
 * only useT() consumers swap with the language toggle.
 *
 * BOTH LANGUAGES RENDER AT ONCE, in one locale's page. AC 2 says the list
 * renders "in both languages", and EXPERIENCE's Component-Patterns rule says
 * every entry shows the counterpart-language term as a subtitle — that is
 * Diego's bridge (review-i18n.md §5): a bilingual reader must be able to map
 * "salida de balón" to "build-up" without flipping the entire interface. Only
 * the DEFINITION follows the active locale.
 *
 * Anchors are language-neutral English slugs (ruled decision 11), so
 * /glossary/#build-up resolves from both locales and survives an amendment to
 * the Spanish term.
 *
 * NO role="region" ANYWHERE. The Tactical Layer already produced 22 landmarks
 * for 11 sections and an axe landmark-unique failure once; a term list is not
 * a landmark.
 */

function GlossaryEntry({ termId }: { termId: GlossaryTermId }) {
  const t = useT();
  const { locale } = useLocale();

  const esTerm = t(glossaryTermEsKey(termId));
  const enTerm = t(glossaryTermEnKey(termId));
  const activeTerm = locale === "es" ? esTerm : enTerm;
  const counterpartTerm = locale === "es" ? enTerm : esTerm;
  const counterpartLang = locale === "es" ? "en" : "es";
  const counterpartPrefixKey = locale === "es" ? "glossaryPage.enPrefix" : "glossaryPage.esPrefix";

  /*
   * Ruled decision 13: no counterpart subtitle where the two terms are
   * IDENTICAL — "momentum — en: momentum" is a tautology wearing a lang span
   * that asserts a language change that does not occur. The ruled gloss renders
   * instead where the table gives one (xG); where it does not, nothing renders.
   */
  const identical = esTerm === enTerm;
  const glossKey = GLOSSARY_GLOSS_KEY[termId];
  const gloss = identical && glossKey !== undefined ? t(glossKey) : null;
  const policy = GLOSSARY_POLICY[termId];
  /*
   * The jargon note explains that the ENGLISH term is deliberately retained
   * because no Spanish form would be recognised — so it must not render on an
   * entry that is, three lines above, showing the reader a Spanish form. `xg`
   * carries the ruled gloss "goles esperados" and a definition that opens with
   * those same two words, and shipped the note anyway: the page told the reader
   * both the Spanish form and that there isn't one (2.18 code review).
   *
   * Same shape as decision 13's own rule for the counterpart subtitle —
   * suppress where the line would contradict what is already on screen.
   */
  const keepsEnglish = (policy === "jargon" || policy === "tooltip") && gloss === null;

  return (
    <div className="border-t border-hairline py-4">
      {/*
       * tabIndex={-1} so a #term deep link MOVES FOCUS and not only the
       * scroll position, on the layout's <main tabIndex={-1}> precedent.
       *
       * KNOWN ADJACENT GAP, filed by the 2.5 review and NOT this story's to
       * fix: re-activating an UNCHANGED hash never re-fires `hashchange`, so a
       * repeat link to the same term is a silent no-op.
       */}
      {/* The active-locale term carries NO lang: it is the page's language. */}
      <dt id={termId} tabIndex={-1} className="type-title text-ink-primary">
        {activeTerm}
      </dt>
      {identical ? null : (
        <dd className="mt-0.5 flex flex-wrap items-baseline gap-1 type-caption text-ink-secondary">
          <span>{t(counterpartPrefixKey)}</span>
          <span lang={counterpartLang}>{counterpartTerm}</span>
        </dd>
      )}
      {gloss === null ? null : (
        <dd className="mt-0.5 type-caption text-ink-secondary">{gloss}</dd>
      )}
      {/* Never text-ink-muted: 3.30:1 is below the 4.5:1 text floor. */}
      <dd className="mt-2 max-w-prose type-body text-ink-primary">
        {t(glossaryDefinitionKey(termId))}
      </dd>
      {keepsEnglish ? (
        <dd className="mt-1 max-w-prose type-caption text-ink-secondary">
          {t("glossaryPage.jargonNote")}
        </dd>
      ) : null}
    </div>
  );
}

export function GlossaryContent() {
  const t = useT();
  return (
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      <h1 className="type-headline text-ink-primary">{t("glossaryPage.title")}</h1>
      <p className="type-body mt-tile-gap max-w-prose text-ink-secondary">
        {t("glossaryPage.intro")}
      </p>
      {/*
       * Said ONCE, on the page: the PMSR prints no glossary and no definition of
       * any term — 0 hits across all 52 pages — so every definition here is
       * authored from page placement and reconciliation arithmetic rather than
       * transcribed. Claiming otherwise on the page that exists to explain the
       * data would be the dishonesty this whole story is against.
       */}
      <p className="type-caption mt-2 max-w-prose text-ink-secondary">
        {t("glossaryPage.authoredNote")}
      </p>
      {/* Rendered in GLOSSARY_TERMS order — the policy table's order, frozen. */}
      <dl className="mt-layer-gap">
        {GLOSSARY_TERMS.map((termId) => (
          <GlossaryEntry key={termId} termId={termId} />
        ))}
      </dl>
    </div>
  );
}
