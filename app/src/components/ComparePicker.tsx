"use client";

import { SearchField } from "@/components/HeaderSearch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { compareTypeKey, composeSidesLabel } from "@/lib/compare-format";
import { COMPARE_TYPES, type CompareType } from "@/lib/compare-url";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { SearchEntity, SearchEntityKind } from "@/lib/search-model";

/*
 * ═══════════ THE COMPARISON ENTITY PICKER (Story 2.17, AC 1) ═══════════
 *
 * A type selector plus two search-selects plus swap-sides. ALWAYS MOUNTED, never
 * hidden behind the comparison: AC 1 requires selections to keep updating the URL
 * after a comparison renders, so the picker is the route's permanent first
 * region rather than an empty-state affordance.
 *
 * 🔴 IT HOLDS NO STATE AND CANNOT (AR-10). Every control below is a pure function
 * of `type` / `a` / `b` and reports upward; the URL is the only comparison state
 * there is. If you can break this page by editing the address bar, something here
 * has started holding state it should not.
 *
 * ═══════════ THE COMBOBOX IS 2.14's, REUSED WHOLE ═══════════
 *
 * `SearchField` was built for this call site by name — 2.14's ruling 2: "
 * EXPERIENCE.md's Comparison entity picker (2.17) specifies the same primitive:
 * build so 2.17 can reuse it." Forking it would duplicate `role="combobox"`,
 * `role="listbox"`, `role="option"`, `aria-activedescendant` and the `<mark>`
 * highlight — five roles this codebase had never shipped before that story.
 *
 * TYPE-SCOPING NEEDED NO `search-model.ts` CHANGE. The corpus is pre-filtered on
 * `kind` here and the already-built array is passed in, exactly as the Reuse
 * Inventory rules. `searchEntities` still assembles the whole corpus once,
 * upstream, in the region.
 *
 * ═══════════ OVERLAY DEPTH STAYS 1, PAGE-WIDE (UX-DR15) ═══════════
 *
 * Two `SearchField`s mount here and each is an overlay owner: both pass
 * `dismissClosesHost={false}`, so both register with the page-wide single-open
 * registry in `use-glossary-popover.ts` and opening either CLOSES the other. Two
 * listboxes open at once is the depth-2 stack UX-DR15 forbids, and the registry
 * is what makes that impossible rather than merely unlikely.
 *
 * ═══════════ NO `<md` SHEET, AND THAT IS ARGUED RATHER THAN SKIPPED ═══════════
 *
 * 2.14 built a full-screen dialog for narrow widths because `SiteHeader` is a
 * FIXED `h-14` bar with a language toggle and a theme toggle already in it —
 * "a label line above the input does not fit", and neither does the input at
 * 320 px. This picker owns a full-width page region with `layer-gap` beneath it
 * and has all the room an input needs; the listbox panel already carries
 * `max-w-[calc(100vw-2rem)]`, which is the clamp that makes 320 px pass.
 *
 * Mounting two modal sheets here would also cost what UX-DR15 is protecting: a
 * modal is an overlay, so the picker would take the page's single depth-1 slot
 * merely to present a field that already fits. Recorded as a scoped departure
 * from Task 4.5, not as an omission.
 */

/**
 * What joins the swap control's verb to the pair it will exchange —
 * "Intercambiar lados: México / Brasil".
 *
 * Hoisted because a bare literal in JSX trips the i18n gate, and punctuation
 * rather than a bare space because the docblock at the call site advertised the
 * colon while the code shipped without it (code review 2026-08-07). The colon is
 * the same in both locales, which is why it is a const and not a key.
 */
const SIDE_JOIN = ": ";

/**
 * The corpus kind a comparison type selects over.
 *
 * The two vocabularies are SINGULAR/PLURAL forms of the same three concepts and
 * are deliberately not unified: `SearchEntityKind` is the corpus row's own
 * discriminator (2.14) and `CompareType` is a URL value (`EXPERIENCE.md:43`).
 * A `Record` over the closed union rather than a slice-off-the-`s`, so a fourth
 * comparable type is a missing-property compile error here.
 */
const CORPUS_KIND: Record<CompareType, SearchEntityKind> = {
  players: "player",
  teams: "team",
  matches: "match",
};

function SwapIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h14" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H7" />
    </svg>
  );
}

