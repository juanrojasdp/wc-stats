import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  it("passes on the current fixture tree", () => {
    // Story 1.8 forced repair: the project's first contract bump moved every artifact to
    // schemaVersion 2 (MomentumSample gained `at: MinuteStamp`). Read from the generated
    // constant rather than re-hardcoding a literal, so the next bump does not land here.
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.output).toMatch(
      new RegExp(`artifact\\(s\\) at schemaVersion ${SCHEMA_VERSION}`),
    );
  });

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
  });

  it("fails when the data tree holds no artifacts at all", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "wcstats-assert-empty-"));
    const result = runScript([tempDir]);
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/no \*\.json artifacts/);
  });
});
