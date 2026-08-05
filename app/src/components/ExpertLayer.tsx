"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MatchBundle } from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import { clockSortValue, type TableColumn } from "@/lib/table-sort";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { anyMinute, anyPlayerName } from "@/viz/defensive-actions-model";
import {
  anyMovementType,
  anyReceivingEvents,
  receivingLogRows,
  type ReceivingLogRow,
} from "@/viz/receiving-log-model";
import {
  FIELD_UNIT,
  IN_POSSESSION_COLUMNS,
  OUT_OF_POSSESSION_FIELDS,
  PHYSICAL_FIELDS,
  buildExpertRows,
  expertFieldKey,
  expertFieldTitleKey,
  type ExpertField,
  type ExpertRow,
  type FieldUnit,
} from "@/viz/expert-model";
import { OFFER_MOVEMENT_PROPERTY, offerMovementKey } from "@/viz/receiving-model";

/*
 * THE EXPERT LAYER (Story 2.11b, FR-23 / UJ-2 / SM-C2). Every Domain G field
 * the bundle carries, per player, both teams — 50 rendered columns over up to
 * 34 rows, with no "lite" variant.
 *
 * A SIBLING OF THE TACTICAL LAYER, NEVER A TWELFTH SectionId (ruled decision
 * 2). `lib/tactical-sections.ts` is untouched: `SectionId` is a closed union of
 * eleven, `sectionDataState`'s default branch carries a `never` exhaustiveness
 * check, and tactical-sections.test.ts already asserts that
 * `sectionDataState(m001, "expert" as SectionId)` THROWS — it literally uses
 * "expert" as its out-of-union id. `TacticalSection` cannot be reused for the
 * same reason (its `id` prop is typed `SectionId`), so the focus/nonce contract
 * below is COPIED from it rather than imported, deliberately.
 *
 * COLLAPSED BY DEFAULT AT EVERY WIDTH (UX-DR6, EXPERIENCE.md:72) — there is no
 * `isLg` branch here, unlike the Tactical Layer, and the content lazy-mounts on
 * expand. That is also the whole performance defence for ~1,700 cells: none of
 * it renders on first load. No skeleton and no `next/dynamic` (decision 15).
 */

/** aria-hidden glyph — a module const, never a bare JSX literal (i18n gate). */
const CHEVRON = "▸";
/** Composed into the head text, so the unit never rides the label (AD-7). */
const UNIT_OPEN = " (";
const UNIT_CLOSE = ")";

/** Composed captions and link hints — a bare " — " in JSX is an i18n-gate error. */
const CAPTION_SEPARATOR = " — ";
const CONTROL_SEPARATOR = " · ";

const SECTION_ID = "expert";
const HEADING_ID = "expert-heading";
const CONTENT_ID = "expert-content";
const SUMMARY_ID = "expert-summary";
const EXPERT_HASH = "#expert";
const LOGS_HEADING_ID = "expert-logs-heading";
const RECEIVING_HEADING_ID = "expert-receiving-heading";

/*
 * THE FULL EVENT LOGS BLOCK (Story 2.11c, AC 1 / UX-DR18).
 *
 * RULING 1 — "the same tables that serve as the viz data-table alternatives"
 * means ONE RENDERED INSTANCE REACHED FROM TWO ENTRY POINTS, not two instances.
 * UX-DR18 assigns this layer "full event logs DOUBLING AS viz alternatives" and
 * EXPERIENCE.md repeats the phrase; "doubling as" is one artifact serving two
 * roles. Removing the viz disclosures was ruled out ON THE SPEC — UX-DR9
 * requires every panel to carry "Ver los datos" opening its equivalent table,
 * and NFR-2/UX-DR16 make that the accessibility floor. So these slots are LINKS.
 *
 * RULING 2 — THEY ARE HONEST ANCHORS, AND THIS FILE BUILDS NO
 * DISCLOSURE-OPENING PLUMBING. A plain anchor does not deliver a reader to a
 * table: every match-page table sits behind a `ViewDataDisclosure` whose `open`
 * is a private `useState(false)` with no prop, no ref and a `useId()` region
 * that is not authorable and does not exist in the DOM while closed;
 * `PitchPanel` forwards only `panelTitle` and `trailing`; `sectionIdFromHash` is
 * whole-string equality against the eleven SectionIds, so a finer fragment
 * resolves to null SILENTLY; and `#shot-maps` is ambiguous, holding two
 * independent disclosures. Real plumbing is ~12 files across every match-page
 * section and inherits the ledgered "an unchanged hash never re-fires
 * hashchange" defect, which is fatal to a link list. So each link STATES where
 * the table is and that "Ver los datos" opens it, and the gap is FILED.
 *
 * SIX ENTRIES, NOT FIVE (ruling 6). AC 1 enumerates five logs; four of them are
 * linked here (the receiving log has no existing home and is rendered below),
 * and Story 2.9's two AGGREGATE surfaces are added as pointers — which is why
 * their labels read "Tabla de ..." rather than "Registro de ...". Cheap to
 * reverse: delete two entries, two locale keys and two test rows.
 *
 * `href` is NOT one of the sixteen gated prop names, so these fragment literals
 * are legal. i18n.test.ts pins every one of them to SECTION_IDS, because
 * `sectionIdFromHash` fails SILENTLY on a typo and nothing else would catch it.
 */
export interface ExpertLogLink {
  /** Stable per-row identity — the `aria-describedby` target's id is built from it. */
  id: string;
  /** The link's own label. NEVER equal to `titleKey`'s value (i18n.test.ts asserts it). */
  labelKey: DictionaryKey;
  /** An in-page fragment; the id part is a member of SECTION_IDS. */
  href: string;
  /** The section the table lives in, composed into the link's description. */
  titleKey: DictionaryKey;
}

