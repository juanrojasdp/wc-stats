/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Produced by contract/scripts/generate-types.mjs from the JSON Schemas in /contract.
 * Edit the schemas and re-run `npm run generate:types`.
 */

export interface AerialControl {
  totalInterventions: Count;
  punches: CompletionCounts;
  claims: CompletionCounts;
  tippedPalmed: CompletionCounts;
  crossesFacedAttempted: Count;
  crossesFacedCompleted: Count;
  deliveryTypesFaced: CrossDeliveryTypeCounts;
}

/**
 * Aerial Control intervention category. Each is reported complete and incomplete.
 */
export type AerialInterventionType = "punch" | "claim" | "tipped-palmed";

export interface AggregateBlockDistribution {
  high: Percentage;
  mid: Percentage;
  low: Percentage;
}

export interface AggregateInPossessionPhases {
  buildUpUnopposed: Percentage;
  buildUpOpposed: Percentage;
  progression: Percentage;
  finalThird: Percentage;
  longBall: Percentage;
  attackingTransition: Percentage;
  counterAttack: Percentage;
  setPiece: Percentage;
}

export interface AggregateLineHeight {
  inPossession: Metres;
  outOfPossession: Metres;
}

export interface AggregateMetric {
  metricCode: MetricCode;
  value: AggregateMetricValue;
  aggregation: AggregationSemantics;
  perNinety: PerNinety;
}

/**
 * Unformatted; the App applies unit and number format from its locale layer, keyed by metricCode (AD-7).
 */
export type AggregateMetricValue = number;

export interface AggregateOutOfPossessionPhases {
  highPress: Percentage;
  midPress: Percentage;
  lowPress: Percentage;
  highBlock: Percentage;
  midBlock: Percentage;
  lowBlock: Percentage;
  recovery: Percentage;
  defensiveTransition: Percentage;
  counterPress: Percentage;
}

/**
 * Tournament-wide tactical identity. Every value is a match-count-weighted mean over the team's matches; the semantics are recorded in contract/README.md.
 */
export interface AggregateTacticalIdentity {
  phasesInPossession: AggregateInPossessionPhases;
  phasesOutOfPossession: AggregateOutOfPossessionPhases;
  lineHeight: AggregateLineHeight;
  teamLength: AggregateTeamLength;
  defensiveBlockDistribution: AggregateBlockDistribution;
  possession: Percentage;
  pressingIntensity: PressingIntensity;
}

export interface AggregateTeamLength {
  inPossession: Metres;
  outOfPossession: Metres;
}

/**
 * How a player-profile headline aggregate was computed from its per-match values (FR-27). Declared per metric so the App never has to guess, and never re-aggregates (AD-5).
 */
export type AggregationSemantics = "sum" | "max" | "average";

export interface Appearances {
  played: Count;
  started: Count;
  substituteAppearances: Count;
  minutesPlayed: Count;
}

/**
 * Defensive block height. All three shares are stored; the third is never derived by subtraction (AD-5).
 */
export type BlockLevel = "high" | "mid" | "low";

export type Boards = Leaderboard[];

/**
 * Body part used for a shot, from the shots event table's Body Part column.
 */
export type BodyPart = "right-foot" | "left-foot" | "head" | "upper-body" | "lower-body";

export interface CardRecord {
  type: CardType;
  at: MinuteStamp;
}

/**
 * Disciplinary card. NOT derivable from report text — the lineup block renders cards as coloured glyphs, so this vocabulary is closed on the football-universal set. A fourth value is an AD-14 change request (see contract/README.md).
 */
export type CardType = "yellow" | "second-yellow" | "red";

/**
 * Shared identity types, closed vocabularies, coordinates and scalars for every v1 artifact. Authored in the draft-07-compatible subset of 2020-12 (AD-2): $defs allowed; prefixItems, unevaluatedProperties and dependentSchemas banned. Enums are CLOSED by design — a value the pipeline later encounters that is not listed is a shape change, which surfaces as a TypeScript compile error in the App. That is the intended mechanism (AD-2), not a bug. Numeric precision is declared with the custom keyword x-decimals; see contract/README.md for the precision table and enum provenance. This file describes no artifact of its own — it is a $defs library, so its root is deliberately the empty closed object.
 */
export interface Common {}

/**
 * A complete/incomplete pair plus its total. The total is stored, not derived, so a report whose printed total disagrees with its parts becomes a visible deviation rather than a silent correction.
 */
export interface CompletionCounts {
  complete: Count;
  incomplete: Count;
  total: Count;
}

/**
 * Corner delivery style from the Set Plays page's Corners - Delivery Style table.
 */
export type CornerDeliveryStyle = "inswing" | "outswing" | "driven" | "lofted";

export interface CornerDeliveryStyleCounts {
  inswing: Count;
  outswing: Count;
  driven: Count;
  lofted: Count;
}

/**
 * Corner delivery type from the Set Plays page's Corners - Delivery Type table.
 */
export type CornerDeliveryType = "direct-to-area" | "short" | "edge-of-penalty-area";

export interface CornerDeliveryTypeCounts {
  directToArea: CornerSideCounts;
  short: CornerSideCounts;
  edgeOfPenaltyArea: CornerSideCounts;
}

/**
 * Corners of one delivery type, split by the side they were taken from. The two sides sum to the total.
 */
export interface CornerSideCounts {
  left: Count;
  right: Count;
  total: Count;
}

/**
 * A non-negative whole-number tally.
 */
export type Count = number;

export type CrossCompleted = boolean;

/**
 * Cross delivery type. The corpus prints this vocabulary two ways — 'Inswing'/'Outswing' on the crosses and set-plays pages, 'In Swing'/'Out Swing' on the aerial-control page. Both normalize to the same code (logged decision, contract/README.md).
 */
export type CrossDeliveryType = "inswing" | "outswing" | "driven" | "lofted" | "cutback" | "push-cross";

/**
 * Counts across the six cross delivery types plus their total.
 */
export interface CrossDeliveryTypeCounts {
  inswing: Count;
  outswing: Count;
  driven: Count;
  lofted: Count;
  cutback: Count;
  pushCross: Count;
  total: Count;
}

