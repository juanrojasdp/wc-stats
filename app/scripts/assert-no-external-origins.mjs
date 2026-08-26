/**
 * Post-export gate (Story 2.19 Task 6.14, ledger A3/L49): the shipped export
 * must FETCH nothing from another origin.
 *
 * AR-11 says zero external requests; NFR-9 says no analytics and no telemetry;
 * AD-13 says the deploy is a static export with no functions and no middleware.
 * Until now all three were checked by a ONE-TIME MANUAL GREP recorded in Story
 * 2.1's notes — which proves nothing about the tree that ships today. Story 2.1
 * routed the mechanical version here by name.
 *
 * Node built-ins only, and no dependencies: this runs on Netlify with `app/`'s
 * install alone, in the same chain as `copy-data.mjs`.
 *
 * ═══ THE ONE DESIGN DECISION, AND IT IS WHY THE FIRST VERSION WAS WRONG ═══
 *
 * A naive "any absolute URL in any file" scan reports 27 violations on a clean
 * build, and every one is a lie: they are DIAGNOSTIC STRINGS inside vendor
 * bundles — `https://react.dev/errors/`, `https://nextjs.org/docs/...`, core-js's
 * licence URL — sitting in error messages that no user agent ever fetches. A
 * gate that cries wolf on a green tree gets switched off.
 *
 * So this matches FETCHING POSITIONS only: the attributes and call sites that
 * actually cause a request. Everything else external is COUNTED AND PRINTED but
 * does not fail the build, so the signal is still visible.
 *
 * The complementary check is the runtime one — 0 external resource entries in a
 * real browser on every route — recorded in the story. Static and runtime
 * together are what make the claim; neither alone would.
 *
 * WHAT IT SCANS: every text asset in `out/`. It deliberately does NOT scan
 * `out/data`: those are 1,411 artifacts of proper nouns and are never parsed as
 * markup or executed. They are covered by the schema gate instead.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
/**
 * The export to scan. Defaults to `app/out` (the production invocation) and
 * accepts an override so the gate's own tests can point it at a fixture tree —
 * `assert-schema-version.mjs`'s established shape.
 */
const OUT = process.argv[2] === undefined ? path.join(APP_DIR, "out") : path.resolve(process.argv[2]);

/*
 * `.svg` and `.xml` ARE SCANNED (2.19 code review). An inline <svg> lives inside
 * the `.html` that carries it, but a STANDALONE `.svg` file in the export is a
 * document of its own, and `<image href>` / `<use href>` inside one are real
 * fetching positions — the gate reported "0 external subresources" over a tree
 * containing exactly that. `.xml` covers a sitemap or feed for the same reason.
 *
 * Matched case-INSENSITIVELY: `path.extname` returns the literal case, so a
 * `.HTML` asset used to skip the walk entirely.
 */
const SCANNED_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".txt",
  ".json",
  ".webmanifest",
  ".svg",
  ".xml",
]);
const SKIPPED_DIRECTORIES = new Set(["data"]);

/*
 * The allow-list, and every entry is a NON-REQUEST: `www.w3.org/2000/svg` and
 * friends are XML NAMESPACE identifiers, present in every inline <svg> and never
 * fetched.
 *
 * THERE IS NO ENTRY FOR A FONT CDN, AN ANALYTICS HOST OR AN IMAGE SERVICE, and
 * there must never be one: `next/font` self-hosts into `_next/static/media`,
 * `images: { unoptimized: true }` is set in next.config, and NFR-9 bans
 * telemetry outright.
 */
