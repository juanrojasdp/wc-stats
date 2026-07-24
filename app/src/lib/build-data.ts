import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MatchBundle, Tournament } from "@/lib/contract/contract-types";

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