/**
 * One open-play cross, plotted on the crosses pitch map.
 */
export interface CrossEvent {
  teamId: TeamId;
  playerId: PlayerId;
  playerName: CrossPlayerName;
  at: MinuteStamp;
  x: PitchX;
  y: PitchY;
  deliveryType: CrossDeliveryType;
  completed: CrossCompleted;
}

export type CrossEvents = CrossEvent[];

export type CrossPlayerName = string;

/**
 * How a knockout tie was decided.
 */
export type DecidedBy = "regulation" | "extra-time" | "shootout";

/**
 * Sub-category, present only when actionType is possession-contest; null otherwise.
 */
export type DefensiveActionContestType = PossessionContestType | null;

export interface DefensiveActionEvent {
  teamId: TeamId;
  playerId: PlayerId;
  playerName: DefensiveActionPlayerName;
  actionType: DefensiveActionType;
  contestType: DefensiveActionContestType;
  at: MinuteStamp;
  x: PitchX;
  y: PitchY;
}

export type DefensiveActionEvents = DefensiveActionEvent[];

export type DefensiveActionPlayerName = string;

/**
 * Marker category on the Defensive Actions pitch map, from that page's legend.
 */
export type DefensiveActionType = "forced-turnover" | "possession-regain" | "block" | "possession-contest";

/**
 * Share of defensive time spent in each block height. All three are stored — they sum to approximately 100%, and deriving the third would make a rounding artefact look like data (AD-5).
 */
export interface DefensiveBlockDistribution {
  high: Percentage;
  mid: Percentage;
  low: Percentage;
}

/**
 * Top-level goalkeeper distribution family: Kick from Feet, Kick from Hands, Throw Distribution.
 */
export type DistributionType = "feet" | "hands" | "throw";

/**
 * The route manifest and the entire header-search corpus. AR-4 asserts a bijection between these lists and the emitted profile artifacts; that assert runs against real /data in Story 1.17, not against fixtures.
 */
export interface EntityIndex {
  matches: MatchEntities;
  teams: TeamEntities;
  players: PlayerEntities;
}

/**
 * A minimal cross-link to another artifact: the slug plus the display name the App shows without having to fetch the target.
 */
export interface EntityRef {
  id: EntityRefId;
  name: EntityRefName;
}

export type EntityRefId = string;

/**
 * Proper name as printed in the source report. A proper noun, not a translated label — locale-neutral by AD-7.
 */
export type EntityRefName = string;

/**
 * Domain D. Every table is a flat array carrying an explicit teamId per row, so one shape serves both the pitch panel and the accessibility data table — there are no 'lite' variants (EXPERIENCE.md). An empty array means zero events of that kind; null means the report does not carry that data at all.
 */
export interface EventTables {
  shots: ShotEvents;
  shootoutAttempts: ShootoutAttempts;
  crosses: CrossEvents;
  passNetworkNodes: PassNetworkNodes;
  passNetworkEdges: PassNetworkEdges;
  receiving: ReceivingEvents;
  defensiveActions: DefensiveActionEvents;
}

/**
 * An expected-goals value.
 */
export type ExpectedGoals = number;

/**
 * Sub-categories of the Kick from Feet panel.
 */
export type FeetDistributionTechnique =
  "play-onto" | "play-into" | "play-around" | "play-through" | "play-beyond" | "other";

export interface FeetTechniqueCounts {
  playOnto: Count;
  playInto: Count;
  playAround: Count;
  playThrough: Count;
  playBeyond: Count;
  other: Count;
}

/**
 * This team's results in chronological order. The Hub renders result chips straight from it; it is a derived value, so it is a field (AD-5).
 */
export type FormSequence = MatchResult[];

/**
 * Formation as the lineup page prints it, locale-neutral (AD-7). Thirteen distinct values were observed across the 104-report corpus, from 3-4-1-2 to 5-4-1.
 */
export type Formation = string;

/**
 * Distribution over the formations this team started, ordered by descending match count. A derived distribution, therefore a field (AD-5).
 */
export type FormationUsage = FormationUsageRow[];

export interface FormationUsageRow {
  formation: UsedFormation;
  matches: Count;
  share: Percentage;
}

export interface FreeKickCounts {
  direct: Count;
  directOnTarget: Count;
  directOffTarget: Count;
  indirect: Count;
}

/**
 * Free-kick type from the Set Plays page's Free Kicks table.
 */
export type FreeKickType = "direct" | "direct-on-target" | "direct-off-target" | "indirect";

/**
 * Signed, so it is a plain integer rather than a Count.
 */
export type GoalDifference = number;

export type GoalOwnGoal = boolean;

/**
 * An in-play penalty kick. Shoot-out conversions are never goals — see EventTables.shootoutAttempts.
 */
export type GoalPenalty = boolean;

export interface GoalPrevention {
  attemptsFaced: Count;
  savePercentage: Percentage;
  totalInterventions: Count;
  byInterventionType: InterventionTypeCounts;
  byBodyType: InterventionBodyTypeCounts;
}

/**
 * One goal in the match, in chronological order. Own goals are attributed to the BENEFITING team here (teamId) while scorerPlayerId names the player who put it in — and they are excluded from shot maps entirely (AD-6).
 */
export interface GoalRecord {
  teamId: TeamId;
  scorerPlayerId: PlayerId;
  scorerName: GoalScorerName;
  at: MinuteStamp;
  ownGoal: GoalOwnGoal;
  penalty: GoalPenalty;
}

export type GoalScorerName = string;

/**
 * Domain E distribution. Category counts and the total are both stored, so their internal consistency is checkable.
 */
export interface GoalkeeperDistribution {
  total: CompletionCounts;
  feet: CompletionCounts;
  hands: CompletionCounts;
  throw: CompletionCounts;
  feetTechniques: FeetTechniqueCounts;
  handsTechniques: HandsTechniqueCounts;
  throwTechniques: ThrowTechniqueCounts;
  lineBreaks: Count;
}

