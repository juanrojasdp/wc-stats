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

await cp(SOURCE, TARGET, { recursive: true });
console.log(`copy-data: copied ${SOURCE} -> ${TARGET}`);