const ALLOWED = [/^https?:\/\/(www\.)?w3\.org\//i, /^https?:\/\/(www\.)?schema\.org\//i];

/*
 * ═══ TWO HOST PATTERNS, AND THE DIFFERENCE IS THE WHOLE 2.19-REVIEW FIX ═══
 *
 * `HOST` requires a DOTTED ALPHABETIC TLD. That is right for the informational
 * passes below (`ANY_URL`, `ANCHOR_HREF`), which scan free text: `//` appears in
 * every JS comment in every vendor bundle, and a pattern loose enough to match
 * `//internal/x` would report thousands of them.
 *
 * It was WRONG for the fetching positions, and wrong in the one direction that
 * matters. `[a-z]{2,}` cannot match a digit, so an IP-literal host has no
 * alphabetic TLD and never matched at all — VERIFIED before this fix, by running
 * the shipped script over a page carrying
 * `<script src="https://93.184.216.34/track.js">` and
 * `fetch("https://203.0.113.9/collect")`: it printed "0 external subresources"
 * and exited 0. A gate whose entire purpose is AR-11 / NFR-9 passed a page that
 * loads a remote script and posts telemetry, because the exfiltration host was
 * an address rather than a name. Single-label hosts (`//localhost:3000/…`,
 * `//metrics/collect`) were invisible for the same reason.
 *
 * `FETCH_HOST` therefore admits IPv4 literals, bracketed IPv6 literals and
 * single-label hosts. It can afford to: every fetching position is ANCHORED on
 * an attribute name or a call site (`src="`, `fetch("`), so a `//` reached
 * through one of those anchors is a URL by construction, never a comment.
 */
const HOST = String.raw`(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'\`)<>\\]*`;
const FETCH_HOST = String.raw`(?:https?:)?\/\/(?:\[[0-9a-f:.]+\]|[a-z0-9._~%-]+)(?::\d+)?[^\s"'\`)<>\\]*`;

/**
 * Positions that CAUSE A REQUEST. Each pattern captures the URL in group 1.
 *
 * `<a href>` is deliberately NOT here: a link is a navigation the reader
 * chooses, not a fetch the page performs. It is reported below instead, so an
 * outbound link is still visible without failing a build over it.
 */
const FETCHING_POSITIONS = [
  ["src attribute", new RegExp(String.raw`\bsrc\s*=\s*["'](${FETCH_HOST})`, "gi")],
  ["srcset attribute", new RegExp(String.raw`\bsrcset\s*=\s*["'](${FETCH_HOST})`, "gi")],
  ["poster attribute", new RegExp(String.raw`\bposter\s*=\s*["'](${FETCH_HOST})`, "gi")],
  ["<link href>", new RegExp(String.raw`<link\b[^>]*\bhref\s*=\s*["'](${FETCH_HOST})`, "gi")],
  // <image href> / <use href>, and their xlink: forms — the standalone-.svg
  // fetching positions the extension list above now reaches.
  [
    "<image>/<use> href",
    new RegExp(String.raw`<(?:image|use)\b[^>]*?\b(?:xlink:)?href\s*=\s*["'](${FETCH_HOST})`, "gi"),
  ],
  /*
   * ═══ THE TWO CSS-SYNTAX POSITIONS ARE SCOPED TO CSS-BEARING FILES ═══
   *
   * `url(` is matched case-INSENSITIVELY, and JavaScript's `new URL(` is a
   * four-character case-insensitive match for it. Inside a vendor bundle that is
   * everywhere: core-js's own URL feature detection carries
   * `new URL("https://a@b").username`, and the export ships three such strings.
   *
   * They did not surface before only because the old dotted-TLD `HOST` could not
   * match `a@b` or `x` — the same weakness that let real IP-literal hosts through.
   * Hardening the host pattern without this scope would have turned a green build
   * red over a polyfill's test fixture, which is precisely the "gate that cries
   * wolf" this file's header says gets switched off.
   *
   * So: `url()` and `@import` are CSS grammar, and are scanned in the files that
   * carry CSS — `.css`, plus `.html` for inline `<style>`. The `new\s` lookbehind
   * is belt-and-braces for a `<style>` block sitting next to inline JS in the same
   * HTML document. A url() injected by CSS-in-JS at runtime is out of this gate's
   * reach and is covered by the runtime check instead: 0 external resource
   * entries in a real browser on every route.
   */
  [
    "CSS url()",
    new RegExp(String.raw`(?<!\bnew\s)(?<![\w$.])url\(\s*["']?(${FETCH_HOST})`, "gi"),
    new Set([".css", ".html"]),
  ],
  [
    "CSS @import",
    new RegExp(String.raw`@import\s+(?:url\()?\s*["'](${FETCH_HOST})`, "gi"),
    new Set([".css", ".html"]),
  ],
  ["fetch()", new RegExp(String.raw`\bfetch\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  ["import()", new RegExp(String.raw`\bimport\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  ["importScripts()", new RegExp(String.raw`\bimportScripts\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  ["new Worker()", new RegExp(String.raw`new\s+Worker\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  [
    "XMLHttpRequest.open",
    new RegExp(String.raw`\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["'\`](${FETCH_HOST})`, "gi"),
  ],
  ["new EventSource()", new RegExp(String.raw`new\s+EventSource\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  ["new WebSocket()", new RegExp(String.raw`new\s+WebSocket\s*\(\s*["'\`]((?:wss?:)?\/\/[^\s"'\`]+)`, "gi")],
];

const ANY_URL = new RegExp(HOST, "gi");
const ANCHOR_HREF = new RegExp(String.raw`<a\b[^>]*\bhref\s*=\s*["'](${HOST})`, "gi");

const allowed = (url) => {
  const normalized = url.startsWith("//") ? `https:${url}` : url;
  return ALLOWED.some((pattern) => pattern.test(normalized));
};

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
      continue;
    }
    if (SCANNED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield path.join(dir, entry.name);
    }
  }
}

/**
 * The origin of a matched URL, or `null` if it will not parse.
 *
 * `new URL()` USED TO RUN UNGUARDED HERE, inside the try that owns the directory
 * walk (2.19 code review). `HOST`'s tail class admits `:`, `$`, `{` and `}`, so a
 * minified template literal like `"https://api.example.com:${port}/v1"` — or any
 * vendor string with an out-of-range port or a mangled IPv6 literal — matched the
 * regex and then threw. The throw was caught by the WALK's handler, so the build
 * died at exit 2 telling the operator to "run `next build` first", naming a cause
 * that had nothing to do with it and never printing the offending file.
 *
 * A REPORTING-ONLY CODE PATH MUST NOT BE ABLE TO FAIL THE BUILD. An unparseable
 * URL is now reported as itself, which is strictly more information than the
 * origin would have been.
 */
function originOf(raw) {
  const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

let scanned = 0;
const fetching = new Map();
const anchors = new Set();
const mentions = new Set();

try {
  for await (const file of walk(OUT)) {
    scanned += 1;
    const text = await readFile(file, "utf8");
    const relative = path.relative(OUT, file);

    const extension = path.extname(file).toLowerCase();

    for (const [position, pattern, onlyExtensions] of FETCHING_POSITIONS) {
      // A position with no extension set applies everywhere; see "CSS url()".
      if (onlyExtensions !== undefined && !onlyExtensions.has(extension)) continue;
      for (const match of text.matchAll(pattern)) {
        if (allowed(match[1])) continue;
        const key = `${position}  ${match[1]}`;
        const files = fetching.get(key) ?? new Set();
        files.add(relative);
        fetching.set(key, files);
      }
    }
    for (const match of text.matchAll(ANCHOR_HREF)) {
      if (!allowed(match[1])) anchors.add(match[1]);
    }
    for (const match of text.matchAll(ANY_URL)) {
      if (allowed(match[0])) continue;
      mentions.add(originOf(match[0]) ?? `${match[0]} (unparseable)`);
    }
  }
} catch (error) {
  console.error(`assert-no-external-origins: could not walk ${OUT} — run \`next build\` first`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

/*
 * A GATE THAT SCANNED NOTHING HAS PROVED NOTHING (2.19 code review).
 *
 * `out/` existing is not the same as `out/` holding an export: a cleaned tree, a
 * wrong `argv[2]`, or a build that emitted only `out/data` all walk cleanly and
 * scan zero files. The script used to print "0 text asset(s) in out/, 0 external
 * subresources." and exit 0 — a PASS, reported in the same words as a real one.
 *
 * `assert-schema-version.mjs` already fails on "no `*.json` artifacts" for this
 * exact reason; this is the same rule. Exit 2, not 1: nothing was found to be
 * wrong with the export, the export was not there to check.
 */
if (scanned === 0) {
  console.error(
    `assert-no-external-origins: scanned 0 text assets under ${OUT} — there is nothing to ` +
      `check, so this is not a pass. Run \`next build\` (and \`copy-data\`) first.`
  );
  process.exit(2);
}

if (anchors.size > 0) {
  console.log(`assert-no-external-origins: ${anchors.size} outbound <a href> (navigation, not a fetch):`);
  for (const href of anchors) console.log(`    ${href}`);
}
if (mentions.size > 0) {
  console.log(
    `assert-no-external-origins: ${mentions.size} external origin(s) MENTIONED in text ` +
      `(vendor error-message URLs and licences — not fetched): ${[...mentions].sort().join(", ")}`
  );
}

if (fetching.size > 0) {
  console.error(
    `assert-no-external-origins: ${fetching.size} EXTERNAL SUBRESOURCE(S) in the export ` +
      `— AR-11 requires zero external requests and NFR-9 bans telemetry:`
  );
  for (const [key, files] of fetching) {
    const shown = [...files].slice(0, 3).join(", ");
    const more = files.size > 3 ? ` (+${files.size - 3} more)` : "";
    console.error(`  ${key}\n      ${shown}${more}`);
  }
  process.exit(1);
}

console.log(`assert-no-external-origins: ${scanned} text asset(s) in out/, 0 external subresources.`);
