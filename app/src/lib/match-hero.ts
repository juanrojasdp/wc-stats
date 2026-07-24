import type {
  GoalRecord,
  KnockoutScore,
  Lineups,
  MatchBundle,
  MatchGroup,
  MinuteStamp,
  Stage,
  StoryStatsBlock,
  TeamRef,
  TeamScore,
} from "@/lib/contract/contract-types";

/*
 * Pure Hero display logic (AD-5: render artifact values verbatim, never derive
 * a Hero value). Every function here is a plain data transform with no React,
 * no locale binding and no formatting — the label strings are passed in by the
 * caller, which resolves them through t()/useT(). That keeps this module unit
 * testable in the node env (Task 8.2) and keeps the metadata title composed
 * OUTSIDE the generateMetadata literal the i18n gate flags (Task 2.2).
 */

/**
 * The minimal Hero subset serialized into the MatchHero client component's
 * props. NEVER the whole MatchBundle — inlining it into the HTML violates
 * AR-11; the rest of the bundle is fetched at runtime by MatchBundleRegion.
 */
export interface HeroData {
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: TeamScore;
  knockoutScore: KnockoutScore;
  stage: Stage;
  group: MatchGroup;
  venue: string;
  date: string;
  kickoff: string;
  goals: GoalRecord[];
  lineups: Lineups;
  storyStats: StoryStatsBlock;
}

/** Project the build-time bundle down to the Hero props (AR-11 split). */
export function toHeroData(bundle: MatchBundle): HeroData {
  const m = bundle.metadata;
  return {
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    score: m.score,
    knockoutScore: m.knockoutScore,
    stage: m.stage,
    group: m.group,
    venue: m.venue,
    date: m.date,
    kickoff: m.kickoff,
    goals: m.goals,
    lineups: m.lineups,
    storyStats: bundle.storyStats,
  };
}

/** Dictionary key for a stage label — `enums.stage.<code>` (AD-7). */
export function stageLabelKey(stage: Stage): `enums.stage.${Stage}` {
  return `enums.stage.${stage}`;
}

/**
 * Goal-clock label: "8′", or "90+2′" when the event fell in stoppage time.
 * The prime (U+2032) is composed here so no component renders it as JSX text
 * (the i18n gate flags any literal JSX child).
 */
export function formatGoalMinute(at: MinuteStamp): string {
  if (at.stoppageMinute !== null) {
    return `${at.minute}+${at.stoppageMinute}′`;
  }
  return `${at.minute}′`;
}

/**
 * Scorers split into the two Hero columns, grouped by the goal's `teamId`.
 * `teamId` is already the BENEFITING team (AD-6), so grouping alone attributes
 * own goals correctly — m074's Gustavo GOMEZ (a Paraguay player) has
 * teamId "germany" and lands in the home/Germany column.
 */
export function groupScorers(
  goals: GoalRecord[],
  homeTeamId: string,
  awayTeamId: string
): { home: GoalRecord[]; away: GoalRecord[] } {
  const home = goals.filter((g) => g.teamId === homeTeamId);
  const away = goals.filter((g) => g.teamId === awayTeamId);
  // Two independent filters can silently drop a goal (teamId matching neither
  // side) or double-count one (both ids equal) while the scoreline still counts
  // it — a page reading "2–1" with one scorer and no error. Fail loud instead,
  // as format.ts and decidedByCaption do for their own invariants.
  if (home.length + away.length !== goals.length) {
    throw new Error(
      `match-hero: ${goals.length} goals did not partition into ${homeTeamId}/${awayTeamId} (got ${home.length}/${away.length})`
    );
  }
  return { home, away };
}

/**
 * Which side to caption beneath the score row, decoded from `decidedBy`.
 * "regulation" → nothing; "extra-time" → a fixed caption; "shootout" → the
 * shoot-out score in home–away order. No fixture exercises "extra-time"
 * (FR-1 gap → Story 1.18); this branch is built type-first and unit-tested.
 */
export type DecidedByCaption =
  | { kind: "none" }
  | { kind: "extra-time" }
  | { kind: "shootout"; home: number; away: number };

export function decidedByCaption(knockoutScore: KnockoutScore): DecidedByCaption {
  switch (knockoutScore.decidedBy) {
    case "regulation":
      return { kind: "none" };
    case "extra-time":
      return { kind: "extra-time" };
    case "shootout":
      if (knockoutScore.shootoutScore === null) {
        // decidedBy "shootout" implies a shootoutScore (contract invariant
        // test_knockout_score_agrees_with_decided_by); fail loud if violated.
        throw new Error("match-hero: decidedBy 'shootout' with null shootoutScore");
      }
      return {
        kind: "shootout",
        home: knockoutScore.shootoutScore.home,
        away: knockoutScore.shootoutScore.away,
      };
    default: {
      // Bundles are `as`-cast unvalidated JSON, so an out-of-union decidedBy
      // would fall off the end and return undefined — the caller then reads
      // `.kind` on it and the build dies unattributed. Name the value instead.
      const unexpected: never = knockoutScore.decidedBy;
      throw new Error(`match-hero: unknown decidedBy ${JSON.stringify(unexpected)}`);
    }
  }
}

/**
 * Head-to-head leader for a Story-Stat tile: higher value leads (UX-DR7).
 * Equal values tie and get no leader marks — never color-only.
 */
export type TileLeader = "home" | "away" | "tie";

export function resolveLeader(home: number, away: number): TileLeader {
  if (home > away) {
    return "home";
  }
  if (away > home) {
    return "away";
  }
  return "tie";
}

/**
 * Compose the <title>/OG string from the bundle's own fields (ruled decision
 * 8 — an AD-11-legal fs read that already carries knockoutScore). Built here,
 * NOT inside generateMetadata, because the i18n gate flags any template/concat
 * that is the direct value of a `title:` property even when every fragment is
 * a t() call. The caller passes the already-resolved labels.
 */
export function composeMatchTitle(input: {
  homeName: string;
  awayName: string;
  score: TeamScore;
  knockoutScore: KnockoutScore;
  stageLabel: string;
  siteName: string;
  separator: string;
  scoreSeparator: string;
  penShort: string;
}): string {
  const {
    homeName,
    awayName,
    score,
    knockoutScore,
    stageLabel,
    siteName,
    separator,
    scoreSeparator,
    penShort,
  } = input;
  const scoreline = `${score.home}${scoreSeparator}${score.away}`;
  let teams = `${homeName} ${scoreline} ${awayName}`;
  if (knockoutScore.decidedBy === "shootout") {
    if (knockoutScore.shootoutScore === null) {
      // Same contract invariant decidedByCaption throws on. Swallowing it here
      // is worse, not better: the title is what reaches search results and
      // shared links, and without the suffix a 1–1 shoot-out reads as a draw.
      throw new Error("match-hero: decidedBy 'shootout' with null shootoutScore");
    }
    const pens = `${knockoutScore.shootoutScore.home}${scoreSeparator}${knockoutScore.shootoutScore.away}`;
    teams += ` (${pens} ${penShort})`;
  }
  return `${teams}${separator}${stageLabel}${separator}${siteName}`;
}