export function ComparePicker({
  corpus,
  corpusStatus,
  type,
  aName,
  bName,
  aId,
  bId,
  onEngage,
  onAnnounce,
  onTypeChange,
  onPick,
  onSwap,
}: {
  /** The WHOLE corpus. This component does the kind filtering. */
  corpus: readonly SearchEntity[];
  corpusStatus: "loading" | "loaded" | "error" | "invalid";
  type: CompareType;
  /** The chosen entities' display names, or null. Used only for accessible names. */
  aName: string | null;
  bName: string | null;
  /** The chosen entities' ids, or null — each side filters the other's out. */
  aId: string | null;
  bId: string | null;
  onEngage: () => void;
  onAnnounce: (sentence: string) => void;
  onTypeChange: (next: CompareType) => void;
  onPick: (side: "a" | "b", entity: SearchEntity) => void;
  onSwap: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();

  /*
   * Pre-filtered per render rather than memoized. The corpus is 1,400 rows and
   * this is one linear pass on a component that re-renders when the URL changes
   * — a `useMemo` here would add a dependency array to keep correct for a cost
   * `search-model.ts` already measures as inside a frame budget.
   */
  const kind = CORPUS_KIND[type];
  const scoped = corpus.filter((entity) => entity.kind === kind);
  /*
   * 🔴 NEITHER SIDE MAY OFFER WHAT THE OTHER ALREADY HOLDS (code review
   * 2026-08-07). `?a=X&b=X` was reachable in two clicks — nothing filtered the
   * opposite pick out of the corpus — and a self-comparison produces duplicate
   * React keys, two byte-identical figure captions and two identically named
   * mini-header entries, which is also the one input the caption inventory
   * cannot see.
   *
   * FILTERED HERE RATHER THAN REJECTED ON SELECT: an option the reader can see,
   * highlight and choose, only to have it silently do nothing, is worse than one
   * that was never offered. The URL cleanup in `CompareRegion` still covers the
   * pasted case, which this cannot reach.
   */
  const scopedForA = bId === null ? scoped : scoped.filter((entity) => entity.id !== bId);
  const scopedForB = aId === null ? scoped : scoped.filter((entity) => entity.id !== aId);

  const sideALabel = t("compare.picker.sideA");
  const sideBLabel = t("compare.picker.sideB");
  /*
   * The swap control names WHAT it will exchange, not just that it exchanges —
   * "Intercambiar lados: México / Brasil". With one or zero sides chosen there
   * is nothing to name, so the bare verb stands.
   */
  const swapLabel =
    aName === null || bName === null
      ? t("compare.picker.swap")
      : `${t("compare.picker.swap")}${SIDE_JOIN}${composeSidesLabel(aName, bName)}`;

  return (
    <section className="mt-6">
      {/*
       * THE ROUTE'S `<h1>`, AND IT IS `sr-only` — the shipped shape on every
       * other route (`MatchHero`, `PlayerHero`, `TeamHero` all emit exactly one
       * sr-only `<h1>`). Code review 2026-08-07: this shipped as an `<h2>`, which
       * left `/compare` the ONLY route in the app with no `<h1>` at all and its
       * document outline starting one level down.
       *
       * It lives here rather than in `CompareRegion` because the picker is the
       * route's permanent first region — the one block that renders in every one
       * of the four states, including the pre-rendered empty shell. A heading
       * mounted anywhere else would be absent from `out/compare/index.html`.
       */}
      <h1 className="sr-only">{t("compare.heading")}</h1>

      {/*
       * The four non-negotiables at every shipped `ToggleGroup` call site:
       * `type="single"` with a controlled value; the EMPTY-STRING GUARD (Radix
       * emits "" when the active segment is re-clicked, and the active option
       * must not be deselectable); an `aria-label` from a locale key, never a
       * literal; and `min-h-11 min-w-11` on each ITEM — UX-DR16 is ≥44×44 px and
       * `min-h-11` alone is height only.
       *
       * Radix gives `type="single"` groups RADIO-GROUP semantics
       * (`role="radiogroup"` / `role="radio"` + `aria-checked`), which is what a
       * three-way exclusive filter is; it is NOT a tablist.
       */}
      <ToggleGroup
        type="single"
        value={type}
        onValueChange={(value) => {
          if (value !== "") {
            onTypeChange(value as CompareType);
          }
        }}
        aria-label={t("compare.type.label")}
        className="flex-wrap rounded-full border border-hairline p-0.5"
      >
        {COMPARE_TYPES.map((code) => (
          <ToggleGroupItem
            key={code}
            value={code}
            className="min-h-11 min-w-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
          >
            {t(compareTypeKey(code))}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/*
       * Three columns at `≥md`, stacked below it — the one breakpoint this route
       * uses (see `CompareRegion`'s note on the unspecified md→lg band). The swap
       * control sits BETWEEN the two fields at width, which is where its arrows
       * mean something, and drops under them when they stack.
       */}
      <div className="mt-tile-gap grid gap-tile-gap md:grid-cols-[1fr_auto_1fr] md:items-end">
        <div className="min-w-0">
          <SearchField
            corpus={scopedForA}
            status={corpusStatus}
            onEngage={onEngage}
            onAnnounce={onAnnounce}
            locale={locale}
            dismissClosesHost={false}
            fieldLabel={sideALabel}
            onSelect={(entity) => onPick("a", entity)}
          />
        </div>

        <button
          type="button"
          onClick={onSwap}
          aria-label={swapLabel}
          className="flex min-h-11 min-w-11 items-center justify-center justify-self-start rounded-md border border-hairline text-ink-secondary md:justify-self-auto"
        >
          <SwapIcon />
        </button>

        <div className="min-w-0">
          <SearchField
            corpus={scopedForB}
            status={corpusStatus}
            onEngage={onEngage}
            onAnnounce={onAnnounce}
            locale={locale}
            dismissClosesHost={false}
            fieldLabel={sideBLabel}
            onSelect={(entity) => onPick("b", entity)}
          />
        </div>
      </div>
    </section>
  );
}
