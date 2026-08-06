import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Leaderboards, MatchBundle, Tournament } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";

/*
 * Build-time-ONLY data reader (AR-11, AD-11). generateStaticParams and
 * generateMetadata read the fixtures straight off the filesystem at build; the
 * runtime path is the client fetch in src/lib/data.ts. This module must NEVER
 * be imported from client code — eslint.config.mjs bars it from
 * src/components/**, mirroring the t() seam.
 *
 * DATA_ROOT flip point (Story 2.19): fixtures live under /data/fixtures today.
 * This constant and DATA_ROOT in src/lib/data.ts are the TWO cutover points and
 * MUST flip together — flipping one without the other splits the build-time and
 * runtime views of the same match.
 */
const DATA_ROOT = path.join(process.cwd(), "..", "data", "fixtures");

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
