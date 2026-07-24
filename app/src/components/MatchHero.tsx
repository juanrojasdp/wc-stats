"use client";

import Link from "next/link";

import type { GoalRecord } from "@/lib/contract/contract-types";
import { formatDate, formatKickoff } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  decidedByCaption,
  formatGoalMinute,
  groupScorers,
  stageLabelKey,
  type HeroData,
} from "@/lib/match-hero";

import { LineupsDisclosure } from "@/components/LineupsDisclosure";
import { StoryStatTiles } from "@/components/StoryStatTiles";

/*
 * Pre-rendered Hero (Task 3, AR-11). "use client" + useT() so it pre-renders to
 * Spanish canonical HTML at build and swaps copy on the single post-hydration
 * pass — a server-t() Hero would freeze Spanish and ignore the language toggle
 * (the deferred-work trap routed to this story). Every value is rendered
 * verbatim from the artifact (AD-5); nothing is derived here.
 *
 * Layout order per the 390px mockup: sr-only h1 → stage chip → context line →
 * score row → decidedBy caption → scorers → Story Stats → lineups disclosure.
 */

export function MatchHero({ data }: { data: HeroData }) {
  const t = useT();
  const { locale } = useLocale();

  const { homeTeam, awayTeam, score, knockoutScore, stage, group } = data;
  const scoreSep = t("match.hero.scoreSeparator");
  const stageLabel = t(stageLabelKey(stage));
  // Dictionary-owned separator — the same fragment generateMetadata composes
  // the <title> from, so on-page text and tab title can never drift apart.
  const sep = t("match.meta.separator");

  // Stage chip: group stage appends "· Grupo A"; knockouts show the label only.
  const chipText =
    stage === "group" && group !== null
      ? `${stageLabel}${sep}${t("match.hero.group")} ${group.toUpperCase()}`
      : stageLabel;

  // Context line — venue + local date + venue-local kickoff. Format helpers
  // only; formatKickoff rejects Z-suffixed input by design.
  const contextLine = `${data.venue}${sep}${formatDate(data.date, locale)}${sep}${formatKickoff(
    data.kickoff,
    locale
  )} ${t("match.hero.localTime")}`;

  // sr-only page heading (ruled decision 5): teams + score + stage.
  const heading = `${homeTeam.name} ${score.home}${scoreSep}${score.away} ${awayTeam.name}${sep}${stageLabel}`;

  // decidedBy caption beneath the score row (Task 3.6).
  const caption = decidedByCaption(knockoutScore);
  let captionText: string | null = null;
  if (caption.kind === "extra-time") {
    captionText = t("match.hero.extraTime");
  } else if (caption.kind === "shootout") {
    captionText = `${t("match.hero.shootout")} ${caption.home}${scoreSep}${caption.away}`;
  }

  const scorers = groupScorers(data.goals, homeTeam.teamId, awayTeam.teamId);

  // Scorer line: "{name} {minute}′" plus own-goal / penalty suffixes. The prime
  // and the localized suffixes are composed here so no literal reaches the JSX.
  function scorerLine(goal: GoalRecord): string {
    let line = `${goal.scorerName} ${formatGoalMinute(goal.at)}`;
    if (goal.ownGoal) {
      line += ` ${t("match.hero.ownGoal")}`;
    }
    if (goal.penalty) {
      line += ` ${t("match.hero.penalty")}`;
    }
    return line;
  }

  return (
    <section className="pt-5">
      <h1 className="sr-only">{heading}</h1>

      {/* Stage-context chip */}
      <div className="flex justify-center">
        <span className="rounded-full bg-surface-overlay px-3 py-1.5 type-label-caps text-ink-secondary">
          {chipText}
        </span>
      </div>

      {/* Context line */}
      <p className="mt-2 text-center type-caption text-ink-secondary">{contextLine}</p>

      {/* Score row */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex flex-col items-center gap-1.5">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-surface-overlay type-label-caps text-ink-secondary">
            {homeTeam.teamCode.toUpperCase()}
          </span>
          {/* min-h-11 on the anchor itself — Task 5.3's ≥44×44px target. */}
          <Link
            href={`/teams/${homeTeam.teamId}/`}
            className="flex min-h-11 items-center justify-center text-center type-title text-ink-primary hover:underline"
          >
            {homeTeam.name}
          </Link>
        </div>
        <div className="flex items-center gap-2 px-1.5 type-display-score text-ink-primary">
          <span>{score.home}</span>
          <span className="text-ink-secondary">{scoreSep}</span>
          <span>{score.away}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-surface-overlay type-label-caps text-ink-secondary">
            {awayTeam.teamCode.toUpperCase()}
          </span>
          <Link
            href={`/teams/${awayTeam.teamId}/`}
            className="flex min-h-11 items-center justify-center text-center type-title text-ink-primary hover:underline"
          >
            {awayTeam.name}
          </Link>
        </div>
      </div>

      {/* decidedBy caption (extra-time / shoot-out) */}
      {captionText !== null ? (
        <p className="mt-2 text-center type-caption text-ink-secondary">{captionText}</p>
      ) : null}

      {/* Scorers — home left, away right, grouped by benefiting team (AD-6) */}
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div className="text-left">
          {scorers.home.map((goal, i) => (
            <div
              key={`${goal.scorerPlayerId}-${goal.at.minute}-${i}`}
              className="type-caption tabular-nums text-ink-secondary"
            >
              {scorerLine(goal)}
            </div>
          ))}
        </div>
        <div className="text-right">
          {scorers.away.map((goal, i) => (
            <div
              key={`${goal.scorerPlayerId}-${goal.at.minute}-${i}`}
              className="type-caption tabular-nums text-ink-secondary"
            >
              {scorerLine(goal)}
            </div>
          ))}
        </div>
      </div>

      {/* Story Stats tiles */}
      <StoryStatTiles
        storyStats={data.storyStats}
        homeCode={homeTeam.teamCode.toUpperCase()}
        awayCode={awayTeam.teamCode.toUpperCase()}
      />

      {/* The Hero's one sub-disclosure */}
      <LineupsDisclosure homeTeam={homeTeam} awayTeam={awayTeam} lineups={data.lineups} />
    </section>
  );
}