export const LOG_LINKS: readonly ExpertLogLink[] = [
  { id: "shot-log", labelKey: "expert.logs.shotLog", href: "#shot-maps", titleKey: "viz.shotMap.title" },
  {
    id: "cross-log",
    labelKey: "expert.logs.crossLog",
    href: "#shot-maps",
    titleKey: "viz.crossMap.title",
  },
  {
    id: "pass-matrix",
    labelKey: "expert.logs.passMatrix",
    href: "#pass-networks",
    titleKey: "viz.passNetwork.title",
  },
  {
    id: "offers",
    labelKey: "expert.logs.offers",
    href: "#offers-to-receive",
    titleKey: "viz.offers.title",
  },
  {
    id: "movement",
    labelKey: "expert.logs.movement",
    href: "#movement-to-receive",
    titleKey: "viz.movement.title",
  },
  {
    id: "defensive",
    labelKey: "expert.logs.defensive",
    href: "#defensive-actions",
    titleKey: "viz.defensiveActions.title",
  },
];

/** The three column groups, in the order the `<md` tabs present them. */
type ColumnGroup = "inPossession" | "outOfPossession" | "physical";

const GROUP_ORDER: readonly ColumnGroup[] = ["inPossession", "outOfPossession", "physical"];

const GROUP_LABEL_KEY: Record<ColumnGroup, DictionaryKey> = {
  inPossession: "expert.group.inPossession",
  outOfPossession: "expert.group.outOfPossession",
  physical: "expert.group.physical",
};

/*
 * THE STICKY COLUMN RUN (ruled decision 5): team + shirt + player, in that
 * order and as a LEFTMOST RUN — sticking `player` alone while `team` and
 * `shirt` scroll underneath it is simply broken. `position` scrolls with the
 * data.
 *
 * Each column needs an EXPLICIT `left`, because a sticky run cannot compute one
 * from its neighbours' class strings. The offsets are the running sum of the
 * widths above them: 0 → 3.5rem → 3.5 + 2.75 = 6.25rem.
 *
 * THE FILL MUST BE OPAQUE, or the scrolled columns show straight through the
 * sticky ones.
 *
 * IT MUST ALSO BE THE SURFACE THIS TABLE ACTUALLY SITS ON, which is
 * --surface-base, NOT --surface-raised (review patch, 2.11b code review). This
 * is the one data block on the match route that is not on a card: the chain is
 * page.tsx's width wrapper -> MatchBundleRegion's bare `mt-layer-gap` div ->
 * this section's `border-t` -> the content div -> the scrollport, and not one
 * of them sets a background, so the backdrop is <body>'s --background, which
 * globals.css defines as --surface-base in both themes. Filling the run with
 * --surface-raised painted #ffffff on #f5f7f8 (light) and #171b1f on #0e1114
 * (dark) — a permanently visible lighter band down the identity columns,
 * whether or not the table was ever scrolled.
 *
 * The head keeps --surface-overlay (ruled decision 8): against --surface-base
 * the head-to-body step is now LARGER than the 1.12/1.14 the story measured
 * against --surface-raised, so the delimiter reads at least as well, and the
 * doubled bottom border is still the carrier.
 *
 * `headClass: z-30` is the top of the ladder (Task 1.4): body sticky cells sit
 * at z-10, header cells at z-20, and the CORNER cells — header AND sticky
 * column — must beat both or the body's sticky cells paint over them on a
 * diagonal scroll, because equal z-index resolves to later-in-DOM and <tbody>
 * is later than <thead>. `bg-surface-overlay` is repeated here because
 * tailwind-merge resolves the fill to the LAST class that sets it, and
 * `cellClass`'s --surface-raised would otherwise win in the corner.
 */
/*
 * MEASURED DEPARTURE from the story's ruled widths (3.5 / 2.75 / 6.25rem),
 * taken because those numbers do not survive contact with the layout and their
 * failure is SILENT — the columns still stick, at the wrong offsets.
 *
 * A `left` offset is absolute, but under AUTO table layout `width` on a cell is
 * only a SUGGESTION — the algorithm is free to land on the column's max-content
 * instead, in EITHER direction. Measured in Chrome at the shipped type scale,
 * the three heads want 79 / 82 / 141px: at the story's widths the run rendered
 * 161px wide while `player` was pinned at 100px (each sticky column overlapping
 * and clipping the head before it), and at widths chosen to clear them, `w-88`
 * still rendered 82 and opened a 6px gap for scrolled data to slide through.
 *
 * `min-width` DOES bind on a table cell in Chrome (verified: a cell whose
 * max-content is 82px renders at exactly 88px under min-w-[5.5rem]), so the run
 * is declared with `min-w-*` and every value clears the widest of the two
 * locales' head text. That is what makes declared == used, and the offsets
 * exact: 0 -> 5.5rem -> 11rem with the team column, 0 -> 5.5rem without it.
 *
 * The 141px was the `player` column and had a second cause worth naming:
 * `truncate` includes `white-space: nowrap`, which makes a cell's min-content
 * the WHOLE name — so inside a table it does not truncate at all, it WIDENS the
 * column. Truncation has to happen in a fixed-width block INSIDE the cell,
 * hence PLAYER_TRUNCATE. Its width is the cell's minus `px-2`, because Tailwind
 * preflight sets `box-sizing: border-box`: 6rem + 0.5rem = 7rem.
 *
 * THE OFFSETS ARE PER-LAYOUT, not responsive variants of one class: below md
 * the `team` column is not rendered at all (see the escape hatch), so `shirt`
 * becomes the leftmost column and must pin at 0, not at 5.5rem. A `md:left-*`
 * pair would be wrong in exactly the half of the story that needs it most.
 */
