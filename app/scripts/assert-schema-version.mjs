/**
 * FR-20 build gate: every shipped data artifact must carry the same
 * schemaVersion as the contract AND the generated constant the app compiles
 * against. A mismatch fails the build before `next build` runs (AR-13).
 *
 * Node built-ins only, on purpose: Netlify installs app/ dependencies but
 * never contract/node_modules, so this gate must not import anything.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = path.dirname(APP_DIR);
const GENERATED_VERSION_FILE = path.join(APP_DIR, "src", "lib", "contract", "schema-version.ts");
const CONTRACT_VERSION_FILE = path.join(REPO_DIR, "contract", "version.json");
// The data tree that ships into the export (fixtures now; real data at 1.19).
// An optional positional argument overrides it so the failure path is testable
// against a tampered copy; the build chain always runs arg-less.
const DATA_DIR = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(REPO_DIR, "data");

async function readGeneratedVersion() {
  const source = await readFile(GENERATED_VERSION_FILE, "utf8");
  const match = /^export const SCHEMA_VERSION = (-?\d+);$/m.exec(source);
  if (!match) {
    throw new Error(
      `could not find \`export const SCHEMA_VERSION = <int>;\` in ${GENERATED_VERSION_FILE} — ` +
        `run \`npm run generate:types\``
    );
  }
  return Number(match[1]);
}

async function readContractVersion() {
  const version = JSON.parse(await readFile(CONTRACT_VERSION_FILE, "utf8"));
  if (!Number.isInteger(version.schemaVersion)) {
    throw new Error(`${CONTRACT_VERSION_FILE} does not hold an integer schemaVersion`);
  }
  return version.schemaVersion;
}

async function* walkJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsonFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      yield fullPath;
    }
  }
}

async function main() {
  const generated = await readGeneratedVersion();
  const contract = await readContractVersion();

  if (generated !== contract) {
    throw new Error(
      `generated SCHEMA_VERSION (${generated}) != contract/version.json (${contract}) — ` +
        `run \`npm run generate:types\` and commit the result`
    );
  }

  const mismatches = [];
  let checked = 0;
  for await (const filePath of walkJsonFiles(DATA_DIR)) {
    const artifact = JSON.parse(await readFile(filePath, "utf8"));
    checked += 1;
    if (artifact.schemaVersion !== contract) {
      mismatches.push(
        `${path.relative(REPO_DIR, filePath)}: schemaVersion ${JSON.stringify(artifact.schemaVersion)}`
      );
    }
  }

  if (checked === 0) {
    throw new Error(`no *.json artifacts found under ${DATA_DIR}`);
  }
  if (mismatches.length > 0) {
    throw new Error(
      `${mismatches.length} artifact(s) do not carry schemaVersion ${contract}:\n  ` +
        mismatches.join("\n  ")
    );
  }

  console.log(
    `assert-schema-version: ${checked} artifact(s) at schemaVersion ${contract} ` +
      `(generated constant matches contract/version.json)`
  );
}

try {
  await main();
} catch (error) {
  console.error(`assert-schema-version: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