export interface GoalkeeperInvolvementSample {
  minute: Minute;
  involvements: Count;
}

/**
 * Involvements bucketed along the match clock, as the Goalkeeping Involvement page's timeline chart plots them.
 */
export type GoalkeeperInvolvementTimeline = GoalkeeperInvolvementSample[];

export type GoalkeeperName = string;

/**
 * Domain E, one goalkeeper.
 */
export interface GoalkeeperRecord {
  teamId: TeamId;
  playerId: PlayerId;
  playerName: GoalkeeperName;
  totalInvolvements: Count;
  involvementTimeline: GoalkeeperInvolvementTimeline;
  distribution: GoalkeeperDistribution;
  goalPrevention: GoalPrevention;
  aerialControl: AerialControl;
}

/**
 * One entry per goalkeeper who appeared, both teams, ordered home team first.
 */
export type GoalkeepingBlock = GoalkeeperRecord[];

/**
 * Every goal in the match, chronological. The Momentum Timeline's goal markers come from here, never from the momentum series.
 */
export type Goals = GoalRecord[];

/**
 * Group letter, lowercased. The 2026 format runs 12 groups; A-L were all observed across the 104-report corpus.
 */
export type Group = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l";

export type GroupResults = MatchResultRow[];

export interface GroupTable {
  group: Group;
  standings: Standings;
  results: GroupResults;
}

/**
 * One entry per group, ordered by group letter.
 */
export type GroupTables = GroupTable[];

/**
 * Sub-categories of the Kick from Hands panel.
 */
export type HandsDistributionTechnique = "side-kick" | "from-hands" | "drop-kick";

export interface HandsTechniqueCounts {
  sideKick: Count;
  fromHands: Count;
  dropKick: Count;
}

/**
 * Sort direction the ranks already reflect. Carried so the App can label the board correctly without a hard-coded metric table of its own.
 */
export type HigherIsBetter = boolean;

/**
 * In-possession category of the Phases of Play page. The eight shares sum to approximately 100%.
 */
export type InPossessionPhase =
  | "build-up-unopposed"
  | "build-up-opposed"
  | "progression"
  | "final-third"
  | "long-ball"
  | "attacking-transition"
  | "counter-attack"
  | "set-piece";

/**
 * The eight in-possession shares from the Phases of Play page. All eight are stored; none is derived by subtraction (AD-5).
 */
export interface InPossessionPhases {
  buildUpUnopposed: Percentage;
  buildUpOpposed: Percentage;
  progression: Percentage;
  finalThird: Percentage;
  longBall: Percentage;
  attackingTransition: Percentage;
  counterAttack: Percentage;
  setPiece: Percentage;
}

/**
 * Body part used for a goalkeeper intervention, from the Goal Prevention page's Intervention Body Type panel.
 */
export type InterventionBodyType = "head" | "hands" | "upper-body" | "lower-body" | "feet";

export interface InterventionBodyTypeCounts {
  head: Count;
  hands: Count;
  upperBody: Count;
  lowerBody: Count;
  feet: Count;
}

/**
 * Goalkeeper goal-prevention intervention type, from the Goal Prevention page's Intervention Type panel.
 */
export type InterventionType =
  "save-and-retain" | "save-and-deflect" | "deflect-and-retain" | "save-attempt" | "no-save-attempt";

export interface InterventionTypeCounts {
  saveAndRetain: Count;
  saveAndDeflect: Count;
  deflectAndRetain: Count;
  saveAttempt: Count;
  noSaveAttempt: Count;
}

/**
 * Domain B for both teams. contestedPossession is a match-level third share: the page prints possession as home / contested / away, and the three sum to 100, so the middle value cannot be derived from the two team values and is stored once here.
 */
export interface KeyStatisticsBlock {
  home: TeamKeyStatistics;
  away: TeamKeyStatistics;
  contestedPossession: Percentage;
}

/**
 * Kick-off instant, ISO 8601 venue-local WITH its UTC offset, so the App can render either local or absolute time without a venue timezone table.
 */
export type Kickoff = string;

/**
 * A distance in kilometres, unformatted (AD-7).
 */
export type Kilometres = number;

/**
 * A speed in kilometres per hour, unformatted (AD-7).
 */
export type KmPerHour = number;

/**
 * Every knockout tie, ordered by stage then match number.
 */
export type KnockoutResults = MatchResultRow[];

/**
 * How the match stood at each decision point. scoreAfter90 is always present; scoreAfterET and shootoutScore are null when that period was not played, and winnerTeamId is null for a drawn group match. decidedBy drives the App's Hero display.
 */
export interface KnockoutScore {
  scoreAfter90: TeamScore;
  scoreAfterET: TeamScore | null;
  shootoutScore: TeamScore | null;
  winnerTeamId: TeamId | null;
  decidedBy: DecidedBy;
}

/**
 * One ranked board. `aggregation` records how value was computed across matches, so the App never has to assume and never re-aggregates (AD-5, FR-27).
 */
export interface Leaderboard {
  metricCode: MetricCode;
  scope: LeaderboardScope;
  aggregation: AggregationSemantics;
  higherIsBetter: HigherIsBetter;
  rows: LeaderboardRows;
}

/**
 * The value normalized per match played. A derived aggregate, so it is a field (AD-5). Null when the metric is not meaningfully rateable — a maximum such as topSpeed, for instance.
 */
export type LeaderboardPerMatchValue = number | null;

/**
 * One ranked entity on a board. rank is pipeline-computed and explicit, so ties are represented honestly rather than implied by array order (AD-5). `entity` is a team on a team-scoped board and a player on a player-scoped board; `team` is the row's team — equal to entity on a team-scoped board, the player's team on a player-scoped one. The board always shows the team, so it is carried here and never fetched separately.
 */
export interface LeaderboardRow {
  rank: Rank;
  entity: EntityRef;
  team: EntityRef;
  value: LeaderboardValue;
  matchesPlayed: Count;
  perMatch: LeaderboardPerMatchValue;
}

/**
 * Rows in rank order.
 */
export type LeaderboardRows = LeaderboardRow[];

