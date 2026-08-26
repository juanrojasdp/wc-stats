"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import type { Stage, Tournament } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { formatInteger } from "@/lib/format";
import { STAGES, stageLabelKey } from "@/lib/hub-model";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  countResults,
  entityKindLabelKey,
  entityKindRowLinkKey,
  searchEntities,
  searchResults,
  type SearchEntity,
  type SearchLabels,
  type SearchResult,
} from "@/lib/search-model";
import { loadTournamentIndex } from "@/lib/tournament-index";
import { closeOtherOverlays, registerOverlayCloser } from "@/lib/use-glossary-popover";

/*
 * ══════════════ THE HEADER TYPEAHEAD (Story 2.14, UX-DR5 / UX-DR4) ══════════
 *
 * A HAND-ROLLED COMBOBOX, and ruling 2 is why. UX-DR5 and DESIGN.md both say
 * "shadcn Command" — shadcn's `Command` wraps the `cmdk` package, and `cmdk` is
 * not installed (verified absent from package.json AND node_modules). Story
 * 2.2's boundary is "add no new runtime dependencies", so it is built on
 * primitives already present. The one Radix primitive it does take, Dialog, ships
 * inside `radix-ui@1.6.5` already and costs nothing new.
 *
 * The existing primitives are deliberately NOT pressed into the listbox role:
 * `dropdown-menu` is `role="menu"` and Radix moves DOM focus into it, which an
 * `aria-activedescendant` combobox must never do; `popover.tsx` is "DELIBERATELY
 * BEHAVIOUR-FREE" and enforces the ABSENCE of a portal. Their CLASS STRINGS are
 * copied; their roles are not.
 *
 * This codebase has never shipped `role="combobox"`, `role="listbox"`,
 * `role="option"`, `aria-activedescendant` or `<mark>` — all five were
 * zero-occurrence in `app/src` before this file. EXPERIENCE.md's Comparison
 * entity picker (Story 2.17) specifies the same primitive: this is built so 2.17
 * CAN reuse it, and not built FOR 2.17.
 *
 * 🔴 THIS COMPONENT EMITS NO `<section>` ELEMENT, AND THAT IS LOAD-BEARING.
 * `src/app/matches/static-output.test.ts`'s `heroSection()` helper slices the
 * WHOLE DOCUMENT at its first `<section>`, and the header renders before
 * `<main>` — so a `<section>` here would silently re-target 19 Hero assertions
 * onto search markup. Green tests asserting the wrong DOM is the exact
 * lying-about-completion failure this story must not cause.
 *
 * ══════════════ THE `<xl` COLLAPSE IS CSS, NOT A JS BRANCH (ruling 4) ═══════
 *
 * ⚠️ THE BREAKPOINT IS NOW `xl`, NOT `md` (Story 3.10, UX-DR24), and this file
 * no longer owns the narrow presentation at all — `SiteNav` does. What survives
 * unchanged is the RULING, which was never about which breakpoint: it is that
 * the choice of presentation is made by the stylesheet and never by JavaScript.
 *
 * `useMediaQuery`'s `getServerSnapshot` returns `false`, justified by a
 * condition the header does not meet: "The Tactical Layer mounts only after the
 * client fetch resolves, so its first render is a client render." `SiteHeader`
 * is PRERENDERED into all 1,406 HTML files, so a JS breakpoint branch here emits
 * narrow markup on the server and hydrates wide on desktop — a mismatch on every
 * page. There is no `useMediaQuery` in this story either.
 *
 * Tailwind's `hidden` is `display:none`, which removes the element from the
 * ACCESSIBILITY TREE — so exactly one combobox is exposed at any width and there
 * are never duplicate roles. Below `xl` that is the sheet's; at `≥xl` it is this
 * file's inline one. The sheet's listbox mounts only while open, with its own
 * `useId()` namespace.
 *
 * ══════════════ ESCAPE IS ONE PRESS, BECAUSE FOCUS NEVER OPENS (ruling 3) ════
 *
 * Story 2.8 shipped a multi-press Escape as a disclosed deviation, from two
 * compounding mechanisms: (1) `onFocus` opened a layer, so the inner handler
 * always claimed press #1; (2) dismissal restored focus and focus restoration
 * re-triggered the opener. Story 2.18 fixed (2) with a suppression flag.
 *
 * THIS COMPONENT NEVER OPENS ON FOCUS. The listbox opens on INPUT and on
 * ArrowDown, never on focus — which defeats both mechanisms at the root: there
 * is nothing for a restored focus to re-open, so no suppression flag is needed,
 * and needing one would be the signal that this rule had been violated.
 *
 * DEPTH 1 IS PAGE-WIDE, not component-wide (UX-DR15 bans an overlay stack
 * deeper than one). Glossary popovers ship on /glossary, on match routes and on
 * the Hub — the same routes this header covers — so this component JOINS the
 * page-wide single-open registry in `use-glossary-popover.ts` rather than
 * standing outside it. Task 7.7 exported that registry for exactly this.
 */

/**
 * How many rows the panel shows. A judgement, not a ruling — there is no
 * `/search` route in the IA to overflow into, and at 1,400 entities a
 * one-character query matches most of the corpus, so SOME cap is unavoidable.
 * The announcement always states the TOTAL, so the cap is never silent.
 */
const RESULT_LIMIT = 10;

/*
 * How long the query must be idle before its result count is announced —
 * copied from `LeaderboardsRegion`, whose recorded rationale applies with more
 * force here: "typing an eight-letter name queued eight utterances", and a
 * typeahead is the worst case for that.
 *
 * FILTERING IS NOT DEBOUNCED (ruling 12) — only the ANNOUNCEMENT is. A
 * pre-folded linear scan over 1,400 rows is comfortably inside a frame budget,
 * and a debounced filter would make the visible list lag the caret.
 */
