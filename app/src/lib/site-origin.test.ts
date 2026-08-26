import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SITE_ORIGIN } from "@/lib/site-origin";

/*
 * THE DRIFT GATE (Story 3.1, AC1).
 *
 * AC1's second clause — "SITE_ORIGIN has exactly one definition in the
 * repository" — is prose until something fails on a second copy. Three
 * consumers derive from this constant and each is a plausible place to
 * paste the domain instead: `metadataBase` (story 3.2), the sitemap (3.4)
 * and `scripts/assert-no-external-origins.mjs`, which reads it by regex.
 *
 * A second copy drifts SILENTLY IN THE DIRECTION THAT MATTERS: the origin
 * gate would keep allow-listing the old value while the export emitted the
 * new one, so a domain change red-builds all ~1,406 pages with the same
 * error this story exists to remove.
 *
 * Everything here pins by RELATIVE PATH, never by an id a fixture could
 * share (Epic 3 standing AC A2).
 */

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Build outputs and installed packages are not source and are not scanned. */
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", "out"]);

/** The scanned scope: `src/**`, `scripts/**`, and `app/*.{ts,mjs,json,toml}`. */
const TOP_LEVEL_EXTENSIONS = new Set([".ts", ".mjs", ".json", ".toml"]);

const DEFINITION_FILE = "src/lib/site-origin.ts";

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
      continue;
    }
    yield path.join(dir, entry.name);
  }
}

function* scannedFiles(): Generator<string> {
  for (const root of ["src", "scripts"]) yield* walk(path.join(APP_DIR, root));
  for (const entry of readdirSync(APP_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (TOP_LEVEL_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield path.join(APP_DIR, entry.name);
    }
  }
}

/** POSIX-shaped so the assertion message reads the same on Windows and CI. */
const relative = (file: string) => path.relative(APP_DIR, file).split(path.sep).join("/");

/*
 * This case is I/O-bound, not logic-bound: it reads ~194 files / ~3 MB, and
 * `package-lock.json` is most of that. Standalone it runs in ~0.3 s, but under
 * the full suite — ~50 test files in parallel, several of them SPAWNING node
 * processes — it measured past vitest's 5 s default and failed on time rather
 * than on substance. Given the same headroom as the sibling gate suite's
 * SPAWN_TIMEOUT_MS, for the same reason.
 */
const IO_TIMEOUT_MS = 20_000;

describe("SITE_ORIGIN", () => {
  it("is a bare origin — no trailing slash, no path (enforced again at 3.2 and 2.4)", () => {
    expect(new URL(SITE_ORIGIN).origin).toBe(SITE_ORIGIN);
    expect(SITE_ORIGIN.startsWith("https://")).toBe(true);
  });

  it(`has EXACTLY ONE occurrence under app/, and it is ${DEFINITION_FILE} (AC1)`, () => {
    const occurrences: string[] = [];
    let total = 0;

    for (const file of scannedFiles()) {
      const count = readFileSync(file, "utf8").split(SITE_ORIGIN).length - 1;
      if (count === 0) continue;
      total += count;
      occurrences.push(`${relative(file)} (${count})`);
    }

    /*
     * Asserted as a joined string rather than a count so the failure names
     * EVERY offending file and how many copies each holds — a bare
     * `expect(total).toBe(1)` would report "2 !== 1" and send the reader
     * grepping.
     */
    expect(occurrences.sort().join(", ")).toBe(`${DEFINITION_FILE} (1)`);
    expect(total).toBe(1);
  }, IO_TIMEOUT_MS);
});