/**
 * Whether a leaderboard ranks teams or players.
 */
export type LeaderboardScope = "team" | "player";

/**
 * The ranked value, in the metric's own unit. Unformatted (AD-7); the App applies the unit and number format from its locale layer, keyed by metricCode.
 */
export type LeaderboardValue = number;

/**
 * Every ranked board the Leaderboards surface shows. Boards are keyed by a CLOSED metricCode enum: Story 2.13 maps each code to its locale label, so an unknown code is a TypeScript compile error by design (AD-2). Rows carry every column the App may show — the responsive rule hides columns behind a disclosure, it never re-fetches.
 */
export interface Leaderboards {
  schemaVersion: LeaderboardsSchemaVersion;
  boards: Boards;
}

export type LeaderboardsSchemaVersion = 1;

export interface Lineup {
  formation: Formation;
  starters: Starters;
  substitutes: Substitutes;
}

/**
 * One named player in a team sheet. playerId is mandatory on every entry — EXPERIENCE.md links each lineup name to its Player Profile.
 */
export interface LineupEntry {
  playerId: PlayerId;
  name: LineupEntryName;
  shirtNumber: ShirtNumber;
  position: Position;
  substitutedOn: SubstitutedOn;
  substitutedOff: SubstitutedOff;
  goals: LineupEntryGoalMinutes;
  cards: LineupEntryCards;
}

export type LineupEntryCards = CardRecord[];

/**
 * Minutes at which this player scored. Own goals are NOT listed here; they appear in metadata.goals attributed to the benefiting team.
 */
export type LineupEntryGoalMinutes = MinuteStamp[];

/**
 * Player name as the lineup block prints it (given name plus upper-case surname).
 */
export type LineupEntryName = string;

export interface Lineups {
  home: Lineup;
  away: Lineup;
}

/**
 * One match, complete: Domains A-G plus the pre-rendered per-team storyStats the Hero Layer shows. This is the only artifact a match route fetches (AD-4). Every aggregate, distribution, percentage and total is a field — the App never sums or averages (AD-5).
 */
export interface MatchBundle {
  schemaVersion: MatchBundleSchemaVersion;
  matchId: MatchId;
  metadata: MatchMetadata;
  storyStats: StoryStatsBlock;
  momentum: Momentum;
  keyStatistics: KeyStatisticsBlock;
  tacticalIdentity: TacticalIdentityBlock;
  events: EventTables;
  goalkeeping: GoalkeepingBlock;
  setPlays: SetPlaysBlock;
  players: PlayerRecords;
}

/**
 * Stamped from /contract/version.json. One global integer, declared exactly once (AD-2).
 */
export type MatchBundleSchemaVersion = 1;

/**
 * Calendar date of the match, venue-local, ISO 8601 (AD-7).
 */
export type MatchDate = string;

export type MatchEntities = MatchEntity[];

/**
 * One match in the route manifest and the search index. The IA specifies match search results as teams plus score plus stage.
 */
export interface MatchEntity {
  matchId: MatchId;
  stage: Stage;
  homeTeam: EntityRef;
  awayTeam: EntityRef;
  score: TeamScore;
}

/**
 * Group letter for a group-stage match, null for every knockout tie.
 */
export type MatchGroup = Group | null;

/**
 * Entity id and URL slug of a match (AD-3): m{NNN}-{homeTeamId}-{awayTeamId}. The match number is zero-padded to three digits so lexicographic order equals numeric order — see the logged decision in contract/README.md.
 */
export type MatchId = string;

/**
 * Domain A. Team ordering is explicit and load-bearing: DESIGN.md's two-team accent rule assigns accent A to the home / first-listed team, so it must be encoded, never inferred from key order. `score` is the final score as the cover prints it — after extra time when extra time was played, otherwise after 90; the per-period breakdown lives in `knockoutScore`.
 */
export interface MatchMetadata {
  matchNumber: MatchNumber;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: TeamScore;
  knockoutScore: KnockoutScore;
  stage: Stage;
  group: MatchGroup;
  matchdayRound: MatchdayRound;
  venue: Venue;
  date: MatchDate;
  kickoff: Kickoff;
  lineups: Lineups;
  goals: Goals;
}

/**
 * Match number within the tournament, 1-104, as printed on the cover stage line.
 */
export type MatchNumber = number;

/**
 * Result of a match from one team's point of view, used by standings form sequences.
 */
export type MatchResult = "win" | "draw" | "loss";

/**
 * One completed match as the Hub and the header search see it. Carries everything the search result and the <title>/OG string need — teams, score and stage — so neither has to fetch the Match Bundle.
 */
export interface MatchResultRow {
  matchId: MatchId;
  matchNumber: ResultMatchNumber;
  stage: Stage;
  group: ResultGroup;
  matchdayRound: MatchdayRound;
  date: ResultDate;
  kickoff: ResultKickoff;
  venue: ResultVenue;
  homeTeam: EntityRef;
  awayTeam: EntityRef;
  score: TeamScore;
  knockoutScore: KnockoutScore;
}

/**
 * The stratification round a match belongs to. Group matchdays are derived corpus-wide (pipeline.discover.rounds), not printed.
 */
export type MatchdayRound =
  "group-md1" | "group-md2" | "group-md3" | "r32" | "r16" | "qf" | "sf" | "third-place" | "final";

/**
 * A distance in metres, unformatted (AD-7). The unit is fixed by the type, never carried as text.
 */
export type Metres = number;

/**
 * Closed leaderboard metric vocabulary. NOT printed in the corpus — derived from the Domain B (team) and Domain G (player) field names, and deliberately kept string-identical to them so a board's code names the artifact field it ranks. Story 2.13 maps each code to a locale label, so an unknown code is a compile error by design (AD-2).
 */
