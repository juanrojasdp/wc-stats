import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BUILD_DATA_ROOT } from "@/lib/build-data";
import { DATA_ROOT } from "@/lib/data";

/*
 * THE TWO-CONSTANT GUARD (Story 2.19, ledger L133, ruled decision D1).
 *
 * The app reads its corpus through two roots that nothing derives from each
 * other and no test used to compare:
 *
 *   build time  build-data.ts   path.join(cwd, "..", "data")   filesystem
 *   runtime     data.ts         "/data"                        client fetch
 *
 * `generateStaticParams`/`generateMetadata`/the Hero read the first; every
 * below-Hero region fetches the second. Flip one alone and the failure is
 * SILENT AND SPLIT: a match page pre-renders its Hero from one corpus while the
 * region under it fetches the other, or 404s. Nothing goes red — the page just
 * quietly describes two different tournaments.
 *
 * This file is why that cannot land twice.
 *
 * Note both constants are IMPORTED, never re-derived. A guard that rebuilds
 * `path.join(cwd, "..", "data")` for itself compares its own literal against its
 * own literal and survives the exact edit it exists to catch.
 */

/**
 * The corpus-relative tail of a data root: every segment from the LAST `data`
 * segment onward.
 *
 * Comparing tails, not whole strings, is what lets an absolute filesystem path
 * be compared against a site-absolute URL path. The LAST occurrence is the one
 * that matters because the repository itself may sit under a directory called
 * `data` on someone's machine; the fixtures directory is not called `data`, so
 * the last occurrence is always the root's own segment.
 */
function corpusTail(root: string): string[] {
  const segments = root.split(/[\\/]+/).filter(Boolean);
  const lastDataSegment = segments.lastIndexOf("data");
  // No `data` segment at all is itself a failure — return the whole thing so
  // the assertion reports what it actually saw rather than an empty array.
  return lastDataSegment === -1 ? segments : segments.slice(lastDataSegment);
}

describe("DATA_ROOT agreement — the two cutover points (L133, D1)", () => {
  it("resolves the build-time and runtime roots to the same corpus", () => {
    expect(corpusTail(BUILD_DATA_ROOT)).toEqual(corpusTail(DATA_ROOT));
  });

  it("has both roots on the REAL corpus, not the fixtures (the 2.19 cutover itself)", () => {
    // Agreement alone would also be satisfied by reverting both together. This
    // is the assertion that pins the flip.
    expect(corpusTail(BUILD_DATA_ROOT)).toEqual(["data"]);
    expect(corpusTail(DATA_ROOT)).toEqual(["data"]);
  });

  it("points the build-time root at a directory that actually holds the corpus", () => {
    expect(existsSync(BUILD_DATA_ROOT)).toBe(true);
    expect(existsSync(path.join(BUILD_DATA_ROOT, "index", "tournament.json"))).toBe(true);
    expect(existsSync(path.join(BUILD_DATA_ROOT, "matches"))).toBe(true);
  });

  /*
   * THE GUARD'S OWN SENSITIVITY. The three cases below are the pre-cutover and
   * half-cutover shapes verbatim; they prove this file goes red for a one-sided
   * flip in EITHER direction, which is the whole reason the ledger asked for it.
   */
  describe("goes red when either constant is flipped alone", () => {
    const REAL_BUILD = path.join("C:", "repo", "app", "..", "data");
    const REAL_RUNTIME = "/data";
    const FIXTURE_BUILD = path.join("C:", "repo", "app", "..", "data", "fixtures");
    const FIXTURE_RUNTIME = "/data/fixtures";

    it("agrees before the cutover (both on fixtures)", () => {
      expect(corpusTail(FIXTURE_BUILD)).toEqual(corpusTail(FIXTURE_RUNTIME));
    });

    it("agrees after the cutover (both on real data)", () => {
      expect(corpusTail(REAL_BUILD)).toEqual(corpusTail(REAL_RUNTIME));
    });

    it("DISAGREES when only build-data.ts is reverted", () => {
      expect(corpusTail(FIXTURE_BUILD)).not.toEqual(corpusTail(REAL_RUNTIME));
    });

    it("DISAGREES when only data.ts is reverted", () => {
      expect(corpusTail(REAL_BUILD)).not.toEqual(corpusTail(FIXTURE_RUNTIME));
    });

    it("compares the tail, not the prefix — a repo under a directory called data still agrees", () => {
      expect(corpusTail(path.join("C:", "data", "repo", "app", "..", "data"))).toEqual(["data"]);
    });
  });
});
