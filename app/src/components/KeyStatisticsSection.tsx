"use client";

import { useId, useState } from "react";

import type { KeyStatisticsBlock } from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TileLeader } from "@/lib/match-hero";
import {
  COMPACT_KEY_STAT_FIELDS,
  KEY_STAT_FORMAT,
  KEY_STAT_UNIT,
  buildKeyStatRows,
  type KeyStatField,
  type KeyStatRow,
} from "@/lib/tactical-sections";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/*
 * The Key Statistics section (Task 5, AC 2): the full 19-field Domain B block
 * as head-to-head paired tiles. Every value renders verbatim from the artifact
 * (AD-5); the only thing derived here is leader-accent determination between
 * two displayed values, which AD-5 names as allowed presentation geometry.
 *
 * At <md six ruled rows show with the remaining thirteen behind "Ver todas las
 * estadísticas" (ruled decision 4): AC 2 demands both the FULL block and
 * enough compactness that UJ-1's single scroll still reaches the momentum
 * slot, and 19 rows at ~56px is ≈1.3 viewports. Nothing is deleted — the same
 * "declutter without deleting" grammar EXPERIENCE rules for pass networks.
 *
 * No glossary underlines (ruled decision 8): a dotted-underline affordance
 * with no tooltip behind it is a broken promise. Story 2.18 marks terms across
 * the whole layer at once.
 */

// aria-hidden glyph — a module const so it is never a literal JSX child (gate).
const LEADER_GLYPH = "▲";

function TileValue({
  value,
  code,
  side,
  leader,
  leaderLabel,
}: {
  value: string;
  code: string;
  side: "home" | "away";
  leader: TileLeader;
  leaderLabel: string;
}) {
  const leads = leader === side;
  const accent = side === "home" ? "text-viz-team-a" : "text-viz-team-b";
  return (
    <div className={cn("flex flex-col gap-0.5", side === "home" ? "items-start" : "items-end")}>
      <span className={cn("type-stat-value", leads ? accent : "text-ink-primary")}>
        {leads ? (
          // On the ramp (type-caption, 12px) — the 2.4 review rejected the
          // mockup's arbitrary 13px on sight.
          <span aria-hidden="true" className="mr-0.5 align-top type-caption">
            {LEADER_GLYPH}
          </span>
        ) : null}
        {value}
        {/* Never color-only (UX-DR7/UX-DR11): accent + glyph + accessible name. */}
        {leads ? <span className="sr-only">{leaderLabel}</span> : null}
      </span>
      <span className="type-label-caps text-ink-secondary">{code}</span>
    </div>
  );
}

function StatPairTile({
  labelText,
  homeValue,
  awayValue,
  homeCode,
  awayCode,
  leader,
  leaderLabel,
}: {
  labelText: string;
  homeValue: string;
  awayValue: string;
  homeCode: string;
  awayCode: string;
  leader: TileLeader;
  leaderLabel: string;
}) {
  return (
    <div className="grid min-h-11 grid-cols-[76px_1fr_76px] items-center rounded-md bg-surface-raised px-4 py-3 md:grid-cols-[120px_1fr_120px]">
      <TileValue
        value={homeValue}
        code={homeCode}
        side="home"
        leader={leader}
        leaderLabel={leaderLabel}
      />
      <span className="type-stat-label text-center text-ink-secondary">{labelText}</span>
      <TileValue
        value={awayValue}
        code={awayCode}
        side="away"
        leader={leader}
        leaderLabel={leaderLabel}
      />
    </div>
  );
}

export function KeyStatisticsSection({
  keyStatistics,
  homeCode,
  awayCode,
}: {
  keyStatistics: KeyStatisticsBlock;
  homeCode: string;
  awayCode: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const isMd = useMediaQuery(MD_MEDIA_QUERY);
  const [showAll, setShowAll] = useState(false);
  const overflowId = useId();

  const leaderLabel = t("match.hero.leader");
  const rows = buildKeyStatRows(keyStatistics);
  const compactFields = new Set<KeyStatField>(COMPACT_KEY_STAT_FIELDS);

  // Digits are pinned by the registry's format tag; @/lib/format is the only
  // formatting path and fails loud on non-finite input — never pre-sanitize.
  function statValue(value: number, field: KeyStatField): string {
    const format = KEY_STAT_FORMAT[field];
    switch (format) {
      case "percent":
        return formatPercent(value, locale, 0);
      case "integer":
        return formatInteger(value, locale);
      case "decimal1":
        return formatDecimal(value, locale, 1);
      case "decimal2":
        return formatDecimal(value, locale, 2);
      default: {
        const unexpected: never = format;
        throw new Error(`KeyStatisticsSection: unknown format tag ${JSON.stringify(unexpected)}`);
      }
    }
  }

  // Units are locale metadata keyed by metric code (AD-7), composed here
  // rather than baked into the label string.
  function statLabel(field: KeyStatField): string {
    const base = t(`enums.metric.${field}`);
    const unit = KEY_STAT_UNIT[field];
    if (unit === undefined) {
      return base;
    }
    return `${base} (${t(`enums.unit.${unit}`)})`;
  }

  function renderRow(row: KeyStatRow) {
    const tile = (
      <StatPairTile
        labelText={statLabel(row.field)}
        homeValue={statValue(row.home, row.field)}
        awayValue={statValue(row.away, row.field)}
        homeCode={homeCode}
        awayCode={awayCode}
        leader={row.leader}
        leaderLabel={leaderLabel}
      />
    );
    if (row.field !== "possession") {
      return <div key={row.field}>{tile}</div>;
    }
    /*
     * contestedPossession is a MATCH-level third share — the page prints
     * possession as home / contested / away and the middle value cannot be
     * derived from the two team values — so it cannot be a paired tile. It
     * rides beneath the possession row as a caption, with no "sums to 100"
     * claim: at 0 decimals m074 rounds to 66/11/24.
     */
    // Composed as a variable: a template literal as a JSX child trips the gate.
    const contested = `${t("tactical.keyStats.contested")} ${formatPercent(
      keyStatistics.contestedPossession,
      locale,
      0
    )}`;
    return (
      <div key={row.field}>
        {tile}
        <p className="mt-1 px-1 type-caption text-ink-secondary">{contested}</p>
      </div>
    );
  }

  const primaryRows = isMd ? rows : rows.filter((row) => compactFields.has(row.field));
  const overflowRows = isMd ? [] : rows.filter((row) => !compactFields.has(row.field));
  // Built here, not inline: `{t(cond ? "a" : "b")}` trips the i18n gate.
  const toggleKey: DictionaryKey = showAll
    ? "tactical.keyStats.showLess"
    : "tactical.keyStats.showAll";

  return (
    <div>
      {/* DESIGN Responsive: single column at <md, two columns of the same tiles at ≥md. */}
      <div className="grid grid-cols-1 gap-tile-gap md:grid-cols-2">{primaryRows.map(renderRow)}</div>
      {overflowRows.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={showAll}
            aria-controls={overflowId}
            onClick={() => setShowAll((value) => !value)}
            className="mt-tile-gap flex min-h-11 w-full items-center justify-center rounded-md border border-hairline type-title text-ink-primary"
          >
            {t(toggleKey)}
          </button>
          {showAll ? (
            <div id={overflowId} className="mt-tile-gap grid grid-cols-1 gap-tile-gap">
              {overflowRows.map(renderRow)}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