const STICKY_CORNER = "z-30 bg-surface-overlay";
const STICKY_TEAM = "sticky left-0 z-10 min-w-[5.5rem] bg-surface-base";
const STICKY_SHIRT_WIDE = "sticky left-[5.5rem] z-10 min-w-[5.5rem] bg-surface-base";
const STICKY_SHIRT_NARROW = "sticky left-0 z-10 min-w-[5.5rem] bg-surface-base";
const STICKY_PLAYER_WIDE = "sticky left-[11rem] z-10 min-w-[12rem] bg-surface-base";
const STICKY_PLAYER_NARROW = "sticky left-[5.5rem] z-10 min-w-[7rem] bg-surface-base";
const PLAYER_TRUNCATE_WIDE = "block w-[11rem] truncate";
const PLAYER_TRUNCATE_NARROW = "block w-[6rem] truncate";

/*
 * THE SCROLLPORT'S OWN CLASSES (review patch, 2.11b code review).
 *
 * `tabIndex={0}` is not decoration: 34 rows against a 70vh cap overflows, every
 * focusable descendant is a header button pinned at `top: 0`, and DataTable
 * records that NO body-row content in any table is focusable — so before this,
 * tabbing could never scroll the container vertically and the rows below the
 * fold were unreachable by keyboard entirely (WCAG 2.1.1). Chrome's
 * keyboard-focusable-scrollers behaviour does not rescue it, because that
 * explicitly excludes scrollers containing focusable children, which this one
 * has 46 of.
 *
 * BOTH AXES NEED SCROLL PADDING, and only the vertical one had it.
 * `scroll-pl-*` is the horizontal counterpart: tabbing BACKWARDS through the
 * header buttons aligns the focused element to the scrollport's LEFT edge,
 * which is exactly where the opaque sticky run sits — and the run's head cells
 * are z-30 against a data head's z-20, so the focused control was painted over
 * while it held focus (WCAG 2.4.11). The values are the run's own width: 5.5 +
 * 7rem below md, 5.5 + 5.5 + 12rem at >=md.
 *
 * `scroll-pt-[46px]` replaces `scroll-pt-11`: the sticky header is MIN_HIT_PX
 * (44) PLUS the `border-b-2` DataTable's sticky mode adds, and AC 2's wording
 * is "equal to the sticky-header height".
 */
const SCROLLPORT =
  "max-h-[70vh] overflow-auto scroll-pt-[46px] scroll-pl-[12.5rem] md:scroll-pl-[23rem]";