export type MetricCode =
  | "ballProgressions"
  | "completedLineBreaks"
  | "crosses"
  | "crossesCompleted"
  | "defensiveLineBreaks"
  | "defensivePressures"
  | "distanceCovered"
  | "duelsWonAerial"
  | "duelsWonPhysical"
  | "expectedGoals"
  | "forcedTurnovers"
  | "goals"
  | "highSpeedRuns"
  | "interceptions"
  | "lineBreaksCompleted"
  | "passCompletion"
  | "passes"
  | "passesCompleted"
  | "possession"
  | "possessionRegains"
  | "receptionsInFinalThird"
  | "secondBalls"
  | "shots"
  | "shotsOnTarget"
  | "sprintDistance"
  | "sprints"
  | "stepIns"
  | "switchesOfPlay"
  | "tackles"
  | "takeOns"
  | "topSpeed";

/**
 * Clock minute of an event, capped at the end of the period it fell in. Stoppage time is carried separately in stoppageMinute so no display string is ever stored (AD-7). Extra time runs to 120, confirmed against PMSR-M96-SUI-V-COL.
 */
export type Minute = number;

/**
 * A point on the match clock. Ordering is by (minute, stoppageMinute) — the roving-tabindex keyboard navigation over pitch markers depends on it.
 */
export interface MinuteStamp {
  minute: Minute;
  stoppageMinute: StoppageMinute;
}

export type Momentum = MomentumSeries | null;

export type MomentumAwayValue = number;

export type MomentumHomeValue = number;

/**
 * One sampled point on the momentum axis. EXPERIENCE.md's aria-valuetext announces the minute plus both teams' values, which is exactly this shape.
 */
export interface MomentumSample {
  minute: Minute;
  home: MomentumHomeValue;
  away: MomentumAwayValue;
}

export type MomentumSamples = MomentumSample[];

export interface MomentumSeries {
  samples: MomentumSamples;
}

/**
 * One player's offers, split across the six movement types.
 */
export interface OfferMovementCounts {
  inFront: Count;
  inBetween: Count;
  outToIn: Count;
  inToOut: Count;
  inBehind: Count;
  noMovement: Count;
}

/**
 * Offer movement type, from the 'Offer movement types' column group on the In Possession - Offers & Receptions page.
 */
export type OfferMovementType = "in-front" | "in-between" | "out-to-in" | "in-to-out" | "in-behind" | "no-movement";

/**
 * Out-of-possession category of the Phases of Play page. The nine shares sum to approximately 100%.
 */
export type OutOfPossessionPhase =
  | "high-press"
  | "mid-press"
  | "low-press"
  | "high-block"
  | "mid-block"
  | "low-block"
  | "recovery"
  | "defensive-transition"
  | "counter-press";

/**
 * The nine out-of-possession shares from the Phases of Play page.
 */
export interface OutOfPossessionPhases {
  highPress: Percentage;
  midPress: Percentage;
  lowPress: Percentage;
  highBlock: Percentage;
  midBlock: Percentage;
  lowBlock: Percentage;
  recovery: Percentage;
  defensiveTransition: Percentage;
  counterPress: Percentage;
}

/**
 * A directed passing relationship between two players. DESIGN.md maps volume onto the edge-weight ramp.
 */
export interface PassNetworkEdge {
  teamId: TeamId;
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  volume: PassNetworkEdgeVolume;
}

/**
 * Number of completed passes along this edge. Always at least 1 — a zero-volume edge is simply absent.
 */
export type PassNetworkEdgeVolume = number;

export type PassNetworkEdges = PassNetworkEdge[];

/**
 * One player's average position on the pass-network map. x and y are extracted from the page, never derived from the edges (Story 1.14). `involvement` is the total passes this player was involved in, made plus received — a derived aggregate and therefore a field (AD-5), which DESIGN.md encodes as node size.
 */
export interface PassNetworkNode {
  teamId: TeamId;
  playerId: PlayerId;
  playerName: PassNetworkNodeName;
  shirtNumber: ShirtNumber;
  x: PitchX;
  y: PitchY;
  involvement: Count;
}

export type PassNetworkNodeName = string;

export type PassNetworkNodes = PassNetworkNode[];

/**
 * The value normalized to 90 minutes played. Null when the metric is a maximum or a percentage, where a per-90 rate is meaningless.
 */
export type PerNinety = number | null;

/**
 * A percentage on a 0-100 scale, unformatted (AD-7).
 */
export type Percentage = number;

/**
 * A tournament-wide average share for one phase category.
 */
export interface PhaseShare {
  share: Percentage;
}

/**
 * Tournament physical totals plus the maxima. Distances are the sums over matches played; topSpeed is the maximum, never a mean.
 */
export interface PhysicalProfile {
  totalDistance: Metres;
  distanceZone1: Metres;
  distanceZone2: Metres;
  distanceZone3: Metres;
  distanceZone4: Metres;
  distanceZone5: Metres;
  highSpeedRuns: Count;
  sprints: Count;
  topSpeed: KmPerHour;
}

/**
 * Side of the pitch a corner was taken from ('From Left Side' / 'From Right Side'). Side counts sum to the corner total.
 */
export type PitchSide = "left" | "right";

/**
 * Pitch-frame x coordinate (AD-6): 0-100 over the FULL pitch rectangle, oriented to the acting team's attack direction, x=100 at the opponent's goal line.
 */
export type PitchX = number;

/**
 * Pitch-frame y coordinate (AD-6): 0-100 over the FULL pitch rectangle, y=0 at the attacking team's left touchline.
 */
export type PitchY = number;

/**
 * Headline numbers. Each carries the aggregation that produced it, so FR-27's 'aggregates equal the correct aggregation' is checkable from the artifact alone rather than from a convention the App has to remember.
 */
export type PlayerAggregates = AggregateMetric[];

export type PlayerEntities = PlayerEntity[];

/**
 * One player in the route manifest and the search index. The IA specifies player search results as name plus team, so the team reference is carried here rather than fetched.
 */
export interface PlayerEntity {
  playerId: PlayerId;
  name: PlayerEntityName;
  team: EntityRef;
  position: Position;
}

export type PlayerEntityName = string;

/**
 * Entity id and URL slug of a player (AD-3): {surname}-{givenName}-{teamCode}, name order as listed in the source lineup.
 */
export type PlayerId = string;

/**
 * Domain G, in-possession half.
 */
