import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(APP_DIR, "scripts", "assert-no-external-origins.mjs");

/*
 * The zero-external-request gate (Story 2.19 Task 6.14, ledger A3/L49).
 *
 * The ledger's complaint was that AR-11 and NFR-9 were checked by a ONE-TIME
 * MANUAL GREP, which says nothing about the tree that ships today. So the gate
 * is now in the build chain — and a gate nobody has seen FAIL is the same
 * problem in a new place. Every case below feeds it a tree it must reject.
 *
 * The cases are chosen to be the ways this project would actually regress: a
 * font CDN link, an analytics script, a CSS @import, a runtime fetch, a
 * background image. NFR-9's ban on telemetry is the one that matters most and
 * is the hardest to notice in review.
 */

function run(dir: string): { status: number; output: string } {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

let tempDir: string | null = null;

function tree(files: Record<string, string>): string {
  tempDir = mkdtempSync(path.join(tmpdir(), "wcstats-origins-"));
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(tempDir, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content, "utf8");
  }
  return tempDir;
}

afterEach(() => {
  if (tempDir !== null) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

const SPAWN_TIMEOUT_MS = 20_000;

describe("assert-no-external-origins gate (AR-11, NFR-9)", () => {
  it(
    "passes on a clean export",
    () => {
      const dir = tree({
        "index.html": '<html><body><script src="/_next/static/chunks/a.js"></script></body></html>',
        "_next/static/chunks/a.js": 'fetch("/data/index/tournament.json")',
      });
      const result = run(dir);
      expect(result.output).toContain("0 external subresources");
      expect(result.status).toBe(0);
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS an analytics script — the NFR-9 case",
    () => {
      const dir = tree({
        "index.html": '<html><body><script src="https://plausible.io/js/script.js"></script></body></html>',
      });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain("plausible.io");
      expect(result.output).toContain("src attribute");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS a font CDN <link> — the one AD-13 would silently tolerate",
    () => {
      const dir = tree({
        "index.html": '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">',
      });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain("fonts.googleapis.com");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS a CSS @import and a remote background image",
    () => {
      const dir = tree({
        "a.css": '@import "https://cdn.example.com/reset.css";',
        "b.css": ".hero{background-image:url(https://images.example.com/pitch.jpg)}",
      });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain("cdn.example.com");
      expect(result.output).toContain("images.example.com");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS a runtime fetch to another origin",
    () => {
      const dir = tree({ "app.js": 'await fetch("https://api.example.com/v1/telemetry", {method:"POST"})' });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain("api.example.com");
      expect(result.output).toContain("fetch()");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "does NOT reject an SVG namespace — every inline <svg> carries one",
    () => {
      const dir = tree({
        "index.html": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
      });
      expect(run(dir).status).toBe(0);
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "does NOT reject a vendor error-message URL — the false positive that would switch the gate off",
    () => {
      /*
       * A naive "any absolute URL anywhere" scan reports 27 violations on a
       * clean production build, all of them diagnostic strings inside vendor
       * bundles. They are counted and printed, never failed on.
       */
      const dir = tree({
        "vendor.js": 'throw new Error("see https://react.dev/errors/418 and https://nextjs.org/docs/messages/x")',
      });
      const result = run(dir);
      expect(result.status).toBe(0);
      expect(result.output).toContain("MENTIONED in text");
      expect(result.output).toContain("https://react.dev");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REPORTS an outbound <a href> without failing — a link is a navigation, not a fetch",
    () => {
      const dir = tree({ "index.html": '<a href="https://example.org/source">source</a>' });
      const result = run(dir);
      expect(result.status).toBe(0);
      expect(result.output).toContain("outbound <a href>");
      expect(result.output).toContain("https://example.org/source");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "SKIPS out/data — 1,411 artifacts of proper nouns must not fail a build",
    () => {
      const dir = tree({
        "data/matches/m001.json": '{"note":"see https://evil.example.com/x"}',
        "index.html": "<p>ok</p>",
      });
      expect(run(dir).status).toBe(0);
    },
    SPAWN_TIMEOUT_MS
  );
});