const ANNOUNCE_SETTLE_MS = 400;

/** Composition glyphs, hoisted: `react/jsx-no-literals` bans them as JSX text. */
const SPACE = " ";
const COUNT_SEPARATOR = " ";

/**
 * The four states, mirroring `TournamentHubRegion`'s machine exactly.
 *
 * "error" and "invalid" are DISTINCT and neither is the AC's empty state
 * (Task 7.8): a fetch that failed is a network problem; a payload that arrived
 * intact and failed the schemaVersion gate is a data-integrity problem; and
 * "no corpus" is a different fact from "zero matches", which is what the AC's
 * copy actually asserts. The header searches on four routes where NO region
 * validates this artifact for it, so the gate lives here too.
 */
type Status = "loading" | "loaded" | "error" | "invalid";



/**
 * The whole search surface: one corpus PER MOUNT, one live region, two
 * presentations.
 *
 * ⚠️ "ONE CORPUS" WAS TRUE UNTIL STORY 3.10 (2026-08-26 code review). `SiteNav`
 * calls this hook a SECOND time for the sheet's own search, so two instances are
 * mounted on every route. `loadTournamentIndex()` dedupes the REQUEST at module
 * level — which is what `SiteNav`'s comment claims and is true — but it does not
 * dedupe the `useMemo` below that materialises the corpus from the 409 kB
 * payload. Open the sheet on a tablet, widen past `xl`, focus the inline input,
 * and the corpus is built and retained twice.
 *
 * ACCEPTED, NOT OVERLOOKED: the two presentations are mutually exclusive by
 * `display:none` and by D7's `xl` auto-close, so in ordinary use only one
 * instance ever engages and the second `tournament` stays `null` — the memo
 * never runs. Hoisting the corpus to a module-level cache would fix the crossing
 * case at the cost of a second cache to invalidate alongside
 * `resetTournamentIndexCache()`. If a third consumer ever appears, hoist it.
 *
 * The corpus and the announcement live HERE rather than in `SearchField` so the
 * two presentations cannot disagree about either — the sheet mounts and unmounts
 * on every open, and a corpus held inside it would re-fetch (or at least
 * re-build) each time.
 */
