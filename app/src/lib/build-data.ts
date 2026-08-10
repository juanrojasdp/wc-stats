import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  Leaderboards,
  MatchBundle,
  PlayerProfile,
  TeamProfile,
  Tournament,
} from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";

/*
 * Build-time-ONLY data reader (AR-11, AD-11). generateStaticParams and
 * generateMetadata read the fixtures straight off the filesystem at build; the
 * runtime path is the client fetch in src/lib/data.ts. This module must NEVER
 * be imported from client code — eslint.config.mjs bars it from
 * src/components/**, mirroring the t() seam.
 *
 * DATA_ROOT: FLIPPED TO REAL DATA BY STORY 2.19 — this resolved to
 * ../data/fixtures until the cutover. This constant and DATA_ROOT in
 * src/lib/data.ts are the TWO cutover points and MUST agree; flipping one
 * without the other splits the build-time and runtime views of the same match,
 * silently. `data-root-agreement.test.ts` is the guard that enforces it, which
 * is why the resolved root is exported below rather than re-derived there.
 */
const DATA_ROOT = path.join(process.cwd(), "..", "data");

/**
 * The RESOLVED build-time root, exported for exactly one consumer: the
 * two-constant guard in `data-root-agreement.test.ts` (ledger L133, ruled D1).
 *
 * It is exported rather than re-derived in the test on purpose. A test that
 * rebuilds `path.join(cwd, "..", "data")` for itself asserts its own literal
 * against its own literal and stays green through the exact edit it exists to
 * catch — that is how you build a guard that cannot fail.
 */
export const BUILD_DATA_ROOT = DATA_ROOT;

function readJson<T>(relativePath: string): T {
  const absolutePath = path.join(DATA_ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    // A bare ENOENT here names a path but not the assumption that produced it.
    // DATA_ROOT is cwd-relative, so running next/vitest from the repo root
    // instead of app/ resolves it to a sibling of the repository — say so.
    throw new Error(
      `build-data: ${relativePath} not found under ${DATA_ROOT}. ` +
        `DATA_ROOT is resolved from process.cwd() (${process.cwd()}), which must be the app/ directory.`
    );
  }
  return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

/** The route manifest and index, read at build time from tournament.json. */
export function readTournament(): Tournament {
  return readJson<Tournament>(path.join("index", "tournament.json"));
}

/** One match's full bundle, read at build time. `matchId` is the route slug. */
export function readMatchBundle(matchId: string): MatchBundle {
  return readJson<MatchBundle>(path.join("matches", `${matchId}.json`));
}

/**
 * The leaderboards artifact, read at build time for the hero-altitude teasers
 * (Story 2.13, AD-11).
 *
 * The teasers are PRE-RENDERED from this read; the full sortable tables come
 * from the client fetch in `LeaderboardsRegion`, which is the one artifact
 * FR-26's "initially loaded index" permits. Reading it here as well costs no
 * extra request — it is inlined into the exported HTML.
 */
export function readLeaderboards(): Leaderboards {
  const payload = readJson<Leaderboards>(path.join("index", "leaderboards.json"));
  /*
   * GATED LIKE THE RUNTIME PATH (Story 2.13 code review). `LeaderboardsRegion`
   * refuses to render a payload whose schemaVersion does not match and shows the
   * "invalid" panel; this path gated on nothing, so the two halves of one screen
   * could contradict each other — pre-rendered teaser cards full of real names
   * and figures sitting above a panel saying the data does not match this
   * version. A build-time read has a better answer available than the runtime
   * one: FAIL THE BUILD. A static export that cannot state its own schema is not
   * one worth publishing, and `readJson` above already treats a missing artifact
   * the same way.
   */
  if (payload.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `build-data: leaderboards.json is at schemaVersion ${String(payload.schemaVersion)}, ` +
        `but this build expects ${String(SCHEMA_VERSION)}.`
    );
  }
  return payload;
}

