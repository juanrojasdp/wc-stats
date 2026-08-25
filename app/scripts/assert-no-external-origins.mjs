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

const SCANNED_EXTENSIONS = new Set([".html", ".js", ".mjs", ".css", ".txt", ".json", ".webmanifest"]);
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

const HOST = String.raw`(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'\`)<>\\]*`;

/**
 * Positions that CAUSE A REQUEST. Each pattern captures the URL in group 1.
 *
 * `<a href>` is deliberately NOT here: a link is a navigation the reader
 * chooses, not a fetch the page performs. It is reported below instead, so an
 * outbound link is still visible without failing a build over it.
 */
const FETCHING_POSITIONS = [
  ["src attribute", new RegExp(String.raw`\bsrc\s*=\s*["'](${HOST})`, "gi")],
  ["srcset attribute", new RegExp(String.raw`\bsrcset\s*=\s*["'](${HOST})`, "gi")],
  ["poster attribute", new RegExp(String.raw`\bposter\s*=\s*["'](${HOST})`, "gi")],
  ["<link href>", new RegExp(String.raw`<link\b[^>]*\bhref\s*=\s*["'](${HOST})`, "gi")],
  ["CSS url()", new RegExp(String.raw`url\(\s*["']?(${HOST})`, "gi")],
  ["CSS @import", new RegExp(String.raw`@import\s+(?:url\()?\s*["'](${HOST})`, "gi")],
  ["fetch()", new RegExp(String.raw`\bfetch\s*\(\s*["'\`](${HOST})`, "gi")],
  ["import()", new RegExp(String.raw`\bimport\s*\(\s*["'\`](${HOST})`, "gi")],
  ["importScripts()", new RegExp(String.raw`\bimportScripts\s*\(\s*["'\`](${HOST})`, "gi")],
  ["new Worker()", new RegExp(String.raw`new\s+Worker\s*\(\s*["'\`](${HOST})`, "gi")],
  ["XMLHttpRequest.open", new RegExp(String.raw`\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["'\`](${HOST})`, "gi")],
  ["new EventSource()", new RegExp(String.raw`new\s+EventSource\s*\(\s*["'\`](${HOST})`, "gi")],
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
    if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) yield path.join(dir, entry.name);
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

    for (const [position, pattern] of FETCHING_POSITIONS) {
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
      if (!allowed(match[0])) mentions.add(new URL(match[0].startsWith("//") ? `https:${match[0]}` : match[0]).origin);
    }
  }
} catch (error) {
  console.error(`assert-no-external-origins: could not walk ${OUT} — run \`next build\` first`);
  console.error(error instanceof Error ? error.message : error);
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