export interface PlayerInPossession {
  passesAttempted: Count;
  passesCompleted: Count;
  passCompletion: Percentage;
  switchesOfPlay: Count;
  crossesAttempted: Count;
  crossesCompleted: Count;
  lineBreaksAttempted: Count;
  lineBreaksCompleted: Count;
  lineBreakCompletion: Percentage;
  ballProgressions: Count;
  takeOns: Count;
  stepIns: Count;
  attemptsAtGoal: Count;
  goals: Count;
  totalOffers: Count;
  offersByMovementType: OfferMovementCounts;
  offersReceived: Count;
}

export type PlayerMatchDate = string;

export interface PlayerMatchRow {
  matchId: MatchId;
  stage: Stage;
  date: PlayerMatchDate;
  opponent: EntityRef;
  started: PlayerMatchStarted;
  minutesPlayed: Count;
  goals: Count;
  attemptsAtGoal: Count;
  passesAttempted: Count;
  passesCompleted: Count;
  passCompletion: Percentage;
  ballProgressions: Count;
  duelsWonAerial: Count;
  duelsWonPhysical: Count;
  totalDistance: Metres;
  topSpeed: KmPerHour;
}

/**
 * One row per match with minutes, chronological. Each carries matchId so every value links back to the match it came from.
 */
export type PlayerMatchRows = PlayerMatchRow[];

export type PlayerMatchStarted = boolean;

/**
 * Domain G, out-of-possession half. tacklesMade and tacklesWon are the two halves of the page's 'Tackles Made / Won' column.
 */
export interface PlayerOutOfPossession {
  tacklesMade: Count;
  tacklesWon: Count;
  blocks: Count;
  interceptions: Count;
  pressingDirect: Count;
  pressingIndirect: Count;
  duelsWonAerial: Count;
  duelsWonPhysical: Count;
  possessionContestsWon: Count;
  clearances: Count;
  looseBallReceptions: Count;
  pushingOn: Count;
  pushingOnIntoPressing: Count;
  possessionRegains: Count;
  possessionInterrupted: Count;
}

/**
 * Domain G, physical half. Distances are metres, as the Physical Data page prints them. The speed zones are the page's own bands: distanceZone1 is 0-7 km/h, distanceZone2 is 7-15, distanceZone3 is 15-20, distanceZone4 is 20-25, distanceZone5 is 25+. highSpeedRuns counts Zone 3 runs; sprints counts Zone 4 and 5 runs.
 */
export interface PlayerPhysical {
  totalDistance: Metres;
  distanceZone1: Metres;
  distanceZone2: Metres;
  distanceZone3: Metres;
  distanceZone4: Metres;
  distanceZone5: Metres;
  highSpeedRuns: Count;
  sprints: Count;
  topSpeed: KmPerHour;
}

/**
 * One player across the whole tournament: headline aggregates with their aggregation semantics declared per metric (FR-27), a per-match series, a physical profile, and cross-match trends. Every value is precomputed — the App never aggregates (AD-5).
 */
export interface PlayerProfile {
  schemaVersion: PlayerProfileSchemaVersion;
  playerId: PlayerId;
  name: PlayerProfileName;
  team: EntityRef;
  position: Position;
  shirtNumber: ShirtNumber;
  appearances: Appearances;
  aggregates: PlayerAggregates;
  physical: PhysicalProfile;
  matches: PlayerMatchRows;
  trends: PlayerTrends;
}

export type PlayerProfileName = string;

export type PlayerProfileSchemaVersion = 1;

/**
 * Domain G, one player. Every field the Expert Layer's per-player tables show is here — there is no reduced variant.
 */
export interface PlayerRecord {
  teamId: TeamId;
  playerId: PlayerId;
  playerName: PlayerRecordName;
  shirtNumber: ShirtNumber;
  position: Position;
  inPossession: PlayerInPossession;
  outOfPossession: PlayerOutOfPossession;
  physical: PlayerPhysical;
}

export type PlayerRecordName = string;

/**
 * One entry per player with minutes, both teams, ordered home team first then by shirt number.
 */
export type PlayerRecords = PlayerRecord[];

/**
 * Cross-match series the profile charts. One entry per charted metric.
 */
export type PlayerTrends = TrendSeries[];

/**
 * Playing position as printed in the lineup block (GK / DF / MF / FW), lowercased.
 */
export type Position = "gk" | "df" | "mf" | "fw";

/**
 * Breakdown categories of the Possession Contests panel on the Defensive Actions page.
 */
export type PossessionContestType =
  "pass" | "attempt-at-goal" | "cross" | "clearance" | "physical-duel" | "aerial-duel";

/**
 * A distance measured separately in and out of possession.
 */
export interface PossessionSplitMetres {
  inPossession: Metres;
  outOfPossession: Metres;
}

/**
 * Mean defensive pressures applied per match.
 */
export type PressingIntensity = number;

/**
 * Explicit pipeline-computed rank, 1-based. Never derived from array position by the App (AD-5).
 */
export type Rank = number;

/**
 * One offer to receive or movement to receive. The type discriminator is what lets the two pitch maps share a single event shape — Story 2.9 renders #offers-to-receive and #movement-to-receive from the same array.
 */
export interface ReceivingEvent {
  teamId: TeamId;
  playerId: PlayerId;
  playerName: ReceivingPlayerName;
  type: ReceivingEventType;
  movementType: ReceivingMovementType;
  at: MinuteStamp;
  x: PitchX;
  y: PitchY;
}

/**
 * Discriminator separating the 'Offering to Receive' and 'Movement to Receive' pitch maps, which share one event shape.
 */
export type ReceivingEventType = "offer" | "movement";

export type ReceivingEvents = ReceivingEvent[];

/**
 * Offer movement category, null when the report does not classify this event.
 */
export type ReceivingMovementType = OfferMovementType | null;

export type ReceivingPlayerName = string;

export type ResultDate = string;

export type ResultGroup = Group | null;

export type ResultKickoff = string;

export type ResultMatchNumber = number;

export type ResultVenue = string;

export interface SetPlaysBlock {
  home: TeamSetPlays;
  away: TeamSetPlays;
}