/**
 * One player's profile artifact, read at build time for the pre-rendered Hero
 * and for `<title>`/OG (Story 2.15, AD-11). `playerId` IS the route slug (AD-3).
 *
 * IT FAILS LOUD TWICE, and both throws are load-bearing at 2.19's scale.
 *
 * The first is `readJson`'s not-found throw. `generateStaticParams` maps the
 * route manifest 1:1 with NO existence filter (ruled D10) precisely so that a
 * listed player with no artifact BREAKS THE BUILD rather than silently
 * disappearing from the site: AD-4's bijection ("one profile artifact per listed
 * entity — empty sections allowed, absence not") is pipeline-asserted, and a
 * filter here would convert a real pipeline breach into 1,247 routes that look
 * complete.
 *
 * The second is the `schemaVersion` gate, on `readLeaderboards`' pattern and for
 * its reason. `PlayerProfileRegion` refuses a mismatched payload at runtime and
 * shows the "invalid" panel; a build-time read that gated on nothing would let
 * the two halves of one screen contradict each other — a pre-rendered Hero full
 * of real figures above a panel saying the data does not match this version. A
 * static export that cannot state its own schema is not one worth publishing.
 */
export function readPlayerProfile(playerId: string): PlayerProfile {
  const payload = readJson<PlayerProfile>(
    path.join("index", "player-profiles", `${playerId}.json`)
  );
  /*
   * THE IDENTITY GATE, added at code review 2026-08-07 — `PlayerProfileRegion`
   * gates on BOTH `playerId` and `schemaVersion` at the fetch boundary, and this
   * read gated on only one. A mis-keyed or stale artifact therefore pre-rendered
   * player A's name, title and OG tags above a runtime panel reporting the data
   * invalid: verbatim the two-halves-of-one-screen-contradicting-each-other
   * failure the version gate below exists to prevent, reached through the other
   * field. AD-3 makes `playerId` the slug and the filename stem, so disagreement
   * here is a pipeline breach and must break the build.
   */
  if (payload.playerId !== playerId) {
    throw new Error(
      `build-data: player-profiles/${playerId}.json carries playerId ` +
        `${JSON.stringify(payload.playerId)}; the id, the filename and the route slug are ` +
        `one value (AD-3).`
    );
  }
  if (payload.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `build-data: player-profiles/${playerId}.json is at schemaVersion ` +
        `${String(payload.schemaVersion)}, but this build expects ${String(SCHEMA_VERSION)}.`
    );
  }
  return payload;
}

/**
 * One team's profile artifact, read at build time for the pre-rendered Hero and
 * for `<title>`/OG (Story 2.16, AD-11). `teamId` IS the route slug (AD-3).
 *
 * `readPlayerProfile`'s SHAPE VERBATIM, both throws included, because both are
 * load-bearing for the same reasons at this route's scale.
 *
 * The first is `readJson`'s not-found throw, which `generateStaticParams` relies
 * on: it maps `entities.teams` 1:1 with NO existence filter (ruled D5), so a
 * listed team with no artifact BREAKS THE BUILD rather than silently vanishing
 * from the site. AD-4's bijection ("one profile artifact per listed entity —
 * empty sections allowed, absence not") is pipeline-asserted and green at 48↔48
 * with zero mismatches, and a filter here would convert a real pipeline breach
 * into 47 routes that look complete.
 *
 * The second is the `schemaVersion` gate. `TeamProfileRegion` refuses a
 * mismatched payload at runtime and shows the "invalid" panel with NO retry ("a
 * retry cannot change the answer"); a build-time read that gated on nothing
 * would let the two halves of one screen contradict each other — a pre-rendered
 * Hero full of real figures above a panel saying the data does not match this
 * version. A static export that cannot state its own schema is not one worth
 * publishing.
 */
export function readTeamProfile(teamId: string): TeamProfile {
  const payload = readJson<TeamProfile>(path.join("index", "team-profiles", `${teamId}.json`));
  if (payload.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `build-data: team-profiles/${teamId}.json is at schemaVersion ` +
        `${String(payload.schemaVersion)}, but this build expects ${String(SCHEMA_VERSION)}.`
    );
  }
  return payload;
}