export function useSearchIndex() {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  /**
   * 0 = never engaged. Every later value is one load attempt.
   *
   * 🔴 A COUNTER, NOT A BOOLEAN, AND THAT IS THE WHOLE RETRY PATH (code review
   * 2026-08-07). This was `engaged: boolean`, set true and never again, with the
   * loader effect keyed on it — so `.catch(() => setStatus("error"))` was
   * ABSORBING: one rejected fetch killed header search for the rest of the page
   * lifetime, on all five routes, with no way back. `tournament-index.ts` clears
   * its module slot on rejection precisely "so the next engagement retries", but
   * nothing ever asked it to, and that clear was unreachable code.
   *
   * The Reuse Map called for `TournamentHubRegion`'s `attempt` counter and it
   * was not carried over. This is it. The Hub pairs its counter with a retry
   * BUTTON; the header has no room for one in its bar and no copy for it, so
   * the retry rides the engagement the reader already performs — focusing the
   * input or opening the sheet. That is exactly the trigger the loader's comment
   * names.
   */
  const [attempt, setAttempt] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * LAZY, ON FIRST ENGAGEMENT — ruling 1, and the whole reason AC 7 could be
   * discharged honestly. Nothing is fetched on page load; `engaged` flips on
   * focus or on opening the sheet, and the loader itself dedupes across both
   * presentations AND the Hub. Measured: the index is 409,524 B raw / 39,137 B
   * gzip, and four of the five routes ship no code that fetches it today.
   */
  useEffect(() => {
    if (attempt === 0) {
      return;
    }
    let cancelled = false;
    loadTournamentIndex()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        // Validate before declaring success — the same gate, for the same
        // reason, as `TournamentHubRegion`. SCHEMA_VERSION comes from the
        // GENERATED module and is never hardcoded.
        if (payload.schemaVersion !== SCHEMA_VERSION) {
          setStatus("invalid");
          return;
        }
        setTournament(payload);
        setStatus("loaded");
      })
      .catch(() => {
        // Every consumer catches: the loader clears its slot on rejection and
        // re-throws, and an UNHANDLED rejection would breach Task 11.7's
        // zero-console requirement as well as leaving this region in "loading".
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /**
   * First engagement loads; a later engagement RETRIES, but only from `error`.
   *
   * `invalid` deliberately does not retry, and that is the same distinction the
   * status machine exists to draw: a payload that arrived intact and failed the
   * `schemaVersion` gate will fail it again, so re-fetching it would spin
   * forever and tell the reader nothing new. `LeaderboardsRegion` states the
   * rule — "a retry cannot change the answer".
   */
  const engage = useCallback(() => {
    if (attempt === 0) {
      setAttempt(1);
      return;
    }
    if (status === "error") {
      setStatus("loading");
      setAttempt((current) => current + 1);
    }
  }, [attempt, status]);

  useEffect(() => {
    return () => {
      if (announceTimer.current !== null) {
        clearTimeout(announceTimer.current);
      }
    };
  }, []);

  /**
   * Queue one announcement, 400 ms after the reader stops typing.
   *
   * The region below is mounted UNCONDITIONALLY; this only changes its text.
   */
  const announce = useCallback((sentence: string) => {
    if (announceTimer.current !== null) {
      clearTimeout(announceTimer.current);
    }
    announceTimer.current = setTimeout(() => {
      setAnnouncement(sentence);
    }, ANNOUNCE_SETTLE_MS);
  }, []);

  /*
   * THE CORPUS, built once per (artifact, locale) pair.
   *
   * Locale is a real dependency and not incidental: the match detail lines carry
   * resolved stage labels and the team details carry the resolved group word, so
   * a mid-session ES|EN toggle must rebuild them. Names themselves pass through
   * untranslated (FR-30) — only the chrome around them is localized.
   */
  const labels: SearchLabels = useMemo(
    () => ({
      stageLabels: Object.fromEntries(
        STAGES.map((stage) => [stage, t(stageLabelKey(stage))])
      ) as Record<Stage, string>,
      groupWord: t("match.hero.group"),
      separator: t("hub.separator"),
      scoreSeparator: t("match.hero.scoreSeparator"),
      extraTimeShort: t("hub.results.extraTimeShort"),
      penShort: t("match.meta.penShort"),
    }),
    [t]
  );

  const corpus = useMemo(
    () => (tournament === null ? [] : searchEntities(tournament, labels)),
    [tournament, labels]
  );

  /**
   * Clear the queued announcement AND the pending timer.
   *
   * Called on BOTH edges of the nav sheet's open state (Story 3.10 Task 4.6),
   * for the reason the deleted `<md` sheet recorded in place: a live region that
   * mounts ALREADY-POPULATED does not announce reliably. So a count queued
   * 400 ms ago must not travel into the panel the reader just opened, nor
   * survive into the one they just left.
   */
  const resetAnnouncement = useCallback(() => {
    if (announceTimer.current !== null) {
      clearTimeout(announceTimer.current);
      announceTimer.current = null;
    }
    setAnnouncement("");
  }, []);

  return { corpus, status, engage, announce, announcement, resetAnnouncement };
}

/*
 * ══════════ THE `\u2265xl` INLINE COMBOBOX (Story 3.10, UX-DR24) ═══════════════
 *
 * 🔴 THIS COMPONENT NO LONGER OWNS A SHEET, AND THE BREAKPOINT MOVED md → xl.
 * UX-DR24 absorbs the header search INTO the nav sheet: below `xl` there is one
 * trigger, in `SiteNav`, and it opens one panel holding the search, the
 * destinations and the language/theme controls. A `<xl` header carrying BOTH a
 * nav trigger and a search trigger is the fifth row element DESIGN.md's Don'ts
 * column forbids, and it forfeits the whole reason UX-DR24 chose this shape —
 * that the trigger REPLACES three controls rather than joining them.
 *
 * So what was `HeaderSearch`'s own `Dialog` (its trigger, content and close) is
 * DELETED rather than moved, and `SiteNav` mounts `SearchField` directly. The
 * data layer both presentations need is `useSearchIndex()` above — one fetch
 * state machine, one status gate, one debounced announcer, defined once.
 *
 * ⚠️ `md:` → `xl:` WAS MEASURED, NOT PREFERRED (D15). At `lg` the inline row
 * needs ~1,060–1,080 px against 976 px usable, and it fails INVISIBLY: this
 * component ships `min-w-0 flex-1`, so the input silently collapses rather than
 * the row overflowing. `xl` clears by ~150 px, which is the margin Spanish
 * expansion needs. Do not reopen `lg`.
 *
 * 🔴 THE LIVE REGION IS INSIDE THE HIDDEN ROOT, AND THAT IS WHAT KEEPS THE TWO
 * REGIONS FROM EVER BOTH BEING LIVE. It used to sit outside the breakpoint
 * wrapper and be gated on this component's own `sheetOpen`, because below `md`
 * the root was displayed and its region would have announced into a subtree
 * Radix had marked inert. That gate is now structural instead: `hidden` is
 * `display:none`, which removes this whole subtree — region included — from the
 * accessibility tree below `xl`, and the sheet's own region (inside the portal,
 * so outside what Radix inerts) is the only one there. Above `xl` the sheet
 * cannot be open at all: `SiteNav` closes it at the breakpoint, for the reason
 * recorded there. A prop threading the sheet's state back into this component
 * would re-derive in JavaScript a guarantee the stylesheet already gives.
 */
export function HeaderSearch() {
  const { locale } = useLocale();
  const { corpus, status, engage, announce, announcement } = useSearchIndex();

  return (
    /*
     * `data-slot` and `min-w-0 flex-1` are KEPT from Story 2.2's reserved slot
     * (Task 9.1) and pinned on the exported markup by `static-output.test.ts`.
     * `min-w-0` is what lets the input shrink inside the header's flex row.
     *
     * NO `aria-hidden` HERE. Story 2.2's review removed it specifically so that
     * 2.14 could mount focusable content inside. Do not reintroduce it.
     */
    <div data-slot="header-search-slot" className="hidden min-w-0 flex-1 xl:flex">
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <div className="min-w-0 flex-1">
        <SearchField
          corpus={corpus}
          status={status}
          onEngage={engage}
          onAnnounce={announce}
          locale={locale}
          dismissClosesHost={false}
        />
      </div>
    </div>
  );
}

/**
 * ONE input, one listbox — rendered by BOTH presentations so they cannot drift.
 *
 * Task 8.3 names this as the part most likely to diverge, and it is: the two
 * presentations differ only in where they sit, whether they autofocus, and what
 * Escape means. Everything an assistive technology can observe — the roles, the
 * keyboard model, the highlight, the empty state — is this one component.
 *
 * 🔴 EXPORTED FOR `/compare` (Story 2.17 Task 4.1), AND THAT WAS THIS FILE'S
 * DECLARED PURPOSE FROM THE START. 2.14's ruling 2 says so in the header docblock:
 * "EXPERIENCE.md's Comparison entity picker (Story 2.17) specifies the same
 * primitive: this is built so 2.17 CAN reuse it." Forking it would have meant a
 * second `role="combobox"` with a second keyboard model, a second
 * `aria-activedescendant` contract and a second highlight — five roles this
 * codebase had never shipped before 2.14, duplicated.
 *
 * EXPORTED IN PLACE RATHER THAN LIFTED TO ITS OWN MODULE. Task 4.1 permits
 * either; in place is the smaller change, and `HeaderSearch.test.tsx:462-475`
 * asserts against THIS file's source path — lifting would have meant moving that
 * assertion in the same commit, for no gain to either caller.
 *
 * TWO PROPS ARE NEW AND BOTH ARE OPTIONAL, so the header's two call sites are
 * untouched:
 *  · `onSelect` turns every result row from a `<Link>` into a
 *    `<button type="button">`. The comparison picker CHOOSES an entity — it does
 *    not navigate to one — and a link that suppresses its own navigation is a
 *    lie to every assistive technology that reports it as a link.
 *  · `fieldLabel` names the field, because a route with TWO of these needs them
 *    told apart ("Lado A" / "Lado B"); the header's single field keeps
 *    `search.label`. It is NOT called `label`: that name is on the sixteen-name
 *    i18n gated list, and the gate matches `^label$` exactly. It names the FIELD
 *    ONLY — the listbox keeps `search.listLabel` on every call site, for the
 *    reason recorded at that assignment below.
 */
export function SearchField({
  corpus,
  status,
  onEngage,
  onAnnounce,
  locale,
  autoFocus = false,
  dismissClosesHost,
  onSelect,
  fieldLabel,
}: {
  corpus: readonly SearchEntity[];
  status: Status;
  onEngage: () => void;
  onAnnounce: (sentence: string) => void;
  locale: "es" | "en";
  autoFocus?: boolean;
  /** True in the sheet: Escape belongs to the host dialog, not to the listbox. */
  dismissClosesHost: boolean;
  /**
   * Present ⇒ rows are BUTTONS that call this instead of anchors that navigate.
   *
   * The field also clears itself after a choice: the picker's chosen entity is
   * shown by the comparison, not by a query string left in the box, and leaving
   * the previous needle behind would re-open the same list on the next keystroke.
   */
  onSelect?: (entity: SearchEntity) => void;
  /** Already-resolved accessible name for the input. Defaults to `search.label`. */
  fieldLabel?: string;
}) {
  const t = useT();
  const inputId = useId();
  const listboxId = useId();
  const optionIdPrefix = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  /**
   * -1 means "no option is active", which is the resting state.
   *
   * MANUAL SELECTION, deliberately: nothing is auto-highlighted, so Enter before
   * any arrow key does nothing rather than navigating a reader to a row they
   * never chose. ARIA APG permits both models; this is the safer one on a
   * control whose first result changes on every keystroke.
   */
  const [activeIndex, setActiveIndex] = useState(-1);
  /*
   * `HTMLElement`, not `HTMLAnchorElement` (Story 2.17): a row is an anchor in
   * the header and a button in the comparison picker, and both paths dispatch
   * through this same ref list on Enter.
   */
  const anchorRefs = useRef<(HTMLElement | null)[]>([]);
  /** The input + panel wrapper, so an outside pointer can be told from an inside one. */
  const fieldRef = useRef<HTMLDivElement | null>(null);

  /*
   * 🔴 THE INLINE LISTBOX IS ITSELF AN OVERLAY, AND IT MUST JOIN THE REGISTRY.
   *
   * FOUND IN THE BROWSER, NOT IN THE TESTS (Task 11.3). Registering only the
   * SHEET left the desktop listbox outside the page-wide single-open rule: with
   * results showing, hovering a glossary term opened its popover and the listbox
   * stayed up — measured overlay depth 2, which is exactly the stack UX-DR15
   * forbids and exactly what Task 7.7 exists to prevent. The sheet was
   * registered, so the mechanism looked done; the presentation that is visible
   * at desktop width was the one still outside it.
   *
   * WHICH PRESENTATION REGISTERS IS THE WHOLE SUBTLETY. `dismissClosesHost`
   * means "I live inside a host overlay that already owns the depth-1 slot" —
   * true only in the sheet. The sheet's field must NOT register and must NOT
   * call `closeOtherOverlays`, because its own listbox is PART of the dialog:
   * a field that closed "every other overlay" on opening its list would close
   * the very dialog the reader is typing in.
   */
  const ownsOverlaySlot = !dismissClosesHost;
  const closeListbox = useRef(() => {
    setOpen(false);
    setActiveIndex(-1);
  });

  useEffect(() => {
    if (!ownsOverlaySlot) {
      return;
    }
    return registerOverlayCloser(closeListbox.current);
  }, [ownsOverlaySlot]);

  /*
   * 🔴 AN OUTSIDE POINTER DISMISSES THE LISTBOX (code review 2026-08-07).
   *
   * The panel had exactly two ways to close — Escape, and emptying the box —
   * and nothing else in this tree behaves that way: the glossary popover closes
   * on an outside click, and Radix's DismissableLayer does it for the sheet. So
   * the desktop reader clicked a heading, or anywhere on the page, and the
   * result list stayed hanging under the sticky bar over the content they had
   * moved to.
   *
   * ONLY THE INLINE PRESENTATION REGISTERS THIS. Inside the sheet the listbox is
   * part of the dialog, and Radix already owns every outside interaction for it
   * — the same `ownsOverlaySlot` split, for the same reason, as the registry
   * above.
   *
   * `pointerdown` rather than `click`: it fires before focus moves, so a click
   * that lands on another focusable element dismisses cleanly instead of racing
   * the focus change.
   */
  useEffect(() => {
    if (!ownsOverlaySlot || !open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const root = fieldRef.current;
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
        closeListbox.current();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [ownsOverlaySlot, open]);

  const needle = query.trim();
  /*
   * UNDEBOUNCED (ruling 12). The corpus is pre-folded at assembly, so this is
   * one linear pass over 1,400 rows with no per-row normalization — comfortably
   * inside a frame budget, and the visible list never lags the caret.
   */
  const results: SearchResult[] = useMemo(
    () => (status === "loaded" ? searchResults(corpus, needle, RESULT_LIMIT) : []),
    [corpus, needle, status]
  );

  const isOpen = open && needle !== "";
  const activeOption = activeIndex >= 0 && activeIndex < results.length ? results[activeIndex] : null;

  /**
   * True only when the `<ul role="listbox">` is genuinely in the document.
   *
   * 🔴 `isOpen` IS NOT THE SAME CONDITION, AND CONFLATING THEM WAS THE EXACT
   * FAILURE THE `aria-controls` COMMENT BELOW CLAIMS TO PREVENT (code review
   * 2026-08-07). The panel has six render states and only ONE of them emits the
   * listbox: `SearchPanel` returns a `<p>` for loading / error / invalid and a
   * `<div>` for no-results. So `aria-controls={isOpen ? listboxId : undefined}`
   * pointed at an id that is not in the document in four of the six — including
   * the two commonest, a first keystroke before the corpus lands and a query
   * that matches nothing. That is the axe `aria-valid-attr-value` failure by
   * name.
   */
  const listboxRendered = isOpen && status === "loaded" && results.length > 0;

  /*
   * Latest-value refs, so the two effects below can depend on the ONE thing that
   * should re-fire them without dragging a per-render closure into their
   * dependency arrays.
   */
  const queryRef = useRef(query);
  queryRef.current = query;
  const announceForRef = useRef<(next: string) => void>(() => {});
  const previousStatus = useRef(status);

  /*
   * 🔴 RE-ANNOUNCE WHEN THE CORPUS ARRIVES (code review 2026-08-07).
   *
   * `announceFor` runs only from `handleQuery`, i.e. only on an input event, and
   * it branches on `status` at call time. So typing before the artifact landed
   * queued "Buscando en el índice del torneo" and NOTHING EVER CORRECTED IT: the
   * fetch resolved, `results` recomputed, the panel visually filled with rows,
   * and the live region still said "still loading". The visible and audible
   * surfaces disagreed, permanently.
   *
   * `es.ts`'s own note on `search.loading` says this ordering is expected on
   * four of the five routes — "the first keystroke can land before the artifact
   * does" — which makes it the common path, not an edge case. The same hole
   * closed the error and invalid transitions.
   */
  useEffect(() => {
    if (previousStatus.current === status) {
      return;
    }
    previousStatus.current = status;
    if (queryRef.current.trim() !== "") {
      announceForRef.current(queryRef.current);
    }
  }, [status]);

  /*
   * 🔴 KEEP THE ACTIVE OPTION IN VIEW (code review 2026-08-07).
   *
   * The panel is `max-h-[60vh] overflow-y-auto` and the sheet is `max-h-dvh`
   * with the same, so ten rows overflow a short viewport — a landscape phone,
   * or any laptop at 200% zoom. And because this is an `aria-activedescendant`
   * combobox, DOM focus NEVER moves to the option, so the browser's own
   * focus-scroll never fires either. Arrowing past the fold moved a highlight
   * the reader could not see.
   *
   * `block: "nearest"` so an option already visible is not yanked to an edge.
   * The optional call is for jsdom, which does not implement `scrollIntoView`.
   */
  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    const option = anchorRefs.current[activeIndex]?.closest('[role="option"]');
    option?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  /**
   * Take the page's single overlay slot, closing whatever else held it.
   *
   * Called from the two openers — typing and ArrowDown — and never from focus.
   * A no-op inside the sheet, where the Dialog already took the slot.
   */
  function claimOverlaySlot(): void {
    if (ownsOverlaySlot) {
      closeOtherOverlays(closeListbox.current);
    }
  }

  function handleQuery(next: string): void {
    setQuery(next);
    // Opens on INPUT — never on focus (ruling 3). An emptied box closes it,
    // rather than leaving an empty panel hanging under the bar.
    const opening = next.trim() !== "";
    if (opening) {
      claimOverlaySlot();
    }
    setOpen(opening);
    setActiveIndex(-1);
    announceFor(next);
  }

  function announceFor(next: string): void {
    const settled = next.trim();
    if (settled === "") {
      onAnnounce("");
      return;
    }
    if (status === "loading") {
      onAnnounce(t("search.loading"));
      return;
    }
    if (status === "error") {
      onAnnounce(t("search.error"));
      return;
    }
    if (status === "invalid") {
      onAnnounce(t("search.invalid"));
      return;
    }
    /*
     * THE TOTAL, not the visible count, so the 10-row cap is never a silent
     * truncation. `countResults` skips span computation, which is what makes
     * counting 1,400 rows on every keystroke cheap.
     */
    const total = countResults(corpus, settled);
    if (total === 0) {
      onAnnounce(noResultsSentence(settled));
      return;
    }
    /*
     * 🔴 WHEN THE CAP BITES, SAY SO (code review 2026-08-07, ruled R2).
     *
     * Announcing the total alone was half a disclosure: a reader told "214
     * resultados" arrowed to option 10 and wrapped, with nothing anywhere in the
     * copy or the markup saying ten was all they would get. `RESULT_LIMIT`'s
     * docblock claimed "the cap is never silent" on the strength of the total —
     * but the total is what makes the cap CONFUSING, not what discloses it.
     *
     * Both numbers, and only when they differ: below the cap the shorter
     * sentence is still the right one, and this is a live region on a control
     * that speaks on every settled keystroke.
     */
    if (total > RESULT_LIMIT) {
      onAnnounce(
        `${t("search.cappedBefore")}${formatInteger(RESULT_LIMIT, locale)}${t(
          "search.cappedMiddle"
        )}${formatInteger(total, locale)}${t("search.cappedAfter")}`
      );
      return;
    }
    onAnnounce(
      `${formatInteger(total, locale)}${COUNT_SEPARATOR}${
        total === 1 ? t("leaderboards.filterResultsOne") : t("leaderboards.filterResults")
      }`
    );
  }
  announceForRef.current = announceFor;

  /*
   * "Sin resultados para «{query}»." — COMPOSED IN A CONST (ruling 7). `t()` has
   * no interpolation, and `react/jsx-no-literals` with `noStrings: true` bans
   * the guillemets as bare JSX text, so the sentence is assembled here and
   * passed through a single expression container.
   */
  function noResultsSentence(settled: string): string {
    return `${t("search.noResultsBefore")}${settled}${t("search.noResultsAfter")}`;
  }

  function move(nextIndex: number): void {
    if (results.length === 0) {
      return;
    }
    const wrapped = (nextIndex + results.length) % results.length;
    setActiveIndex(wrapped);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      /*
       * ONE PRESS, both presentations, and both are trivial BY CONSTRUCTION
       * because focus never left the input:
       *  · inline — closing the listbox is the whole dismissal, and no focus
       *    call is needed, so nothing can re-open it;
       *  · sheet — this handler does nothing at all and the event reaches
       *    Radix's DismissableLayer, which closes the dialog and returns focus
       *    to the icon button.
       */
      if (dismissClosesHost) {
        return;
      }
      /*
       * ONLY CLAIM ESCAPE WHEN THERE IS SOMETHING TO DISMISS (code review
       * 2026-08-07). `preventDefault()` fired unconditionally, so with the
       * listbox already closed it swallowed the native `type="search"`
       * clear-on-Escape the input gets for free, and ate the key before any
       * ancestor handler could see it. An unopened listbox has no dismissal to
       * perform, so the press belongs to the browser.
       */
      if (!isOpen) {
        return;
      }
      event.preventDefault();
      closeListbox.current();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        // ArrowDown opens from closed — the one opener besides typing. With an
        // empty box there is nothing to open, and `isOpen` already encodes that.
        claimOverlaySlot();
        setOpen(true);
        return;
      }
      move(activeIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        return;
      }
      move(activeIndex <= 0 ? results.length - 1 : activeIndex - 1);
      return;
    }
    if (event.key === "Home" && isOpen && results.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && isOpen && results.length > 0) {
      event.preventDefault();
      setActiveIndex(results.length - 1);
      return;
    }
    if (event.key === "Enter" && activeOption !== null) {
      event.preventDefault();
      /*
       * NAVIGATE BY CLICKING THE ANCHOR, never by pushing a route (ruled). The
       * `<Link>` stays load-bearing, so `prefetch={false}` still applies and the
       * row behaves identically to a mouse click — same target, same Next client
       * transition.
       *
       * 🔴 A SYNTHESIZED EVENT CARRYING THE MODIFIERS, NOT `.click()` (code
       * review 2026-08-07). `HTMLElement.click()` dispatches a MouseEvent with
       * every modifier flag false, so Ctrl+Enter and Cmd+Enter — the ordinary
       * "open in a new tab" gesture, and the whole reason ruling 8 insisted
       * these rows be REAL links — were flattened into a same-tab navigation.
       * The comment above used to claim "same modifier handling"; this is what
       * makes that true. Next's Link handler reads these flags and steps aside
       * for the browser's own default when one is set.
       *
       * NOTE FOR THE TESTS: jsdom does not navigate. It logs "Not implemented:
       * navigation to …", which is expected rather than a defect — assert on
       * the resolved `href`, not on a location change.
       */
      const anchor = anchorRefs.current[activeIndex];
      closeListbox.current();
      anchor?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        })
      );
    }
  }

  const label = fieldLabel ?? t("search.label");
  const placeholder = t("search.placeholder");
  /*
   * 🔴 THE LISTBOX KEEPS ITS OWN NAME (code review 2026-08-07). `fieldLabel`
   * named BOTH, so on `/compare` the input and the listbox it owns both announced
   * as "Lado A" — the reader heard the same name twice for two different objects
   * and nothing said which one they had landed on. The field names the SIDE; the
   * listbox names WHAT IT HOLDS, and those are different facts.
   *
   * Two listboxes on that route therefore share one name, which is correct here:
   * `use-glossary-popover.ts`'s page-wide single-open registry means only ever
   * one of them is in the accessibility tree (UX-DR15 forbids the depth-2 stack),
   * so there is nothing for the name to disambiguate against.
   */
  const listLabel = t("search.listLabel");

  return (
    <div ref={fieldRef} className="relative w-full">
      {/*
       * A REAL <label htmlFor>, sr-only rather than visible — a declared
       * departure from `LeaderboardsRegion`'s visible filter label, which this
       * control otherwise copies wholesale (input shape, classes, trim rule,
       * announce debounce). A label line above the input does not fit in the
       * header bar, so the association is identical and only the visual
       * presentation differs.
       *
       * ⚠️ THE ORIGINAL REASON HAS BEEN RE-RULED, and the conclusion survives on
       * a narrower one. This read "the header bar is a fixed h-14 and Task 8.4
       * requires it not to grow". It is no longer fixed: the authorship caption
       * (spec-sign-the-project) took the row to 62 px, and to two rows below
       * ~340 px, with the owner's approval. What did NOT change is that there
       * is no room for a visible label line — the row is already wrapping on
       * small phones, and a label would deepen exactly that. Do not cite "must
       * not grow" as a live constraint; cite the reflow budget instead.
       */}
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        /*
         * THE CONDITIONAL FORM, which four of the seven `aria-controls` sites in
         * this tree already use: pointing at an id that is not in the document
         * is an axe `aria-valid-attr-value` failure, and the listbox only exists
         * while open.
         */
        aria-controls={listboxRendered ? listboxId : undefined}
        aria-activedescendant={
          activeOption === null ? undefined : `${optionIdPrefix}-${activeIndex}`
        }
        value={query}
        autoFocus={autoFocus}
        /*
         * FOCUS ONLY ENGAGES THE FETCH. It does NOT open the listbox — see
         * ruling 3. This is the single most important line in the file for AC 4.
         */
        onFocus={onEngage}
        onChange={(event) => handleQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-md border border-hairline bg-surface-raised px-3 type-body text-ink-primary"
      />

      {isOpen ? (
        <div
          /*
           * The overlay panel's CLASS STRING is `dropdown-menu.tsx`'s, its ROLES
           * are not (ruling 2). `max-w-[calc(100vw-2rem)]` is what makes the
           * 320 px clamp pass; `bg-surface-overlay` is DESIGN.md's `--popover`
           * mapping, scoped "popovers, tooltips, sheets".
           *
           * z-10 matches the one shipped overlay level on these routes. It sits
           * INSIDE the header's own z-40 stacking context, so it paints above the
           * page without needing to outrank the bar that contains it — unlike the
           * sheet, which escapes the header entirely and is ruled z-50.
           */
          className="absolute top-full left-0 z-10 mt-1 flex max-h-[60vh] w-full max-w-[calc(100vw-2rem)] flex-col gap-0.5 overflow-y-auto rounded-sm border border-hairline bg-surface-overlay p-1 shadow-overlay"
        >
          <SearchPanel
            status={status}
            results={results}
            query={needle}
            listboxId={listboxId}
            listLabel={listLabel}
            optionIdPrefix={optionIdPrefix}
            activeIndex={activeIndex}
            anchorRefs={anchorRefs}
            noResultsSentence={noResultsSentence}
            /*
             * Present only in the comparison picker. It CLEARS THE BOX as well as
             * reporting the choice: the picked entity is shown by the comparison
             * itself, and a needle left behind would re-open the same list on the
             * reader's next keystroke over a selection they have already made.
             */
            onSelect={
              onSelect === undefined
                ? undefined
                : (entity) => {
                    onSelect(entity);
                    setQuery("");
                    onAnnounce("");
                  }
            }
            /*
             * A ROW CLICK CLOSES THE PANEL (code review 2026-08-07). Nothing did
             * this: the mouse path was a bare `<Link>` with no handler, and a
             * `next/link` navigation is a SOFT App Router transition in which
             * the header — and therefore this listbox — stays mounted. So the
             * result list sat open over the page it had just navigated to, still
             * showing results for the previous query. The keyboard path is
             * closed in the Enter branch above, for the same reason.
             */
            onActivate={closeListbox.current}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The six render states of the panel, in one place (Task 7.8).
 *
 * The AC names ONE — the empty state. There are six: idle-no-query (the panel
 * does not render at all, handled by `isOpen`), corpus-loading, results,
 * no-results, error and invalid. The last three each carry their OWN keyed
 * message: "we could not load the corpus" and "the corpus has no match for this"
 * are different facts, and the AC's copy asserts the second.
 */
function SearchPanel({
  status,
  results,
  query,
  listboxId,
  listLabel,
  optionIdPrefix,
  activeIndex,
  anchorRefs,
  noResultsSentence,
  onSelect,
  onActivate,
}: {
  status: Status;
  results: readonly SearchResult[];
  query: string;
  listboxId: string;
  listLabel: string;
  optionIdPrefix: string;
  activeIndex: number;
  anchorRefs: React.RefObject<(HTMLElement | null)[]>;
  noResultsSentence: (query: string) => string;
  /** Present ⇒ rows are buttons that CHOOSE, absent ⇒ links that NAVIGATE. */
  onSelect?: (entity: SearchEntity) => void;
  /** Dismiss the panel once a row has been chosen — see the call site. */
  onActivate: () => void;
}) {
  const t = useT();

  if (status === "loading") {
    return <p className="px-2 py-3 type-body text-ink-secondary">{t("search.loading")}</p>;
  }
  if (status === "error") {
    return <p className="px-2 py-3 type-body text-ink-secondary">{t("search.error")}</p>;
  }
  if (status === "invalid") {
    return <p className="px-2 py-3 type-body text-ink-secondary">{t("search.invalid")}</p>;
  }
  if (results.length === 0) {
    /*
     * THE AC's OWN COPY, plus a link to `/` — and it is NOT a listbox: an empty
     * `role="listbox"` with a paragraph inside it is an invalid structure, and
     * `aria-expanded` already tells a reader the panel is showing.
     *
     * 🔴 A DECLARED DEPARTURE FROM THE REUSE MAP'S `EmptyStatePanel` ROW (code
     * review 2026-08-07). The map says "BUILD NONE OF THESE" and every other
     * empty surface in this tree imports it, so the omission needs stating
     * rather than leaving to be rediscovered. `EmptyStatePanel` is a `min-h-32`
     * dashed block with `px-6 py-8` and a two-part headline/explanation
     * structure, sized for a SECTION that is missing from a page. This is a
     * dropdown row inside a `max-h-[60vh]` panel anchored under the header bar
     * (62 px since spec-sign-the-project, 118 when the row wraps);
     * mounting a 128 px-tall dashed placeholder there would push the "/" link
     * off a short viewport and read as a page-level failure rather than "that
     * query matched nothing".
     *
     * The AC also dictates this copy verbatim — "Sin resultados para «{query}»."
     * plus a link to `/` — which is one sentence and one link, not the panel's
     * headline + explanation pair. If a future story needs a shared small-empty
     * shell, THAT is the reuse to build; a second full panel is not.
     */
    return (
      <div className="px-2 py-3">
        <p className="type-body text-ink-primary">{noResultsSentence(query)}</p>
        <Link
          href="/"
          prefetch={false}
          className="mt-1 inline-block type-body text-ink-secondary underline underline-offset-2 hover:no-underline"
        >
          {t("notFound.homeLink")}
        </Link>
      </div>
    );
  }

  return (
    <ul role="listbox" id={listboxId} aria-label={listLabel} className="flex flex-col gap-0.5">
      {results.map((result, index) => (
        <SearchOption
          /*
           * KEYED ON THE HREF, never on the name and never on the index. The
           * real corpus carries `Emiliano MARTINEZ` twice, so a name key would
           * collapse two distinct players; an index key would re-use a DOM node
           * across a keystroke and carry the previous row's anchor ref with it.
           */
          key={result.entity.href}
          result={result}
          optionId={`${optionIdPrefix}-${index}`}
          active={index === activeIndex}
          anchorRef={(node) => {
            anchorRefs.current[index] = node;
          }}
          onSelect={onSelect}
          onActivate={onActivate}
        />
      ))}
    </ul>
  );
}

/** One result row: a real link, its type label, and the matched-substring mark. */
function SearchOption({
  result,
  optionId,
  active,
  anchorRef,
  onSelect,
  onActivate,
}: {
  result: SearchResult;
  optionId: string;
  active: boolean;
  anchorRef: (node: HTMLElement | null) => void;
  onSelect?: (entity: SearchEntity) => void;
  onActivate: () => void;
}) {
  const t = useT();
  const { entity, span } = result;
  const typeLabel = t(entityKindLabelKey(entity.kind));
  const linkPrefix = t(entityKindRowLinkKey(entity.kind));

  /*
   * 🔴 A BUTTON, NOT A SUPPRESSED LINK (Story 2.17 Task 4.1). The comparison
   * picker CHOOSES an entity and stays on `/compare`; rendering that as an
   * `<a href>` with `preventDefault()` would report a link to every assistive
   * technology, put a real URL on the status bar and in the context menu, and
   * open a route the reader did not ask for on Ctrl+click — the exact modifier
   * path the header's Enter handler goes out of its way to PRESERVE, because
   * there navigation is the point.
   *
   * The row's inner markup is identical either way, so the two presentations
   * cannot drift in what they announce.
   */
  const rowClassName = "flex w-full flex-col gap-0.5 rounded-sm px-2 py-2 text-left";
  const rowChildren = (
    <>
      {/* The sr-only prefix, on `hub.*.rowLink`'s idiom, so a screen reader's
          option name leads with the entity type rather than a bare proper noun. */}
      <span className="sr-only">{linkPrefix}</span>
      <span className="type-body text-ink-primary">
        <HighlightedName name={entity.name} span={span} />
      </span>
      <span className="type-label-caps text-ink-secondary">
        {typeLabel}
        {entity.detail === null ? null : DETAIL_JOIN}
        {entity.detail}
      </span>
    </>
  );

  if (onSelect !== undefined) {
    return (
      <li
        id={optionId}
        role="option"
        aria-selected={active}
        className={active ? "rounded-sm bg-surface-raised" : "rounded-sm"}
      >
        <button
          ref={anchorRef}
          type="button"
          /*
           * `tabIndex={-1}` for the same reason the anchor carries it: this is an
           * `aria-activedescendant` combobox, so DOM focus never leaves the input
           * and the options must not be in the tab order.
           */
          tabIndex={-1}
          onClick={() => {
            onSelect(entity);
            onActivate();
          }}
          className={rowClassName}
        >
          {rowChildren}
        </button>
      </li>
    );
  }

  return (
    <li
      id={optionId}
      role="option"
      aria-selected={active}
      /*
       * `aria-selected` on the ACTIVE option, and DOM focus stays in the input
       * (ruling 2 / Task 7.2) — a deliberate, citable divergence from
       * `PitchPanel`'s roving `tabIndex`, and the correct model for a combobox:
       * moving focus into the list would break the input's own `aria-expanded`
       * relationship and stop the reader from typing.
       */
      className={
        active
          ? "rounded-sm bg-surface-raised"
          : "rounded-sm"
      }
    >
      <Link
        ref={anchorRef}
        href={entity.href}
        /*
         * MANDATORY (ruling 8). Story 2.13 MEASURED Next's default prefetch
         * taking `performance.getEntriesByType("resource").length` from 48 to 75
         * across one sort pass — "every <Link> entering the viewport fired a
         * route fetch". A typeahead re-renders its whole link list on EVERY
         * keystroke, which is the worst possible shape for that defect.
         *
         * Disclosed, not filed: `app/src/app/` has no `players/` or `teams/`
         * directory, so with `output: 'export'` every player and team result
         * hard-404s until Stories 2.15 / 2.16. Match results resolve today.
         * Story 2.12's D2 already files this departure for both surfaces.
         */
        prefetch={false}
        tabIndex={-1}
        onClick={onActivate}
        className={rowClassName}
      >
        {rowChildren}
      </Link>
    </li>
  );
}

/** Hoisted: a bare " — " between two expression containers is a JSX literal. */
const DETAIL_JOIN = " — ";

/**
 * The three-slice highlight, on `glossary-marking.tsx`'s pattern.
 *
 * MARKING NEVER WRITES COPY INTO JSX — that file states the rule verbatim, and
 * it is why the name is SLICED rather than reassembled: every child below is an
 * expression container, so `react/jsx-no-literals` never sees a literal.
 *
 * `span === null` is the ruling 6 degrade path: the row still matches and still
 * renders, only the marking drops. It fires when folding the name is not
 * length-preserving — no shipped name triggers it, and throwing there would take
 * the header down on every route for a cosmetic defect.
 *
 * `<mark>` with `bg-transparent`: the UA default is a yellow fill that ignores
 * both themes. The cue is NOT colour alone — the weight changes too (WCAG 1.4.1)
 * — and the substring's position is already conveyed by the row matching at all.
 */
function HighlightedName({ name, span }: { name: string; span: SearchResult["span"] }) {
  if (span === null) {
    return <>{name}</>;
  }
  return (
    <>
      {name.slice(0, span.start)}
      <mark className="bg-transparent font-semibold text-accent-cyan">
        {name.slice(span.start, span.end)}
      </mark>
      {name.slice(span.end)}
    </>
  );
}
