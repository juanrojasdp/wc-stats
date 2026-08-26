"use client";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { Players } from "@/lib/contract/contract-types";
import { formatInteger, formatPercent } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import {
  offersRows,
  offersSummary,
  offersTotalsRows,
  type OffersRow,
  type OffersTotalsRow,
} from "@/viz/receiving-model";

/*
 * The #offers-to-receive content (Story 2.9 Task 6.2).
 *
 * THIS IS NOT A MAP AND MUST NEVER BECOME ONE. The epic asks for a marker
 * scatter; Story 1.13 measured, over 104 reports / 416 pages, that
 * `ReceivingEvent` is unfulfillable in EVERY ONE of its eight required fields —
 * and that the source page's "Offering to Receive" panel is 11 filled circles
 * that are BYTE-IDENTICAL between panels on 208/208 team-innings, i.e. a static
 * formation template with zero per-report information. So `events.receiving`
 * can only ever be null, no receiving marker is producible, and none may be
 * fabricated.
 *
 * What ships instead is a per-team AGGREGATE surface off Domain G
 * (`players[].inPossession`), which is real, contracted, present in all three
 * fixtures and survives the 2.19 real-data cutover. These rows are whole-match
 * per-player aggregates with no clock, no coordinates and no per-event
 * identity: they are never rendered as events and never placed on a pitch
 * (DESIGN.md:355 bans snap-to-zone; AD-8 bans inventing per-event structure the
 * source lacks).
 */

interface SideRef {
  teamId: string;
  /** Uppercased — the direct label (UX-DR11). */
  teamCode: string;
  /** Display name, used in each figure's own summary. */
  name: string;
}

export interface OffersToReceiveSectionProps {
  players: Players;
  home: SideRef;
  away: SideRef;
  /** `#offers-to-receive-table`'s nonce (Story 3.8, D4). */
  tableNonce: number;
}

/*
 * The THEME-AWARE canvas variants, not the -on-pitch ones (ruled decision 21):
 * this surface is a card on --surface-raised, not the pitch. Measured there:
 * dark 13.56 / 10.30, light 4.99 / 5.36 — both clear 4.5:1 in both themes.
 */
const ACCENT_CLASS = { a: "text-viz-team-a", b: "text-viz-team-b" } as const;

/** aria-hidden glyph — a module const so it is never a literal JSX child (gate). */
const LEADER_GLYPH = "▲";
const CAPTION_SEPARATOR = " — ";
const CLAUSE_SEPARATOR = ", ";

/**
 * One value inside a team's figure, with the ruled UX-DR7 leader treatment:
 * the team accent PLUS the ▲ glyph PLUS the spoken leader word. Colour alone
 * never encodes who leads — the two accents are only 1.32:1 apart in lightness.
 *
 * Built locally on purpose: the shipped `StatPairTile` in KeyStatisticsSection
 * is private, and this story does not refactor or import from that file.
 */
function FigureValue({
  valueText,
  labelText,
  leads,
  accentClass,
  leaderWord,
}: {
  valueText: string;
  labelText: string;
  leads: boolean;
  accentClass: string;
  leaderWord: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("type-stat-value", leads ? accentClass : "text-ink-primary")}>
        {leads ? (
          <span aria-hidden="true" className="mr-0.5 align-top type-caption">
            {LEADER_GLYPH}
          </span>
        ) : null}
        {valueText}
        {leads ? <span className="sr-only">{leaderWord}</span> : null}
      </span>
      <span className="type-stat-label text-ink-secondary">{labelText}</span>
    </div>
  );
}

