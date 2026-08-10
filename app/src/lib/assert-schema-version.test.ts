import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "./contract/schema-version";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(APP_DIR, "scripts", "assert-schema-version.mjs");
const FIXTURES_DIR = path.join(path.dirname(APP_DIR), "data", "fixtures");

function runScript(args: string[] = []): { status: number; output: string } {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir !== null) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("assert-schema-version gate (FR-20)", () => {
  /*
   * ⚠️ EXPLICIT TIMEOUT, and it is a HARNESS fact rather than a slow assertion.
   *
   * Every `it` here shells out to the real gate script through `runScript`, so
   * each one pays a full Node interpreter start. Run alone this test takes
   * 1.3–1.7 s and has never failed; run inside `npm test` on seven workers it
   * intermittently crossed vitest's 5 s DEFAULT and failed as a timeout —
   * observed at Story 2.14's baseline, before that story had touched a single
   * file, and again afterwards at roughly one full-suite run in four.
   *
   * A child-process spawn under contention is exactly the shape that wants a
   * generous per-test budget: the flake says nothing about the gate, and a red
   * suite that is red at random teaches everyone to ignore it. Raised here, on
   * the one test that spawns and then reads a whole fixture tree, rather than
   * globally in `vitest.config.ts` — the other suites are pure-model and their
   * 5 s default is a genuine signal. (Story 2.14, which added the repo's first
   * jsdom file and so made the contention worse without causing it.)
   */
  const SPAWN_TIMEOUT_MS = 20_000;

  /*
   * A10 / L3640 — RULED AT 2.19: YES, A UNIT-TEST RUN RE-WALKS THE WHOLE CORPUS.
   *
   * This case runs the gate arg-less, which is the production invocation, and
   * arg-less means the entire committed `data/` tree: 1,412 artifacts, ~1.7 s of
   * walking inside a ~8.5 s spawn-and-read. That is the single most expensive
   * test in the suite, and it is worth it. The gate is the only thing standing
   * between a schema drift and a published site, `npm test` is where it can fail
   * in seconds instead of after a 3-minute `next build`, and narrowing it to a
   * sample would test something other than what ships. The positional-argument
   * escape hatch already exists if the suite ever has to get faster; taking it
   * would be trading the gate's whole value for eight seconds.
   *
   * (Note it has ALWAYS walked the real corpus — DATA_DIR resolves to
   * `<repo>/data` and is independent of the app's DATA_ROOT — so the 2.19
   * cutover did not change this cost. The name below said "fixture tree" and was
   * wrong before the flip too.)
   */
  it("passes on the current data tree", () => {
    // Story 1.8 forced repair: the project's first contract bump moved every artifact to
    // schemaVersion 2 (MomentumSample gained `at: MinuteStamp`). Read from the generated
    // constant rather than re-hardcoding a literal, so the next bump does not land here.
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.output).toMatch(
      new RegExp(`artifact\\(s\\) at schemaVersion ${SCHEMA_VERSION}`),
    );
  }, SPAWN_TIMEOUT_MS);

  it("fails non-zero on a tampered copy, naming the file and values", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "wcstats-assert-"));
    cpSync(path.join(FIXTURES_DIR, "index"), path.join(tempDir, "index"), { recursive: true });

    const tamperedPath = path.join(tempDir, "index", "tournament.json");
    const artifact = JSON.parse(readFileSync(tamperedPath, "utf8")) as { schemaVersion: number };
    artifact.schemaVersion = 999;
    writeFileSync(tamperedPath, JSON.stringify(artifact));

    const result = runScript([tempDir]);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("tournament.json");
    expect(result.output).toContain("999");
  }, SPAWN_TIMEOUT_MS);

  it("fails when the data tree holds no artifacts at all", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "wcstats-assert-empty-"));
    const result = runScript([tempDir]);
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/no \*\.json artifacts/);
  }, SPAWN_TIMEOUT_MS);

  /*
   * THE STAGING SIBLINGS (Story 2.19, ledger A9/L3558).
   *
   * The gate walks the WORKING tree, not the committed one, and the pipeline
   * stages every emission into `<name>.staged/` before swapping it in — with
   * `<name>.previous.rollback/` left behind as the retired backup. Both are
   * gitignored, so a reviewer never sees them; a killed run (routine here) does.
   * They used to be walked, which failed the build on artifacts that ship
   * nowhere and cannot be found by looking at `git status`.
   *
   * Each case tampers the artifact so that VISITING it is what turns the gate
   * red. A skip rule tested against a valid file would pass whether or not the
   * rule existed.
   */
  for (const transientDir of ["matches.staged", "matches.previous.rollback"]) {
    it(`skips ${transientDir}/ — a killed run's leftovers are not shipped artifacts`, () => {
      tempDir = mkdtempSync(path.join(tmpdir(), "wcstats-assert-staged-"));
      // One good artifact, so the run has something to count and does not trip
      // the "no artifacts found" failure for the wrong reason.
      cpSync(path.join(FIXTURES_DIR, "index"), path.join(tempDir, "index"), { recursive: true });

      const staged = path.join(tempDir, transientDir);
      mkdirSync(staged, { recursive: true });
      writeFileSync(
        path.join(staged, "m001-mexico-south-africa.json"),
        JSON.stringify({ schemaVersion: 999, matchId: "m001-mexico-south-africa" })
      );

      const result = runScript([tempDir]);
      expect(result.output).not.toContain("999");
      expect(result.status).toBe(0);
    }, SPAWN_TIMEOUT_MS);
  }

  it("still fails on that same artifact when it is NOT under a staging sibling", () => {
    // The control for the two cases above: same bytes, ordinary directory name.
    tempDir = mkdtempSync(path.join(tmpdir(), "wcstats-assert-control-"));
    const ordinary = path.join(tempDir, "matches");
    mkdirSync(ordinary, { recursive: true });
    writeFileSync(
      path.join(ordinary, "m001-mexico-south-africa.json"),
      JSON.stringify({ schemaVersion: 999, matchId: "m001-mexico-south-africa" })
    );

    const result = runScript([tempDir]);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("999");
  }, SPAWN_TIMEOUT_MS);
});