export function ExpertLayer({ bundle }: { bundle: MatchBundle }) {
  /*
   * TAKES THE WHOLE BUNDLE — a DECLARED EXCEPTION to the house rule that props
   * are narrow and explicit (Story 2.5 Task 5.1), stated here as decision 14
   * requires. It genuinely needs `players` AND `metadata`: Domain G's
   * `PlayerRecord` carries a `teamId` and no team code, so the code every row
   * displays can only come from the metadata's two TeamRefs.
   *
   * Story 2.11c reads `events.receiving` through the same prop — exactly ONE of
   * the seven slices `EventTables` declares (shots, shootoutAttempts, crosses,
   * passNetworkNodes, passNetworkEdges, receiving, defensiveActions). The other
   * six are rendered by the Tactical sections and are only LINKED from here.
   */
  const t = useT();
  const { locale } = useLocale();
  const isMd = useMediaQuery(MD_MEDIA_QUERY);

  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<ColumnGroup>("inPossession");
  /** Increments when focus should move to the heading; 0 = never (mount). */
  const [focusNonce, setFocusNonce] = useState(0);
  const [focusScroll, setFocusScroll] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /*
   * ITS OWN HASH LISTENER. `TacticalLayer`'s `sectionIdFromHash` returns null
   * for "#expert" BY DESIGN — do not extend it; that function is keyed on the
   * eleven-member registry this layer is deliberately not in.
   *
   * The MOUNT-TIME READ is load-bearing, not belt-and-braces: this layer is
   * client-only under AR-11 and mounts inside MatchBundleRegion's loaded
   * branch, so the browser has already abandoned a "#expert" deep link by the
   * time the target exists. The subscription then serves in-page anchor
   * navigation.
   */
  useEffect(() => {
    function openFromHash() {
      if (window.location.hash !== EXPERT_HASH) {
        return;
      }
      setOpen(true);
      setFocusScroll(true);
      setFocusNonce((previous) => previous + 1);
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  /*
   * Copied from TacticalSection.tsx:86-97 rather than imported (decision 2).
   * Driven by an explicit nonce rather than by `open`, so it fires on a user
   * toggle and on anchor auto-expand and NEVER on the initial render.
   * `preventScroll` only when scrollIntoView already positioned the section —
   * the browser's own focus scroll would otherwise pull the heading off the top
   * of the viewport.
   */
  useEffect(() => {
    if (focusNonce === 0) {
      return;
    }
    if (focusScroll) {
      sectionRef.current?.scrollIntoView();
    }
    headingRef.current?.focus({ preventScroll: focusScroll });
  }, [focusNonce, focusScroll]);

  function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      // Focus moves into what was revealed; closing leaves it on the trigger.
      setFocusScroll(false);
      setFocusNonce((previous) => previous + 1);
    }
  }

  /*
   * ROWS ARE BUILT EAGERLY, outside the lazily-mounted content
   * (ShotMapsSection's precedent): a player whose teamId matches neither side
   * throws from `resolveSide` NAMING the id, on load rather than on expand, and
   * the sibling TacticalErrorBoundary contains it. A silent drop is the class
   * of finding prior reviews flagged on groupScorers and composeMatchTitle.
   */
  /*
   * REVIEW PATCH (2.11b code review): MEMOISED ON THE BUNDLE. The build was
   * unguarded, and this section is collapsed by default at every width — so
   * 34 x 46 field reads were paid on every MatchBundleRegion re-render, for
   * output nobody had asked to see. `useMemo` keyed on `bundle` preserves the
   * eager fail-loud property the comment above defends exactly: the throw still
   * happens during the same render, on load rather than on expand, and the
   * sibling boundary still contains it.
   *
   * The 50 column objects below are deliberately NOT memoised. They close over
   * `t` and `locale` and must rebuild when either changes — that is what makes
   * a sorted text column re-collate under the EN toggle — and 50 object
   * literals is not the cost that mattered here.
   */
  const rows = useMemo(() => buildExpertRows(bundle), [bundle]);

  /*
   * THE RECEIVING LOG'S ROWS, built eagerly on the same terms: a stray `teamId`
   * or a non-finite coordinate throws from the model NAMING itself, during this
   * render, inside the sibling error boundary — never lazily from inside the
   * table, which is the defect 2.9's review found.
   *
   * THE TWO `LogSide` OBJECTS ARE BUILT INSIDE THE CALLBACK, and that is not
   * style. This component has no `home`/`away` — its only side data is
   * `sideCodes`, two uppercased strings with no `teamId`, while `resolveSide`
   * matches on `teamId` and throws otherwise. Every other consumer receives
   * `LogSide` as a prop from `TacticalLayer`; there is no such hand-off here.
   * Hoisting the two literals above the memo and leaving `[bundle]` is a
   * `react-hooks/exhaustive-deps` WARNING, and `npm run lint` is
   * `eslint . --max-warnings 0` and is step 1 of `npm run build` — so it fails
   * the BUILD. Putting them in the dependency array instead defeats the memo
   * outright, because a fresh object literal is a new identity every render:
   * precisely the defect 2.11b's review patched on `buildExpertRows`.
   *
   * `.toUpperCase()` is required — `ExpertRow.teamCode` is uppercased by the
   * model, and the two tables on this layer must agree.
   */
  const receivingRows = useMemo(
    () =>
      receivingLogRows(
        bundle.events.receiving,
        {
          teamId: bundle.metadata.homeTeam.teamId,
          teamCode: bundle.metadata.homeTeam.teamCode.toUpperCase(),
        },
        {
          teamId: bundle.metadata.awayTeam.teamId,
          teamCode: bundle.metadata.awayTeam.teamCode.toUpperCase(),
        }
      ),
    [bundle]
  );

  function formatValue(value: number, unit: FieldUnit): string {
    /*
     * Driven off the FIELD LISTS, never off inspection: Count, Percentage,
     * Metres and KmPerHour all erase to `number`, so the compiler cannot catch
     * a mix-up here and nothing on screen would look wrong.
     *
     * The two percentages are STORED and rendered as stored (AD-5) — never
     * recomputed from attempted/completed.
     */
    if (unit === "percentage") {
      return formatPercent(value, locale, 1);
    }
    if (unit === "count") {
      return formatInteger(value, locale);
    }
    if (unit === "metres" || unit === "kmh") {
      return formatDecimal(value, locale, 1);
    }
    /*
     * REVIEW PATCH (2.11b code review): both this and `unitSuffix` ended in an
     * unguarded fallthrough, so a fifth FieldUnit member would silently format
     * as a one-decimal number and render with no unit in its head — the
     * compiler would not flag it and nothing on screen would look wrong.
     * `sectionDataState`'s `never` check is the house precedent.
     */
    const unexpected: never = unit;
    throw new Error(`Unhandled FieldUnit: ${String(unexpected)}`);
  }

  function unitSuffix(unit: FieldUnit): string {
    if (unit === "metres") {
      return `${UNIT_OPEN}${t("enums.unit.m")}${UNIT_CLOSE}`;
    }
    if (unit === "kmh") {
      return `${UNIT_OPEN}${t("enums.unit.kmh")}${UNIT_CLOSE}`;
    }
    // Count and percentage carry no suffix — the unit rides the head, and
    // neither has one. Exhaustive by the same `never` discipline as above.
    if (unit === "count" || unit === "percentage") {
      return "";
    }
    const unexpected: never = unit;
    throw new Error(`Unhandled FieldUnit: ${String(unexpected)}`);
  }

  /** One keyed Domain G column. The unit rides the HEAD, never the cell. */
  function dataColumn(field: ExpertField, read: (row: ExpertRow) => number): TableColumn<ExpertRow> {
    const unit = FIELD_UNIT[field];
    const titleKey = expertFieldTitleKey(field);
    return {
      key: field,
      headText: `${t(expertFieldKey(field))}${unitSuffix(unit)}`,
      headTitle: titleKey === null ? null : t(titleKey),
      /*
       * NO PRESENCE GATE AND NO EM DASH, ever. Domain G has zero nullable
       * leaves — not one `?` or `| null` inside PlayerRecord or its sub-blocks
       * — so absence is unreachable here by construction and a zero is a real,
       * dense measurement (`goals` is 0 on 90 of 96 fixture rows). Print it.
       */
      render: (row) => formatValue(read(row), unit),
      align: "numeric",
      // The RAW numeric, never the formatted string: "1.234" collates before
      // "9" and a thousands separator would make the order nonsense.
      sort: { kind: "number", valueOf: read },
    };
  }

  /**
   * One of the six `offersByMovementType` columns. They reuse the shipped
   * `enums.offerMovement` labels through `OFFER_MOVEMENT_PROPERTY` rather than
   * minting a seventh set — i18n.test.ts pins that namespace's key set to
   * `OFFER_MOVEMENT_TYPES` exactly, so a duplicate here would turn it red.
   */
  function movementColumn(code: Parameters<typeof offerMovementKey>[0]): TableColumn<ExpertRow> {
    const property = OFFER_MOVEMENT_PROPERTY[code];
    const read = (row: ExpertRow) => row.inPossession.offersByMovementType[property];
    return {
      key: `movement-${code}`,
      headText: t(offerMovementKey(code)),
      headTitle: null,
      render: (row) => formatInteger(read(row), locale),
      align: "numeric",
      sort: { kind: "number", valueOf: read },
    };
  }

  /*
   * THE `<md` ESCAPE HATCH — TAKEN, on the measurement Task 5.4 demanded
   * rather than pre-emptively.
   *
   * MEASURED at a 390px viewport: the scrollport is 345px and the three-column
   * sticky run renders 289px of it (79 + 82 + 128), leaving 55.7px — LESS THAN
   * ONE data column, since the Spanish heads run 102-126px wide. The table
   * would open showing identity columns and no data at all until the reader
   * scrolled sideways.
   *
   * So below md the `team` COLUMN is replaced by a team SELECTOR (the exact
   * PitchPanel precedent), which returns ~88px and filters the rows to one
   * side: run 200px, ~145px of data, one full column visible on open. Density
   * moves behind a control, never deleted (SM-C2) — every field and every
   * player stays reachable, and at >=md nothing changes: all 34 rows, all 50
   * columns, one table.
   */
  const sideCodes = [
    bundle.metadata.homeTeam.teamCode.toUpperCase(),
    bundle.metadata.awayTeam.teamCode.toUpperCase(),
  ];
  /*
   * SEEDED FROM THE ROWS, not unconditionally from the home code (review patch,
   * 2.11b code review). A Domain G page carrying only the away team's records
   * is contract-legal, and the old seed opened the narrow layout on a side with
   * nothing in it — both pills lit, an empty table, and no hint that the other
   * pill has the data. `rows[0]` is the artifact's own first row, so on a
   * complete bundle this still resolves to the home side.
   */
  const [side, setSide] = useState(rows[0]?.teamCode ?? sideCodes[0]);
  const visibleRows = isMd ? rows : rows.filter((row) => row.teamCode === side);

  const teamColumn: TableColumn<ExpertRow> = {
    key: "team",
    headText: t("viz.table.team"),
    headTitle: null,
    // The resolved team CODE, uppercased by the model — never a translated
    // team name, which would not fit the run and is not what the row is keyed
    // on.
    render: (row) => row.teamCode,
    align: "text",
    sort: { kind: "text", valueOf: (row) => row.teamCode },
    cellClass: STICKY_TEAM,
    headClass: STICKY_CORNER,
  };

  const identityColumns: TableColumn<ExpertRow>[] = [
    // Below md the rows are one team's already, so the column would repeat the
    // selector's answer on all 17 of them.
    ...(isMd ? [teamColumn] : []),
    {
      key: "shirt",
      headText: t("viz.table.shirt"),
      headTitle: null,
      render: (row) => formatInteger(row.shirtNumber, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.shirtNumber },
      cellClass: isMd ? STICKY_SHIRT_WIDE : STICKY_SHIRT_NARROW,
      headClass: STICKY_CORNER,
    },
    {
      key: "player",
      headText: t("viz.table.player"),
      headTitle: null,
      /*
       * `title` carries the full name for the truncated `<md` case. It is a
       * GATED prop name, but `row.playerName` is a VARIABLE — the gate bans
       * literals and template literals, so this passes it honestly.
       *
       * Plain text, never a link (decision 12): UX-DR22's cross-link rule is
       * scoped to LINEUP names, and /players/{slug} ships in Story 2.15.
       */
      render: (row) => (
        <span
          title={row.playerName}
          className={isMd ? PLAYER_TRUNCATE_WIDE : PLAYER_TRUNCATE_NARROW}
        >
          {row.playerName}
        </span>
      ),
      align: "text",
      // The one <th scope="row"> per row — this makes 2.11b the first consumer
      // of `rowHeader`, which shipped in 2.11a without one.
      rowHeader: true,
      sort: { kind: "text", valueOf: (row) => row.playerName },
      cellClass: isMd ? STICKY_PLAYER_WIDE : STICKY_PLAYER_NARROW,
      headClass: STICKY_CORNER,
    },
    {
      key: "position",
      headText: t("viz.table.position"),
      headTitle: null,
      // A template literal into t(), no cast needed (LineupsDisclosure's
      // precedent) — `Position` is a four-member union, so tsc checks it.
      render: (row) => t(`enums.position.${row.position}`),
      align: "text",
      // The RESOLVED label, so the order follows the EN toggle.
      sort: { kind: "text", valueOf: (row) => t(`enums.position.${row.position}`) },
    },
  ];

  const groupColumns: Record<ColumnGroup, TableColumn<ExpertRow>[]> = {
    inPossession: IN_POSSESSION_COLUMNS.map((column) =>
      column.kind === "movement"
        ? movementColumn(column.code)
        : dataColumn(column.field, (row) => row.inPossession[column.field])
    ),
    outOfPossession: OUT_OF_POSSESSION_FIELDS.map((field) =>
      dataColumn(field, (row) => row.outOfPossession[field])
    ),
    physical: PHYSICAL_FIELDS.map((field) => dataColumn(field, (row) => row.physical[field])),
  };

  /*
   * ONE <DataTable> INSTANCE serves both layouts (EXPERIENCE.md:133). At >=md
   * all three groups are concatenated — 46 data + 4 identity = 50 columns, with
   * horizontal scroll inside the container; below md the ToggleGroup selects
   * one group (16 / 15 / 9). Rows are always every player of both teams.
   */
  const dataColumns = isMd
    ? [...groupColumns.inPossession, ...groupColumns.outOfPossession, ...groupColumns.physical]
    : groupColumns[group];
  const columns = [...identityColumns, ...dataColumns];

  /*
   * `players: null` is the report-does-not-carry-Domain-G state (decision 10).
   * `[]` is NOT this state — it is ready, with zero rows.
   *
   * Both halves are HOISTED TO PLAIN IDENTIFIERS: a ternary inside `headline=`
   * or `explanation=` trips the i18n gate, which reaches into conditional
   * expressions inside a gated prop (TacticalLayer.tsx records this).
   */
  const isAbsent = bundle.players === null;
  const emptyHeadline = t("expert.empty.headline");
  const emptyExplanation = t("expert.empty.explanation");
  /*
   * REVIEW PATCH (2.11b code review). `[]` used to fall through `isAbsent` and
   * render 50 sortable headers over an empty <tbody> with no explanation at
   * all — and `[]` is not hypothetical: match-bundle.schema.json states
   * verbatim that "Empty array and null are distinct states", and PlayerRecords
   * carries no `minItems`. Gating on the VISIBLE row count catches that plus
   * the two narrow-layout routes to the same blank table (a one-team Domain G
   * page, and the reader selecting the side that has no rows), with one branch
   * and one honest string — `expert.empty.*` says the report does not carry the
   * pages, which is false in all three cases.
   */
  const hasNoRows = visibleRows.length === 0;
  const emptyRowsHeadline = t("expert.emptyRows.headline");
  const emptyRowsExplanation = t("expert.emptyRows.explanation");
  const tableName = t("expert.tableName");

  /*
   * THE RECEIVING LOG'S GATES — the whole log first, then three columns.
   *
   * `showReceiving` is FD-1 applied to an entire table (ruled decision 4): it is
   * true on all three fixtures (270 events) and false on corpus data, where
   * `events.receiving` is null, so AC 1's fifth log satisfies itself by
   * construction with no waiver. The three column gates are the shipped
   * `DefensiveActionsSection` idiom — a spread-empty-array conditional, never a
   * column of em dashes.
   *
   * `anyPlayerName` and `anyMinute` are IMPORTED from defensive-actions-model
   * rather than re-derived: both are declared with structural parameters, so
   * they accept `ReceivingLogRow[]` unmodified. That cross-family import is
   * filed as a lift candidate, not lifted here.
   */
  const showReceiving = anyReceivingEvents(bundle.events.receiving);
  const showPlayer = anyPlayerName(receivingRows);
  const showMinute = anyMinute(receivingRows);
  const showMovementType = anyMovementType(receivingRows);
  const unknown = t("viz.table.unknown");

  /*
   * Every `key` is a stable string and never an index — a closing gate shifts
   * every later column by one, which is exactly what `TableColumn.key` is
   * declared for.
   */
  const receivingColumns: TableColumn<ReceivingLogRow>[] = [
    {
      key: "team",
      headText: t("viz.table.team"),
      headTitle: null,
      render: (row) => row.teamCode,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.teamCode },
    },
    ...(showPlayer
      ? [
          {
            key: "player",
            headText: t("viz.table.player"),
            headTitle: null,
            // Plain text, never a link (ruling 8): UX-DR22's cross-link rule is
            // scoped to LINEUP names, and /players/{slug} ships in Story 2.15.
            render: (row: ReceivingLogRow) => row.playerName ?? unknown,
            align: "text" as const,
            // The RAW null, not the em dash, so an unnamed player sorts to the
            // array END in both directions.
            sort: { kind: "text" as const, valueOf: (row: ReceivingLogRow) => row.playerName },
          },
        ]
      : []),
    ...(showMinute
      ? [
          {
            key: "minute",
            headText: t("viz.table.minute"),
            headTitle: null,
            render: (row: ReceivingLogRow) => row.minuteLabel ?? unknown,
            align: "numeric" as const,
            sort: {
              kind: "number" as const,
              // NEVER the "45+2′" string, which collates after "9′".
              valueOf: (row: ReceivingLogRow) => clockSortValue(row.minute, row.stoppageMinute),
            },
          },
        ]
      : []),
    {
      key: "x",
      headText: t("viz.table.x"),
      headTitle: null,
      // Two decimals, matching the schema's `x-decimals: 2` and all three
      // shipped logs.
      render: (row) => formatDecimal(row.x, locale, 2),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.x },
    },
    {
      key: "y",
      headText: t("viz.table.y"),
      headTitle: null,
      render: (row) => formatDecimal(row.y, locale, 2),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.y },
    },
    {
      key: "eventType",
      headText: t("viz.table.eventType"),
      headTitle: null,
      /*
       * THE DISCRIMINATOR (ruling 3). The log merges the two surfaces that
       * share one array, so without this column a reader cannot tell an offer
       * row from a movement row on any of the 270 — the table would be actively
       * misleading. Note the knowing near-collision it creates with the column
       * beside it: a row can read "Desmarque" here and "Sin desmarque" there,
       * which is what the source data says.
       */
      render: (row) => t(row.eventTypeKey),
      align: "text",
      // The RESOLVED label, so the order follows the EN toggle. Sorting on the
      // raw key would order by "enums.receivingEventType.movement".
      sort: { kind: "text", valueOf: (row) => t(row.eventTypeKey) },
    },
    ...(showMovementType
      ? [
          {
            key: "movementType",
            headText: t("viz.table.movementType"),
            headTitle: null,
            // A t() on a null key throws — `movementType` is the contract's one
            // nullable field on this event.
            render: (row: ReceivingLogRow) =>
              row.movementTypeKey === null ? unknown : t(row.movementTypeKey),
            align: "text" as const,
            sort: {
              kind: "text" as const,
              valueOf: (row: ReceivingLogRow) =>
                row.movementTypeKey === null ? null : t(row.movementTypeKey),
            },
          },
        ]
      : []),
  ];

  /*
   * COMPOSED, never bare (AC 3). `expert.tableCaption` is already the one
   * unprefixed caption on the page; a second one would give this layer two
   * captions that both open "Ordenado por…" and neither names its table. And
   * NOT `viz.table.caption` — three tables already resolve that exact string.
   */
  const receivingCaption = `${t("expert.logs.receivingHeading")}${CAPTION_SEPARATOR}${t(
    "expert.logs.receivingOrder"
  )}`;
  const receivingTableName = t("expert.logs.receivingName");
  const logsHeading = t("expert.logs.heading");
  const receivingHeading = t("expert.logs.receivingHeading");

  return (
    <section
      ref={sectionRef}
      id={SECTION_ID}
      aria-labelledby={HEADING_ID}
      className="mt-layer-gap border-t border-hairline pt-5"
    >
      {/*
       * The EXPERTO pill sits ABOVE the heading row, not inline — the mockup's
       * `.pill-expert` is a block-level lead-in with its own 10px gap.
       * --ink-secondary on --surface-overlay measures 7.03 dark / 6.65 light.
       */}
      <span className="mb-2.5 inline-block rounded-full bg-surface-overlay px-3 py-1 type-label-caps text-ink-secondary">
        {t("expert.pill")}
      </span>
      <h2 ref={headingRef} id={HEADING_ID} tabIndex={-1} className="type-headline text-ink-primary">
        {/*
         * A real <button>, not the mockup's `role="button"` <div> — the same
         * ruled departure TacticalSection records (its decision 6). min-h-11
         * is on the trigger ITSELF, not a wrapper.
         *
         * aria-controls is CONDITIONAL because the content lazy-mounts: a
         * static one would point at an absent id in the collapsed state, which
         * is the default at every width here.
         */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? CONTENT_ID : undefined}
          aria-describedby={SUMMARY_ID}
          onClick={toggle}
          className="flex min-h-11 w-full items-center justify-between gap-tile-gap text-left"
        >
          {t("expert.heading")}
          <span
            aria-hidden="true"
            className={cn("type-body text-ink-secondary", open && "rotate-90")}
          >
            {CHEVRON}
          </span>
        </button>
      </h2>
      {/* A <div>, never a <p>: Story 2.18's nesting ruling on the same slot. */}
      <div id={SUMMARY_ID} className="mt-1 type-body text-ink-secondary">
        {t("expert.summary")}
      </div>

      {open ? (
        <div id={CONTENT_ID} className="mt-4">
          {isAbsent ? (
            <EmptyStatePanel headline={emptyHeadline} explanation={emptyExplanation} />
          ) : (
            <>
              {isMd ? null : (
                <ToggleGroup
                  type="single"
                  value={side}
                  onValueChange={(value) => {
                    // Radix reports "" when the active segment is re-clicked;
                    // the active team must not be deselectable.
                    if (value !== "") {
                      setSide(value);
                    }
                  }}
                  aria-label={t("viz.teamSelector")}
                  className="mb-tile-gap rounded-full border border-hairline p-0.5"
                >
                  {sideCodes.map((code) => (
                    <ToggleGroupItem
                      key={code}
                      value={code}
                      className="min-h-11 min-w-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
                    >
                      {code}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
              {isMd ? null : (
                <ToggleGroup
                  type="single"
                  value={group}
                  onValueChange={(value) => {
                    // Radix reports "" when the active segment is re-clicked;
                    // the active group must not be deselectable.
                    if (value !== "") {
                      setGroup(value as ColumnGroup);
                    }
                  }}
                  aria-label={t("expert.group.label")}
                  className="mb-tile-gap rounded-full border border-hairline p-0.5"
                >
                  {GROUP_ORDER.map((candidate) => (
                    <ToggleGroupItem
                      key={candidate}
                      value={candidate}
                      className="min-h-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
                    >
                      {t(GROUP_LABEL_KEY[candidate])}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
              {/*
               * THE BOUNDED SCROLLPORT, and the reason AC 2 is reachable at
               * all. `DataTable` renders no scroll container and must not: the
               * sticky header resolves against its NEAREST SCROLLING ANCESTOR,
               * and 2.11a's declared departure was precisely a sticky rule
               * inside a height-UNBOUNDED ancestor, which computed correctly
               * and silently did nothing.
               *
               * Its classes, and why both scroll-padding axes are needed, are
               * on SCROLLPORT at the top of this file.
               *
               * These tables are PRIMARY content and deliberately NOT behind a
               * "Ver los datos" disclosure (decision 9) — the layer is already
               * collapsed by default, and a disclosure would put them two taps
               * deep.
               */}
              {hasNoRows ? (
                // The two ToggleGroups stay mounted above this, so the
                // reader-selected-empty-side case is one tap from recovery.
                <EmptyStatePanel
                  headline={emptyRowsHeadline}
                  explanation={emptyRowsExplanation}
                />
              ) : (
                <div
                  /*
                   * FOCUSABLE AND NAMED (review patch): a bounded scroll
                   * container whose only focusable descendants are pinned at
                   * `top: 0` cannot otherwise be scrolled by keyboard at all.
                   * `role="region"` + a name is the standard pairing — an
                   * unnamed tab stop is its own defect. The region wraps the
                   * table rather than sitting inside it, so 2.11a's "zero
                   * landmark regions INSIDE any table" rule is untouched.
                   */
                  tabIndex={0}
                  role="region"
                  aria-label={tableName}
                  className={SCROLLPORT}
                >
                  <DataTable
                    /*
                     * KEYED ON THE COLUMN SET (review patch). Switching the
                     * `<md` group tab, or crossing the md breakpoint, removes
                     * the active sort column — and `sortRows` then falls back
                     * to artifact order while `sortState` lives on inside
                     * DataTable. The rows visibly re-ordered with no
                     * announcement, every `aria-sort` reverted to "none", and
                     * the sort silently RE-APPLIED itself the moment the reader
                     * came back. Remounting resets the sort honestly: artifact
                     * order, consistent `aria-sort`, and a caption that matches
                     * what is on screen. `side` is deliberately absent from the
                     * key — a team switch does not change the columns, so a
                     * sort should survive it.
                     */
                    key={`${isMd ? "wide" : "narrow"}-${group}`}
                    caption={t("expert.tableCaption")}
                    columns={columns}
                    rows={visibleRows}
                    // The card, never the pitch. Getting this backwards is the
                    // defect Story 2.7's review headlined.
                    surface="canvas"
                    sticky
                    tableName={tableName}
                  />
                </div>
              )}
            </>
          )}
          {/*
           * THE LOGS BLOCK IS A SIBLING OF THE `isAbsent` TERNARY, never inside
           * its false branch. `isAbsent` is `bundle.players === null` — the
           * report-does-not-carry-DOMAIN-G state — and nothing below reads
           * `players` at all. A bundle with `players: null` and a populated
           * `events.receiving` is contract-legal, so nesting this would hide six
           * links and an 87-row table behind an absence that has nothing to do
           * with them, under a summary that has just claimed "y registros
           * completos". `hasNoRows` does not gate it either: that flag is about
           * the Domain G table's visible rows.
           *
           * HEADING LEVELS: h2 (the layer) -> h3 (this block) -> h4 (the
           * receiving log). An <h2> here would sit as a sibling of the layer
           * title and break the outline.
           */}
          <div className="mt-layer-gap">
            <h3 id={LOGS_HEADING_ID} className="type-title text-ink-primary">
              {logsHeading}
            </h3>
            <ul
              aria-labelledby={LOGS_HEADING_ID}
              className="mt-tile-gap flex flex-col gap-1"
            >
              {LOG_LINKS.map((link) => {
                const hintId = `expert-log-hint-${link.id}`;
                /*
                 * THE HINT MUST REACH THE ACCESSIBLE NAME, and a bare adjacent
                 * <span> does not: a screen-reader user in links-list mode would
                 * get six anchors naming neither location nor control, which is
                 * the exact failure ruling 2 exists to avoid and would make AC 1
                 * false for the readers AC 1 is for. `aria-describedby` is not
                 * one of the sixteen gated prop names, so an id-valued
                 * expression is legal; `aria-label` is gated AND would REPLACE
                 * the link text rather than extend it.
                 *
                 * `viz.viewData` is reused rather than paraphrased — it is the
                 * exact visible string on every one of those controls, so a
                 * paraphrase could drift out of sync with the button.
                 */
                const hint = `${t(link.titleKey)}${CONTROL_SEPARATOR}${t("viz.viewData")}`;
                return (
                  <li key={link.id} className="flex flex-wrap items-center gap-x-2">
                    {/*
                     * A PLAIN <a>, following the only other in-page anchor in
                     * app/src (SiteHeader's skip link): not next/link, no
                     * onClick, no preventDefault, no focus() call. Fragment
                     * navigation is the browser's; globals.css's
                     * `scroll-padding-top: 4.5rem` already clears the sticky
                     * header, and TacticalLayer's hashchange listener already
                     * auto-expands the target section below lg.
                     */}
                    <a
                      href={link.href}
                      aria-describedby={hintId}
                      className="inline-flex min-h-11 items-center type-body text-accent-cyan hover:underline"
                    >
                      {t(link.labelKey)}
                    </a>
                    <span id={hintId} className="type-caption text-ink-secondary">
                      {hint}
                    </span>
                  </li>
                );
              })}
            </ul>
            {/*
             * THE RECEIVING LOG — AC 1's fifth log, the one with no existing
             * home. It is NOT an <li>: the list holds only the six anchors, and
             * nesting an 87-row table inside a labelled list item would make the
             * list unreadable to a screen reader enumerating it.
             *
             * Absent entirely when the gate closes (FD-1) — no em dash, no empty
             * panel. The six links stay unconditional: the sections they point
             * at own their own empty states, and a link to an empty section is
             * still a true statement about where that data lives.
             */}
            {showReceiving ? (
              <>
                <h4
                  id={RECEIVING_HEADING_ID}
                  className="mt-tile-gap type-stat-label text-ink-secondary"
                >
                  {receivingHeading}
                </h4>
                {/*
                 * WRAPPED, and the wrapper is load-bearing. `DataTable` renders
                 * no scroll container of its own and must not; all 27 shipped
                 * instances sit inside one. Bare, seven columns over 87-96 rows
                 * would overflow the ~345px content box at 390px ONTO THE
                 * DOCUMENT, giving the whole match route horizontal body scroll
                 * — a page-level regression and a direct UX-DR16 violation.
                 *
                 * `overflow-x-auto`, NOT `SCROLLPORT`: that one is
                 * height-bounded and pairs with `sticky`, and capping an 87-row
                 * log at 70vh buys nothing. For the same reason `sticky` is NOT
                 * passed — it needs a height-bounded scrolling ancestor, and
                 * 2.11a's declared departure was exactly a sticky rule inside an
                 * unbounded one, which computes correctly and silently does
                 * nothing.
                 *
                 * And NO `key`. The neighbouring Domain G table carries one
                 * because ITS column set changes with the breakpoint and the
                 * group tab; these gates are bundle-constant, so the same key
                 * would remount on every breakpoint cross and discard the
                 * reader's sort for nothing.
                 */}
                <div className="mt-tile-gap w-full overflow-x-auto">
                  <DataTable
                    caption={receivingCaption}
                    columns={receivingColumns}
                    rows={receivingRows}
                    // The page canvas, never the pitch — getting that backwards
                    // is the defect Story 2.7's review headlined.
                    surface="canvas"
                    tableName={receivingTableName}
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