export function OffersToReceiveSection({
  players,
  home,
  away,
  tableNonce,
}: OffersToReceiveSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("viz.offers.title");
  const leaderWord = t("match.hero.leader");

  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  /*
   * Built EAGERLY (ruled decision 10): a stray teamId names itself on load
   * rather than when a reader opens the disclosure, and every entry point
   * survives `null` and `[]` — `sectionDataState` gates on `!== null` only, so
   * an empty array reaches this component as "ready".
   */
  const summary = offersSummary(players, home, away);
  const rows = offersRows(players, home, away);
  const totals = offersTotalsRows(summary);

  /*
   * UX-DR7's leader treatment is a HEAD-TO-HEAD comparison, so it needs two
   * real values. With one team carrying no player rows there is no opponent
   * value to lead against, and `resolveLeader(390, 0)` would otherwise award
   * the accent, the ▲ and the spoken "líder" against a number that does not
   * exist. No rows on either side ⇒ no leader cue anywhere.
   */
  const bothHaveRows = summary.home.playerCount > 0 && summary.away.playerCount > 0;

  const noShare = t("viz.offers.noShare");
  /** null is "this team made no offers", never 0% — a different fact entirely. */
  function shareText(pct: number | null): string {
    return pct === null ? noShare : formatPercent(pct, locale, 1);
  }

  function teamBlock(
    ref: SideRef,
    side: "home" | "away",
    accent: "a" | "b",
    team: typeof summary.home
  ) {
    const madePhrase = countPhrase(team.offersMade, "viz.offers.offersOne", "viz.offers.offers");
    const receivedPhrase = countPhrase(
      team.offersReceived,
      "viz.offers.receivedOne",
      "viz.offers.received"
    );
    /*
     * Each team block is its own role="figure" with a one-sentence localized
     * summary (ruled decision 22). PitchPanel supplies this automatically for
     * #defensive-actions; these two card sections do not go through it, so they
     * must supply it themselves. The prop is `figureSummary`, following the
     * house naming — `label`, `title`, `caption`, `description`, `text` and
     * `heading` are all gated prop names.
     */
    /*
     * "NO ROWS FOR THIS TEAM" IS NOT "THIS TEAM MADE ZERO OFFERS".
     *
     * REVIEW PATCH: with the other team populated, the section-level zero
     * branch does not fire, so an empty team's figure used to assert
     * "0 ofrecimientos, 0 recibidos" — a positive claim that the report
     * recorded zero — when the truth is that no player rows exist for it at
     * all. `resolveLeader(390, 0)` then handed the populated team the accent,
     * the ▲ glyph and the spoken "líder" against a value that does not exist.
     * `playerCount` is the one signal that separates the two states, and it was
     * visible only in the totals table behind the disclosure. The model tests
     * this state explicitly ("survives a team with no rows at all"); the
     * component now distinguishes it too.
     */
    const hasRows = team.playerCount > 0;
    const accentClass = ACCENT_CLASS[accent];
    const figureSummary = hasRows
      ? `${t("viz.offers.figurePrefix")} ${ref.name}${CLAUSE_SEPARATOR}${madePhrase}` +
        `${CLAUSE_SEPARATOR}${receivedPhrase}${CLAUSE_SEPARATOR}` +
        `${t("viz.offers.receivedPctLabel")} ${shareText(team.receivedPct)}`
      : `${t("viz.offers.figurePrefix")} ${ref.name}${CLAUSE_SEPARATOR}${t("viz.offers.noRows")}`;
    /*
     * The per-team zero line lives INSIDE the figure, where "este equipo"
     * actually resolves to a team.
     *
     * REVIEW PATCH: this section used to short-circuit BOTH figures at section
     * level and render one `viz.offers.zero` — "El informe no registra
     * ofrecimientos para este equipo." — with no team in scope at all, naming a
     * referent the render had just removed. MovementToReceiveSection gets this
     * right by keeping its zero line per figure; both sections now do.
     */
    const isZero = team.offersMade === 0;
    if (!hasRows || isZero) {
      return (
        <figure
          role="figure"
          aria-label={figureSummary}
          className="min-w-0 rounded-md bg-surface-raised p-tile-gap"
        >
          <span className={cn("type-label-caps", accentClass)}>{ref.teamCode}</span>
          <p className="mt-2 type-caption text-ink-secondary">
            {hasRows ? t("viz.offers.zero") : t("viz.offers.noRows")}
          </p>
        </figure>
      );
    }
    return (
      <figure role="figure" aria-label={figureSummary} className="min-w-0 rounded-md bg-surface-raised p-tile-gap">
        {/* A team code is a LABEL, never a heading: promoting it would put a
            non-section-name into the page outline (MomentumSection's ruling). */}
        <span className={cn("type-label-caps", accentClass)}>{ref.teamCode}</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <FigureValue
            valueText={formatInteger(team.offersMade, locale)}
            labelText={t("viz.offers.madeLabel")}
            leads={bothHaveRows && summary.leaders.made === side}
            accentClass={accentClass}
            leaderWord={leaderWord}
          />
          <FigureValue
            valueText={formatInteger(team.offersReceived, locale)}
            labelText={t("viz.offers.receivedLabel")}
            leads={bothHaveRows && summary.leaders.received === side}
            accentClass={accentClass}
            leaderWord={leaderWord}
          />
          <FigureValue
            valueText={shareText(team.receivedPct)}
            labelText={t("viz.offers.receivedPctLabel")}
            leads={bothHaveRows && summary.leaders.receivedPct === side}
            accentClass={accentClass}
            leaderWord={leaderWord}
          />
        </div>
      </figure>
    );
  }

  /* ------------------------------- The table -------------------------------- */

  /** The team column both tables open with, identical in each. */
  function teamColumn<Row extends { teamCode: string }>(): TableColumn<Row> {
    return {
      key: "team",
      headText: t("viz.table.team"),
      headTitle: null,
      render: (row) => row.teamCode,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.teamCode },
    };
  }

  /*
   * `receivedPct` sorts on the NUMBER, never on `shareText`'s output: null
   * renders as "Sin ofrecimientos" and 0 as "0,0 %", and collating those two as
   * text would interleave a team that made no offers with one that made many
   * and received none — the exact distinction this column's null exists to
   * preserve.
   */
  const totalsColumns: TableColumn<OffersTotalsRow>[] = [
    teamColumn<OffersTotalsRow>(),
    {
      key: "made",
      headText: t("viz.table.offersMade"),
      headTitle: null,
      render: (row) => formatInteger(row.offersMade, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.offersMade },
    },
    {
      key: "received",
      headText: t("viz.table.offersReceived"),
      headTitle: null,
      render: (row) => formatInteger(row.offersReceived, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.offersReceived },
    },
    {
      key: "pct",
      headText: t("viz.table.receivedPct"),
      headTitle: null,
      render: (row) => shareText(row.receivedPct),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.receivedPct },
    },
    {
      key: "players",
      headText: t("viz.table.players"),
      headTitle: null,
      render: (row) => formatInteger(row.playerCount, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.playerCount },
    },
  ];

  const playerColumns: TableColumn<OffersRow>[] = [
    teamColumn<OffersRow>(),
    {
      key: "shirt",
      headText: t("viz.table.shirt"),
      headTitle: null,
      render: (row) => formatInteger(row.shirtNumber, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.shirtNumber },
    },
    {
      key: "player",
      headText: t("viz.table.player"),
      headTitle: null,
      /* Plain text, never a link: /players/{slug} does not exist in
         src/app/, so a link 404s in the static export. UX-DR22's
         cross-link rule is scoped to LINEUP names. */
      render: (row) => row.playerName,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.playerName },
    },
    {
      key: "made",
      headText: t("viz.table.offersMade"),
      headTitle: null,
      render: (row) => formatInteger(row.offersMade, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.offersMade },
    },
    {
      key: "received",
      headText: t("viz.table.offersReceived"),
      headTitle: null,
      render: (row) => formatInteger(row.offersReceived, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.offersReceived },
    },
    {
      key: "pct",
      headText: t("viz.table.receivedPct"),
      headTitle: null,
      render: (row) => shareText(row.receivedPct),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.receivedPct },
    },
  ];

  /*
   * BOTH tables ship (ruled decision 11). UX-DR16 and ARCHITECTURE-SPINE.md:140
   * require "a reachable data table rendering the same artifact slice", and a
   * per-player table alone does not satisfy that for a team-level tile — a
   * reader would have to sum 16 rows to recover the printed number. Each
   * caption states its own content and its own order; viz.table.caption's
   * "Ordenado por minuto." would be a false claim on clock-less rows.
   */
  // Hoisted into identifiers: a template literal in a gated prop (`caption`) is
  // an i18n-gate error even when every fragment is a t() call.
  const totalsCaption = `${title}${CAPTION_SEPARATOR}${t("viz.offers.totalsCaption")}`;
  const playersCaption = `${title}${CAPTION_SEPARATOR}${t("viz.offers.tableCaption")}`;

  const dataTable = (
    <div className="flex flex-col gap-tile-gap">
      <DataTable
        caption={totalsCaption}
        tableName={totalsCaption}
        columns={totalsColumns}
        rows={totals}
        surface="canvas"
      />
      <DataTable
        caption={playersCaption}
        tableName={playersCaption}
        columns={playerColumns}
        rows={rows}
        surface="canvas"
      />
    </div>
  );

  /*
   * The zero-content view (Task 6.5) is now PER TEAM, inside each figure —
   * see `teamBlock`. The slice being present and listing nothing is a fact
   * about a team, and the copy says "este equipo", so it belongs where a team
   * is in scope. Never an EmptyStatePanel either way: that belongs to the
   * `null` branch and is rendered by TacticalLayer above this component.
   */
  return (
    <div className="flex flex-col gap-tile-gap" id="offers-to-receive-table">
      {/* A subtitle, not a heading: TacticalSection owns the <h2>. */}
      <p className="type-stat-label text-ink-secondary">{t("viz.offers.note")}</p>
      {(
        /*
         * Ruled decision 17, a DECLARED departure from EXPERIENCE.md:130 /
         * UX-DR17: at <md both teams stack VERTICALLY, both visible, no tabs.
         * That row rules "team tabs, one vertical pitch" for all three sections
         * and presumes pitches — tabs exist to stop two 68 m-wide pitches from
         * being unreadable side by side, a constraint two stacked value lists
         * do not have, and tabs would hide one team's numbers behind a control
         * for no gain.
         */
        <div className="grid grid-cols-1 gap-tile-gap md:grid-cols-2">
          {teamBlock(home, "home", "a", summary.home)}
          {teamBlock(away, "away", "b", summary.away)}
        </div>
      )}
      <ViewDataDisclosure
        panelTitle={title}
        surface="canvas"
        openNonce={tableNonce}
        trailing={<p className="type-caption text-ink-secondary">{t("viz.attribution")}</p>}
      >
        {dataTable}
      </ViewDataDisclosure>
    </div>
  );
}
