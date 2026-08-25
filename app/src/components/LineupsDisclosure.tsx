"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import type { Lineup, LineupEntry, TeamRef } from "@/lib/contract/contract-types";
import { playerHref } from "@/lib/hub-model";
import { useT } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

/*
 * The Hero's ONE sub-disclosure (Task 5): line-ups and formations. A native
 * <button aria-expanded aria-controls> toggles a region — no Accordion vendor,
 * no animation (motion is decorative and globally killed). On expand focus
 * moves to the revealed heading (EXPERIENCE disclosure pattern). Player names
 * link to Player Profiles (route ships in 2.15); formation strings are
 * locale-neutral data (AD-7).
 */

// aria-hidden glyphs — consts so they are never literal JSX children (gate).
const CHEVRON = "▸";

function PlayerRow({ player }: { player: LineupEntry }) {
  const t = useT();
  return (
    <li className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-right type-table-numeric text-ink-secondary">
        {player.shirtNumber}
      </span>
      {/*
       * min-h-11 belongs on the Link, not the row: the row is what the eye
       * measures but the anchor is what the finger hits (Task 5.3, ≥44×44px).
       */}
      {/*
       * `playerHref()`, not an inline template (Story 2.15 D10). `/players/`
       * BECOMES A LIVE ROUTE with this story, so the trailing slash stops being
       * cosmetic: `trailingSlash: true` rewrites a slash-less href at request
       * time, and the helper is where that slash has exactly one definition —
       * which is the failure `hub-model.ts` records this trio existing to
       * prevent.
       */}
      <Link
        href={playerHref(player.playerId)}
        className="flex min-h-11 flex-1 items-center type-body text-ink-primary hover:underline"
      >
        {player.name}
      </Link>
      <span className="type-caption text-ink-secondary">
        {t(`enums.position.${player.position}`)}
      </span>
    </li>
  );
}

function TeamLineup({
  team,
  lineup,
  headingRef,
}: {
  team: TeamRef;
  lineup: Lineup;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  return (
    <div>
      {/*
       * No outline-none here: this heading is the programmatic focus target on
       * expand, and the global :focus-visible ring (--ring, NFR-2) is the only
       * indicator a keyboard user gets when focus lands.
       */}
      <h2 ref={headingRef} tabIndex={-1} className="type-title text-ink-primary">
        <span>{team.name}</span>
        <span className="ml-2 type-table-numeric text-ink-secondary">
          {/* A bare "4-3-3" is meaningless unlabelled to a screen reader. */}
          <span className="sr-only">{t("match.hero.lineups.formation")}</span>{" "}
          {lineup.formation}
        </span>
      </h2>
      <p className="mt-3 type-stat-label text-ink-secondary">{t("match.hero.lineups.starters")}</p>
      <ul className="mt-1">
        {lineup.starters.map((player) => (
          <PlayerRow key={player.playerId} player={player} />
        ))}
      </ul>
      <p className="mt-3 type-stat-label text-ink-secondary">
        {t("match.hero.lineups.substitutes")}
      </p>
      <ul className="mt-1">
        {lineup.substitutes.map((player) => (
          <PlayerRow key={player.playerId} player={player} />
        ))}
      </ul>
    </div>
  );
}

export function LineupsDisclosure({
  homeTeam,
  awayTeam,
  lineups,
}: {
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  lineups: { home: Lineup; away: Lineup };
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const firstHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) {
      firstHeadingRef.current?.focus();
    }
  }, [open]);

  // Summary line: the two formations (locale-neutral data, AD-7) plus the
  // localized "starters and substitutes" tail. Composed as one variable so the
  // row renders no literal JSX text (the i18n gate flags every literal child).
  // The separator is dictionary-owned (match.meta.separator) so the on-page
  // text and the <title> can never drift apart.
  const sep = t("match.meta.separator");
  const summary = `${homeTeam.teamCode.toUpperCase()} ${lineups.home.formation}${sep}${awayTeam.teamCode.toUpperCase()} ${lineups.away.formation}${sep}${t("match.hero.lineups.summary")}`;

  return (
    <div className="mt-5 rounded-md bg-surface-raised">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-tile-gap p-3.5 text-left"
      >
        <span className="flex-1">
          <span className="block type-title text-ink-primary">
            {t("match.hero.lineups.title")}
          </span>
          <span className="mt-0.5 block type-caption text-ink-secondary">{summary}</span>
        </span>
        <span
          aria-hidden="true"
          className={cn("type-body text-ink-secondary", open && "rotate-90")}
        >
          {CHEVRON}
        </span>
      </button>
      {/*
       * The revealed content is always in the DOM (toggled with `hidden`), so
       * the line-ups ship in the pre-rendered HTML — crawlable and present for
       * the static-output assertions — rather than mounting only on expand.
       */}
      <div
        id={regionId}
        hidden={!open}
        className="grid grid-cols-1 gap-6 border-t border-hairline p-3.5"
      >
        <TeamLineup team={homeTeam} lineup={lineups.home} headingRef={firstHeadingRef} />
        <TeamLineup team={awayTeam} lineup={lineups.away} />
      </div>
    </div>
  );
}