/**
 * Squad number as printed beside the player's name in the lineup block.
 */
export type ShirtNumber = number;

export interface ShootoutAttempt {
  teamId: TeamId;
  playerId: PlayerId;
  playerName: ShootoutPlayerName;
  order: ShootoutOrder;
  outcome: ShootoutOutcome;
}

export type ShootoutAttempts = ShootoutAttempt[] | null;

/**
 * 1-based position in the shoot-out sequence, across both teams.
 */
export type ShootoutOrder = number;

/**
 * Result of one penalty shoot-out attempt.
 */
export type ShootoutOutcome = "scored" | "saved" | "missed";

export type ShootoutPlayerName = string;

/**
 * How the ball arrived for a shot, from the shots event table's Delivery Type column. 'penalty' here is an in-play penalty kick; shoot-out attempts are never shots (see ShootoutAttempt).
 */
export type ShotDeliveryType =
  | "pass"
  | "cross"
  | "corner"
  | "free-kick"
  | "penalty"
  | "loose-ball"
  | "ball-progression"
  | "interception"
  | "tackle"
  | "other";

/**
 * One attempt at goal, plotted on the shots pitch map. Shoot-out attempts never appear here — they would break marker-count self-validation and Story 2.7 never plots them.
 */
export interface ShotEvent {
  teamId: TeamId;
  playerId: PlayerId;
  playerName: ShotPlayerName;
  at: MinuteStamp;
  x: PitchX;
  y: PitchY;
  outcome: ShotOutcome;
  outcomeDetail: ShotOutcomeDetail;
  bodyPart: BodyPart;
  deliveryType: ShotDeliveryType;
  expectedGoals: ShotExpectedGoals;
  ownGoal: ShotOwnGoal;
}

export type ShotEvents = ShotEvent[];

export type ShotExpectedGoals = ExpectedGoals | null;

/**
 * The five-value marker outcome that the shots pitch map encodes as an exact fill colour. Ground truth is spike/extract.py's RGB map: (0.00,0.50,0.00)=goal, (0.36,0.61,0.84)=on-target, (0.96,0.74,0.00)=off-target, (0.70,0.53,1.00)=blocked, (0.18,0.30,1.00)=incomplete.
 */
export type ShotOutcome = "goal" | "on-target" | "off-target" | "blocked" | "incomplete";

/**
 * The compound Outcome label printed in the shots event table, which is finer than the five-value marker colour. Closed against all 104 reports on 2026-07-22; provenance table in contract/README.md.
 */
export type ShotOutcomeDetail =
  | "deflected-off-target"
  | "deflected-off-target-defensive-event"
  | "deflected-off-target-referee-event"
  | "deflected-off-target-saved"
  | "deflected-on-target-defensive-event"
  | "deflected-on-target-goal"
  | "deflected-on-target-goal-prevented"
  | "deflected-on-target-saved"
  | "incomplete-assist"
  | "incomplete-blocked"
  | "incomplete-defensive-event"
  | "incomplete-foul-for"
  | "incomplete-player-on-ball-error"
  | "incomplete-referee-event"
  | "off-target"
  | "off-target-defensive-event"
  | "off-target-player-on-ball-error"
  | "off-target-saved"
  | "on-target-defensive-event"
  | "on-target-goal"
  | "on-target-goal-prevented"
  | "on-target-saved";

export type ShotOwnGoal = boolean;

export type ShotPlayerName = string;

/**
 * Tournament stage code (AD-3). Knockout codes are exactly pipeline.discover.rounds.KNOCKOUT_ROUNDS. 'third-place' is the corpus's 'Bronze final'.
 */
export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third-place" | "final";

/**
 * Rows in rank order.
 */
export type Standings = StandingsRow[];

/**
 * One team's row in a group table. rank is computed by the pipeline implementing the full FIFA tiebreaker cascade and is never derived from array position by the App (AD-4, AD-5). The column set is exactly the one EXPERIENCE.md's i18n table names.
 */
export interface StandingsRow {
  rank: Rank;
  team: EntityRef;
  played: Count;
  won: Count;
  drawn: Count;
  lost: Count;
  goalsFor: Count;
  goalsAgainst: Count;
  goalDifference: GoalDifference;
  points: Count;
  form: FormSequence;
}

export type Starters = LineupEntry[];

/**
 * Minutes into stoppage time, or null when the event did not fall in stoppage time. The corpus prints '90+2'; that is minute 90, stoppageMinute 2. The App composes the label in its locale layer (AD-7).
 */
export type StoppageMinute = number | null;

/**
 * The five Hero Layer tiles for one team (FR-21). Exactly five fields — Story 2.4 renders exactly five tiles. All five are aggregates, so AD-5 requires them precomputed and shipped, never summed in the browser.
 */
export interface StoryStats {
  possession: Percentage;
  shots: Count;
  expectedGoals: ExpectedGoals;
  distanceCovered: Kilometres;
  topSpeed: KmPerHour;
}

export interface StoryStatsBlock {
  home: StoryStats;
  away: StoryStats;
}

export type SubstitutedOff = MinuteStamp | null;

export type SubstitutedOn = MinuteStamp | null;

export type Substitutes = LineupEntry[];

export interface TacticalIdentityBlock {
  home: TeamTacticalIdentity;
  away: TeamTacticalIdentity;
}

/**
 * Three-letter lowercase team code, as printed in the PMSR filenames (PMSR-M01-MEX-V-RSA).
 */
export type TeamCode = string;

export type TeamEntities = TeamEntity[];

/**
 * One team in the route manifest and the search index.
 */
export interface TeamEntity {
  teamId: TeamId;
  name: TeamEntityName;
  teamCode: TeamCode;
  group: Group;
  record: TeamRecord;
}

export type TeamEntityName = string;

/**
 * Entity id and URL slug of a team (AD-3). Lowercase ASCII kebab, accent-stripped. An id once emitted never changes.
 */
export type TeamId = string;

