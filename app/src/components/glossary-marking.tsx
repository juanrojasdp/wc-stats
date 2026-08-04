"use client";

import type { ReactNode } from "react";

import { GlossaryTerm } from "@/components/GlossaryTerm";
import {
  findTermSpan,
  glossaryTermEnKey,
  glossaryTermEsKey,
  headingMark,
  summaryMark,
  type SectionMark,
} from "@/lib/glossary";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { SectionId } from "@/lib/tactical-sections";

/*
 * The React half of term marking (Story 2.18, ruled decision 6). WHICH section
 * marks WHICH term, and in the heading or the summary, is pure data in
 * @/lib/glossary — see that module's own docblock for why the partition exists
 * and why it is exact. This file only turns a resolved string into nodes.
 *
 * MARKING NEVER WRITES COPY INTO JSX. Both helpers split an ALREADY-RESOLVED
 * dictionary string around the term and render only expression containers, so
 * react/jsx-no-literals never sees a literal — the same reason
 * KeyStatisticsSection composes its labels as strings rather than as markup.
 */

export function useGlossaryMarking(): {
  markHeading: (id: SectionId, titleText: string) => ReactNode;
  markSummary: (id: SectionId, summaryText: string | null) => ReactNode | null;
} {
  const t = useT();
  const { locale } = useLocale();

  function mark(text: string, entry: SectionMark): ReactNode {
    const term = t(locale === "es" ? glossaryTermEsKey(entry.id) : glossaryTermEnKey(entry.id));
    const span = findTermSpan(text, term);
    if (span === null) {
      // A reworded title or summary is a copy change, not a crash: degrade
      // silently to unmarked text.
      return text;
    }
    return (
      <>
        {text.slice(0, span.start)}
        <GlossaryTerm termId={entry.id} termLang={entry.lang}>
          {text.slice(span.start, span.end)}
        </GlossaryTerm>
        {text.slice(span.end)}
      </>
    );
  }

  return {
    markHeading: (id, titleText) => {
      const entry = headingMark(id);
      return entry === null ? titleText : mark(titleText, entry);
    },
    markSummary: (id, summaryText) => {
      if (summaryText === null) {
        return summaryText;
      }
      const entry = summaryMark(id);
      return entry === null ? summaryText : mark(summaryText, entry);
    },
  };
}
