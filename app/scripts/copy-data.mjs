/**
 * Post-`next build` step (AD-13): copy the repo /data tree verbatim into the
 * static export so the site ships its artifacts from the same origin.
 * Node built-ins only — runs on Netlify with app/ dependencies alone.
 */

import { cp, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(path.dirname(APP_DIR), "data");
const TARGET = path.join(APP_DIR, "out", "data");

try {
  await access(path.join(APP_DIR, "out"));
} catch {
  console.error("copy-data: app/out does not exist — run `next build` first");
  process.exit(1);
}

try {
  await access(SOURCE);
} catch {
  console.error(`copy-data: ${SOURCE} does not exist — nothing to ship`);
  process.exit(1);
}

/*
 * ═══ THE STAGING TREES ARE NOT SHIPPED (2.19 code review) ═══
 *
 * Story 2.19 taught `assert-schema-version.mjs` to SKIP `*.staged/` and
 * `*.previous.rollback/` (ledger A9): a killed pipeline run leaves them behind,
 * and validating artifacts that ship nowhere failed the build over nothing.
 *
 * That was right, and it opened a hole here, because this copy had no matching
 * exclusion. The two facts together: the schema gate no longer walks those
 * directories, and `assert-no-external-origins` deliberately skips `out/data`
 * ("covered by the schema gate instead" — which had stopped being true for
 * exactly these paths). So a killed run's stale, unvalidated bundles were copied
 * into `out/data/matches.staged/` and published with NOTHING left to notice.
 *
 * Not hypothetical: the deploy is a local `netlify deploy --dir app/out` (Story
 * 2.19 Task 9.4), and `.gitignore:33-51` hides every one of these paths, so
 * `git status` is clean while they sit on disk.
 *
 * Suffix matching, not an exact list, mirrors the schema gate's own rule: the
 * staging siblings exist at two levels (`data/` and `data/index/`) and
 * `profiles.py` derives its own names per entity kind. The FILE-level shapes
 * (`tournament.json.staged`) are caught by the same suffix test.
 */
const TRANSIENT_SUFFIXES = [".staged", ".previous.rollback"];
const isTransient = (name) => TRANSIENT_SUFFIXES.some((suffix) => name.endsWith(suffix));

let skipped = 0;

await cp(SOURCE, TARGET, {
  recursive: true,
  filter: (source) => {
    // `cp` calls the filter for the root itself, whose basename is `data`.
    if (source === SOURCE) return true;
    if (isTransient(path.basename(source))) {
      skipped += 1;
      return false;
    }
    return true;
  },
});

if (skipped > 0) {
  console.log(
    `copy-data: skipped ${skipped} transient pipeline path(s) (*.staged, ` +
      `*.previous.rollback) — a killed run left them in ${SOURCE} and they must not ship.`
  );
}
console.log(`copy-data: copied ${SOURCE} -> ${TARGET}`);
