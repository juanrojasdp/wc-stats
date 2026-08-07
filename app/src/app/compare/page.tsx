import { CompareRegion } from "@/components/CompareRegion";

/*
 * `/compare` (Story 2.17, FR-29 / UJ-3). ONE PRE-RENDERED SHELL over a client
 * body — the shipped house pattern for a route with no dynamic segment, stated at
 * `players/[slug]/page.tsx:14-22`: "A SERVER COMPONENT over client bodies … The
 * client boundary is what makes the language toggle work at all." `/about` and
 * `/glossary` are 15- and 22-line server shells; this is the third.
 *
 * NO `generateStaticParams` and NO `dynamicParams`: there is no dynamic segment
 * to enumerate. The comparison is carried entirely in the QUERY STRING, which
 * `output: "export"` does not vary a document by — `out/compare/index.html` is one
 * file served for every `?type=&a=&b=`, and `CompareRegion` reads the params
 * client-side (`EXPERIENCE.md:43`).
 *
 * ═══════════ `export const metadata` IS NOT TAKEN, AND THAT IS A RULING ══════
 *
 * Three reasons, in order of force:
 *
 *  · IT WOULD MINT DEAD KEYS. `<title>` and OG stay Spanish after an EN toggle
 *    (`EXPERIENCE.md:40`, filed at `deferred-work.md:975`), so `en.*` metadata
 *    keys are unreachable BY CONSTRUCTION — precisely the pattern 2.18's BINDING
 *    prohibition forbids, and precisely the open ruling 2.18 filed rather than
 *    resolved: "Either both routes take metadata or neither does; that is the
 *    open ruling the story was told to file, not resolve." That ruling is Juan's
 *    and is still open.
 *  · NFR-4 EXCLUDES THIS ROUTE BY ENUMERATION. `epics.md:70`, `prd.md:390` and
 *    `EXPERIENCE.md:42` each name exactly three route classes — match, player,
 *    team. Story 2.17's acceptance criteria are silent on `<title>`/OG, unlike
 *    2.15's (`epics.md:939`) and 2.16's (`epics.md:956`), which name it.
 *  · ENTITY-SPECIFIC OG IS ARCHITECTURALLY IMPOSSIBLE HERE. One shell, one static
 *    `<head>`, no per-`?a=&b=` variant under `output: "export"`.
 *
 * THE CONSEQUENCE IS FILED RATHER THAN HIDDEN (Task 12.2): a shared comparison
 * link's preview card is the generic shell's, not the two entities'. The
 * `<title>`-language decision itself is NOT re-filed here — it is 2.12's, owner
 * Juan, one entry and one owner.
 *
 * ═══════════ THIS FILE MAKES NO RUNTIME FETCH ═══════════
 *
 * The three the route makes live two hops away in `CompareRegion`, which is what
 * `src/app/static-output.test.ts`'s per-route allow-list walks for. It is also
 * why that describe carries a "guards the guard" test, as all four siblings do —
 * and why the helper's NAME is deliberately not spelled anywhere in this file:
 * the guard asserts this source does not contain it.
 */

/**
 * `max-w-6xl` and the gutter pair are every shipped route's container. `pb-`, NOT
 * `py-`: the header already supplies the top rhythm and every other route uses
 * the bottom-only form.
 */
export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-gutter-mobile pb-layer-gap md:px-gutter-desktop">
      <CompareRegion />
    </div>
  );
}
