"use client";

import type { ReactNode } from "react";

import type { StoryStatsBlock } from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n-provider";
import { resolveLeader, type TileLeader } from "@/lib/match-hero";
import { cn } from "@/lib/utils";

/*
 * The five Hero Story-Stat tiles (Task 4): possession, shots, xG, distance,
 * top speed — 2-column grid at 390px with the fifth tile full width. The
 * leading value takes the team accent (viz-team-a lime = home, viz-team-b cyan
 * = away) PLUS a ▲ glyph PLUS an sr-only «líder» (UX-DR7 — never color-only);
 * ties get no marks. Values format through the sole formatting path with the
 * digit precision the mockup pins (percent 0, xG 2, distance/speed 1).
 */

// Rendered aria-hidden — a variable so it is never a literal JSX child (gate).
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
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("type-stat-value", leads ? accent : "text-ink-primary")}>
        {leads ? (
          // type-caption (12px), not the mockup's 13px — ruled decision 2 keeps
          // every size on the ramp, and this glyph is no exception.
          <span aria-hidden="true" className="mr-0.5 align-top type-caption">
            {LEADER_GLYPH}
          </span>
        ) : null}
        {value}
        {leads ? <span className="sr-only">{leaderLabel}</span> : null}
      </span>
      <span className="type-label-caps text-ink-secondary">{code}</span>
    </div>
  );
}

function Tile({
  labelNode,
  homeValue,
  awayValue,
  homeCode,
  awayCode,
  leader,
  leaderLabel,
  wide = false,
}: {
  labelNode: ReactNode;
  homeValue: string;
  awayValue: string;
  homeCode: string;
  awayCode: string;
  leader: TileLeader;
  leaderLabel: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("rounded-md bg-surface-raised p-3", wide && "col-span-2")}>
      <div className="type-stat-label text-center text-ink-secondary">{labelNode}</div>
      <div className={cn("mt-2 flex justify-between", wide && "px-8")}>
        <TileValue
          value={homeValue}
          code={homeCode}
          side="home"
          leader={leader}
          leaderLabel={leaderLabel}
        />
        <TileValue
          value={awayValue}
          code={awayCode}
          side="away"
          leader={leader}
          leaderLabel={leaderLabel}
        />
      </div>
    </div>
  );
}

export function StoryStatTiles({
  storyStats,
  homeCode,
  awayCode,
}: {
  storyStats: StoryStatsBlock;
  homeCode: string;
  awayCode: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { home, away } = storyStats;
  const leaderLabel = t("match.hero.leader");

  return (
    <div className="mt-5 grid grid-cols-2 gap-tile-gap">
      <Tile
        labelNode={t("match.hero.tiles.possession")}
        homeValue={formatPercent(home.possession, locale, 0)}
        awayValue={formatPercent(away.possession, locale, 0)}
        homeCode={homeCode}
        awayCode={awayCode}
        leader={resolveLeader(home.possession, away.possession)}
        leaderLabel={leaderLabel}
      />
      <Tile
        labelNode={t("match.hero.tiles.shots")}
        homeValue={formatInteger(home.shots, locale)}
        awayValue={formatInteger(away.shots, locale)}
        homeCode={homeCode}
        awayCode={awayCode}
        leader={resolveLeader(home.shots, away.shots)}
        leaderLabel={leaderLabel}
      />
      <Tile
        labelNode={
          // xG keeps glossary-term styling (dotted cyan underline, no caps)
          // plus an sr-only expansion. Full tooltip infra is Story 2.18.
          <span className="inline-flex items-center gap-1 normal-case">
            <span className="underline decoration-accent-cyan decoration-dotted underline-offset-2">
              {t("match.hero.xg")}
            </span>
            <span className="sr-only">{t("match.hero.xgExpansion")}</span>
          </span>
        }
        homeValue={formatDecimal(home.expectedGoals, locale, 2)}
        awayValue={formatDecimal(away.expectedGoals, locale, 2)}
        homeCode={homeCode}
        awayCode={awayCode}
        leader={resolveLeader(home.expectedGoals, away.expectedGoals)}
        leaderLabel={leaderLabel}
      />
      <Tile
        labelNode={t("match.hero.tiles.distance")}
        homeValue={formatDecimal(home.distanceCovered, locale, 1)}
        awayValue={formatDecimal(away.distanceCovered, locale, 1)}
        homeCode={homeCode}
        awayCode={awayCode}
        leader={resolveLeader(home.distanceCovered, away.distanceCovered)}
        leaderLabel={leaderLabel}
      />
      <Tile
        labelNode={t("match.hero.tiles.topSpeed")}
        homeValue={formatDecimal(home.topSpeed, locale, 1)}
        awayValue={formatDecimal(away.topSpeed, locale, 1)}
        homeCode={homeCode}
        awayCode={awayCode}
        leader={resolveLeader(home.topSpeed, away.topSpeed)}
        leaderLabel={leaderLabel}
        wide
      />
    </div>
  );
}
