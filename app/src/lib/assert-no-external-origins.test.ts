import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { SITE_ORIGIN } from "@/lib/site-origin";

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

  /*
   * ═══ STORY 3.1: THE SITE'S OWN ORIGIN, AND `rel` AS A NAVIGATION HINT ═══
   *
   * The shipped gate red-built on the site's OWN absolute `<link href>` —
   * `ALLOWED` held only the two XML namespaces and had no concept of the
   * origin the export is published at — while waving through the one tag
   * that genuinely makes a third party fetch an asset (`og:image`). Stories
   * 3.2, 3.3 and 3.4 all emit absolute self-referencing URLs, so the first
   * of them to land without this fix fails Netlify on all ~1,406 pages.
   *
   * TWO INDEPENDENT MECHANISMS CLOSE IT, and they are NOT redundant:
   *
   *   1. `SITE_ORIGIN` in `ALLOWED` — the site's own origin is not external
   *      in ANY position, including `rel="preload"` and the informational
   *      `MENTIONED` line (which would otherwise report the site's own host
   *      as external over 3.4's sitemap).
   *   2. The non-fetching `rel` exclusion — `canonical` and `alternate` are
   *      navigation hints REGARDLESS OF ORIGIN, on this file's own `<a href>`
   *      precedent: "a link is a navigation the reader chooses, not a fetch
   *      the page performs".
   *
   * On a self-origin canonical the two OVERLAP, so that case discriminates
   * nothing. The cases below isolate each mechanism deliberately — see the
   * comments on "off-origin rel=alternate" (mechanism 2 alone) and
   * "self-origin rel=preload" / the sitemap case (mechanism 1 alone). Those
   * three are what Task 8.2 and 8.3 drive red.
   *
   * EVERY FIXTURE URL IS BUILT FROM THE IMPORTED `SITE_ORIGIN`. A hardcoded
   * domain literal here would be a second copy (AC1) and would turn
   * `site-origin.test.ts`'s drift gate red.
   */

  it(
    "PASSES a self-origin <link rel=\"canonical\"> — the ~1,406-page red build this story removes",
    () => {
      const dir = tree({
        "players/quinones/index.html": `<link rel="canonical" href="${SITE_ORIGIN}/players/quinones/">`,
      });
      const result = run(dir);
      expect(result.status).toBe(0);
      expect(result.output).toContain("0 external subresources");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "PASSES a self-origin <link rel=\"alternate\" hreflang> — the other tag 3.2 emits",
    () => {
      const dir = tree({
        "players/quinones/index.html": `<link rel="alternate" hreflang="en" href="${SITE_ORIGIN}/en/players/quinones/">`,
      });
      expect(run(dir).status).toBe(0);
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "PASSES an OFF-ORIGIN <link rel=\"alternate\"> — a navigation hint is not a fetch, whatever its origin",
    () => {
      /*
       * DISCRIMINATING (AC2). This is the ONLY case the `rel` exclusion
       * carries alone: the `SITE_ORIGIN` allowance cannot help an off-origin
       * URL. Exactly the `<a href>` treatment, and what Task 8.3 reverts.
       */
      const dir = tree({ "index.html": '<link rel="alternate" hreflang="en" href="https://example.org/en/">' });
      const result = run(dir);
      expect(result.status).toBe(0);
      expect(result.output).toContain("MENTIONED in text");
      expect(result.output).toContain("example.org");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "PASSES a self-origin <link rel=\"preload\"> — a FETCHING rel, allowed on origin rather than on rel",
    () => {
      /*
       * DISCRIMINATING (AC1). `preload` is not in NON_FETCHING_RELS, so the
       * `rel` exclusion does nothing here: only the `SITE_ORIGIN` allowance
       * lets it through. One of the two cases Task 8.2 reverts.
       */
      const dir = tree({
        "index.html": `<link rel="preload" as="font" href="${SITE_ORIGIN}/_next/static/media/x.woff2">`,
      });
      expect(run(dir).status).toBe(0);
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "PASSES a self-origin og:image and does not even MENTION it — story 3.3 depends on this",
    () => {
      /*
       * `<meta content>` is deliberately NOT a fetching position (D20-b,
       * AR-11 and AD-11 as amended): a crawler's off-session fetch cannot
       * touch LCP, TBT, the payload budget or the NFR-9 telemetry surface.
       * The allowance additionally keeps the site's own origin out of the
       * informational line — a wrong signal on a green build is how a gate
       * gets switched off, which this file's header says twice.
       */
      const dir = tree({
        "index.html": `<meta property="og:image" content="${SITE_ORIGIN}/og-card.png">`,
      });
      const result = run(dir);
      expect(result.status).toBe(0);
      expect(result.output).not.toContain(SITE_ORIGIN);
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "PASSES a sitemap of self-origin <loc> entries without reporting the site as external — story 3.4 depends on this",
    () => {
      /*
       * DISCRIMINATING (AC1), and the second case Task 8.2 reverts. `<loc>`
       * is not a fetching position at all, so this rides ENTIRELY on the
       * allowance keeping the site's own origin out of `MENTIONED`.
       * `.xml` is already in SCANNED_EXTENSIONS — the 2.19 code review added
       * it with a sitemap named as the motivating case.
       */
      const dir = tree({
        "sitemap.xml":
          '<?xml version="1.0" encoding="UTF-8"?>' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
          `<url><loc>${SITE_ORIGIN}/</loc></url>` +
          `<url><loc>${SITE_ORIGIN}/players/quinones/</loc></url>` +
          "</urlset>",
      });
      const result = run(dir);
      expect(result.status).toBe(0);
      /*
       * UNANCHORED ON PURPOSE. `mentions` is sorted lexicographically, so
       * the site's origin is not reliably the first entry on the line —
       * `http://www.sitemaps.org` sorts BEFORE it (`:` < `s`). An assertion
       * anchored on the line's prefix silently cannot fire, which is exactly
       * how a test looks green while proving nothing (A2).
       */
      expect(result.output).not.toContain(SITE_ORIGIN);
      // …while a genuinely external mention IS still reported: not over-widened.
      expect(result.output).toContain("www.sitemaps.org");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS an off-origin stylesheet while only REPORTING an off-origin og:image — AC3, two channels, one failure",
    () => {
      /*
       * THE SINGLE MOST LIKELY WAY TO BUILD THIS STORY WRONG (D3-1-e).
       * "Names both" is TWO CHANNELS, not two failures. The last assertion
       * is the load-bearing one: it stops a future "hardening" from adding
       * `<meta content>` to FETCHING_POSITIONS, which would contradict D20-b
       * and break story 3.3 before it starts.
       */
      const dir = tree({
        "index.html":
          '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">' +
          '<meta property="og:image" content="https://cdn.evil.example.com/card.png">',
      });
      const result = run(dir);

      expect(result.status).toBe(1);
      expect(result.output).toContain("MENTIONED in text");
      expect(result.output).toContain("cdn.evil.example.com");

      const failureBlock = result.output.slice(result.output.indexOf("EXTERNAL SUBRESOURCE(S)"));
      expect(failureBlock).toContain("<link href>");
      expect(failureBlock).toContain("fonts.googleapis.com");
      expect(failureBlock).not.toContain("cdn.evil.example.com");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    'REJECTS rel="alternate stylesheet" — a real HTML idiom a substring test would wave through',
    () => {
      const dir = tree({ "index.html": '<link rel="alternate stylesheet" href="https://cdn.example.com/alt.css">' });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain("cdn.example.com");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS a <link> with NO rel at all — deny by default",
    () => {
      const dir = tree({ "index.html": '<link href="https://cdn.example.com/x.css">' });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain("cdn.example.com");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS an off-origin stylesheet even when a canonical to the SAME host sits beside it — the exclusion is per-tag, not per-host",
    () => {
      const dir = tree({
        "index.html":
          '<link rel="canonical" href="https://cdn.example.com/page/">' +
          '<link rel="stylesheet" href="https://cdn.example.com/x.css">',
      });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain("https://cdn.example.com/x.css");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS a look-alike host that merely PREFIXES the site's origin — the boundary is the security-relevant half",
    () => {
      /*
       * Without the `(?:[/?#]|$)` boundary, `<SITE_ORIGIN>.evil.com` is
       * allow-listed by a plain prefix match. Built from SITE_ORIGIN so it
       * stays correct if the origin ever changes (A2).
       */
      const dir = tree({ "index.html": `<script src="${SITE_ORIGIN}.evil.com/track.js"></script>` });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain("track.js");
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    "REJECTS a host whose dots are not dots — escaping the allowance is not cosmetic",
    () => {
      /*
       * Unescaped, `.` is "any character", so the allowance would match a
       * host spelled with any separator in the dot positions.
       */
      const mangled = new URL(SITE_ORIGIN).host.replaceAll(".", "X");
      const dir = tree({ "index.html": `<script src="https://${mangled}/track.js"></script>` });
      const result = run(dir);
      expect(result.status).toBe(1);
      expect(result.output).toContain(mangled);
    },
    SPAWN_TIMEOUT_MS
  );
});