/**
 * Domain B, one team. Nineteen fields, matching the Match Summary - Key Statistics page row for row; compound rows such as 'Total Passes (Complete)' and 'Defensive Pressures Applied (Direct Pressures)' are split into their two numbers rather than stored as a formatted string (AD-7). `sprintDistance` is the page's second distance row, 'Zone 4 - Low Speed Sprinting: 20-25 km/h'.
 */
export interface TeamKeyStatistics {
  possession: Percentage;
  goals: Count;
  expectedGoals: ExpectedGoals;
  shots: Count;
  shotsOnTarget: Count;
  passes: Count;
  passesCompleted: Count;
  passCompletion: Percentage;
  completedLineBreaks: Count;
  defensiveLineBreaks: Count;
  receptionsInFinalThird: Count;
  crosses: Count;
  ballProgressions: Count;
  defensivePressures: Count;
  directPressures: Count;
  forcedTurnovers: Count;
  secondBalls: Count;
  distanceCovered: Kilometres;
  sprintDistance: Kilometres;
}

/**
 * This team's headline numbers in one match, plus the identity of that match so every row links back.
 */
export interface TeamMatchBreakdown {
  matchId: MatchId;
  stage: Stage;
  date: TeamMatchDate;
  opponent: EntityRef;
  isHome: TeamMatchIsHome;
  result: MatchResult;
  goalsFor: Count;
  goalsAgainst: Count;
  formation: TeamMatchFormation;
  possession: Percentage;
  expectedGoals: ExpectedGoals;
  shots: Count;
  shotsOnTarget: Count;
  passCompletion: Percentage;
  distanceCovered: Kilometres;
}

/**
 * One row per match played, chronological. Each carries matchId for the mandatory cross-link back to the match route.
 */
export type TeamMatchBreakdowns = TeamMatchBreakdown[];

export type TeamMatchDate = string;

export type TeamMatchFormation = string;

/**
 * Whether this team was the home / first-listed side, which is what DESIGN.md's accent rule keys on.
 */
export type TeamMatchIsHome = boolean;

/**
 * Team name exactly as the cover scoreline prints it. A proper noun, not a translated label (AD-7).
 */
export type TeamName = string;

/**
 * One team across the whole tournament: tournament-wide tactical identity, formation usage, and a per-match breakdown row for every match played. Every value here is a cross-match aggregate, which AD-5 requires the pipeline to compute — the App never sums a team's matches.
 */
export interface TeamProfile {
  schemaVersion: TeamProfileSchemaVersion;
  teamId: TeamId;
  name: TeamProfileName;
  teamCode: TeamCode;
  group: Group;
  record: TeamTournamentRecord;
  tacticalIdentity: AggregateTacticalIdentity;
  formationUsage: FormationUsage;
  matches: TeamMatchBreakdowns;
}

export type TeamProfileGoalDifference = number;

export type TeamProfileName = string;

export type TeamProfileSchemaVersion = 1;

/**
 * A team's tournament record. The IA specifies team search results as name plus tournament record, and <title>/OG for a team route as name plus record — so this is a derived aggregate that must be a field (AD-5).
 */
export interface TeamRecord {
  played: Count;
  won: Count;
  drawn: Count;
  lost: Count;
  goalsFor: Count;
  goalsAgainst: Count;
}

/**
 * Identity of one of the two teams in this match.
 */
export interface TeamRef {
  teamId: TeamId;
  teamCode: TeamCode;
  name: TeamName;
}

/**
 * A home/away goal pair at one point in a match.
 */
export interface TeamScore {
  home: Count;
  away: Count;
}

/**
 * Domain F, one team.
 */
export interface TeamSetPlays {
  totalSetPlays: Count;
  totalFreeKicks: Count;
  totalPenalties: Count;
  totalCorners: Count;
  totalThrowIns: Count;
  freeKicks: FreeKickCounts;
  cornersByDeliveryType: CornerDeliveryTypeCounts;
  cornersByDeliveryStyle: CornerDeliveryStyleCounts;
}

/**
 * Domain C, one team.
 */
export interface TeamTacticalIdentity {
  phasesInPossession: InPossessionPhases;
  phasesOutOfPossession: OutOfPossessionPhases;
  lineHeight: PossessionSplitMetres;
  teamLength: PossessionSplitMetres;
  defensiveBlockDistribution: DefensiveBlockDistribution;
}

/**
 * A team's record across the tournament. `points` counts group-stage points only; knockout ties award none.
 */
export interface TeamTournamentRecord {
  played: Count;
  won: Count;
  drawn: Count;
  lost: Count;
  goalsFor: Count;
  goalsAgainst: Count;
  goalDifference: TeamProfileGoalDifference;
  points: Count;
  furthestStage: Stage;
}

/**
 * Sub-categories of the Throw Distribution panel.
 */
export type ThrowDistributionTechnique = "over-arm" | "under-arm" | "side-arm" | "chest";

export interface ThrowTechniqueCounts {
  overArm: Count;
  underArm: Count;
  sideArm: Count;
  chest: Count;
}

/**
 * The tournament index. Three load-bearing jobs, all served by this one file: (1) results and standings by stage and group; (2) the route manifest generateStaticParams reads at build time (AD-11), where AR-4 asserts one profile artifact per listed entity; (3) the source for the header typeahead and for the <title>/OG metadata composed at build time.
 */
export interface Tournament {
  schemaVersion: TournamentSchemaVersion;
  tournamentName: TournamentName;
  groups: GroupTables;
  knockoutResults: KnockoutResults;
  entities: EntityIndex;
}

/**
 * Proper name of the tournament. A proper noun, not a translated label (AD-7).
 */
export type TournamentName = string;

export type TournamentSchemaVersion = 1;

export interface TrendPoint {
  matchId: MatchId;
  value: TrendPointValue;
}

export type TrendPointValue = number;

/**
 * Chronological, one point per match played.
 */
export type TrendPoints = TrendPoint[];

export interface TrendSeries {
  metricCode: MetricCode;
  points: TrendPoints;
}

export type UsedFormation = string;

/**
 * Venue name as the cover prints it. Sixteen distinct venues across the corpus.
 */
export type Venue = string;
