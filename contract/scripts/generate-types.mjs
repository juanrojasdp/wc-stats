/**
 * Compile every /contract schema to TypeScript, and emit SCHEMA_VERSION from version.json.
 *
 * AD-2: the schemas are the single definition. The App consumes these generated types and
 * never a hand-written mirror, so this script is the only thing allowed to produce them.
 *
 * The output directory is a parameter, not a constant: the Structural Seed places generated
 * contract types under `app/src/lib/contract/`, but `app/` does not exist until Story 2.1.
 * Story 2.1 re-points this same script at that directory - it must NOT write a second
 * generator. See contract/README.md.
 *
 *   node scripts/generate-types.mjs [outDir]
 *
 * json-schema-to-typescript 15.0.4 is CommonJS with no `exports` map, so it is imported as a
 * namespace rather than with destructured named imports, which sidesteps cjs-module-lexer
 * edge cases under ESM.
 *
 * Two things this script does beyond calling the compiler, both load-bearing:
 *
 *  1. DEDUPE. Each schema file is compiled independently with `declareExternallyReferenced`,
 *     so every file that references common.schema.json re-emits the whole of it. Naively
 *     concatenating six compilations yields `export type Position` four times, which is not
 *     valid TypeScript. Declarations are therefore keyed by name; a repeat with an identical
 *     body is dropped, and a repeat with a DIFFERENT body is a hard error - that is a real
 *     name collision between two schemas and must never be resolved silently.
 *
 *  2. FIDELITY ASSERTIONS (AC 3). The generated output is rejected if it contains an index
 *     signature (`[k: string]: unknown`, which silently defeats a closed shape) or a
 *     collision-suffixed name (`Foo1`, `Foo2`, which the tool emits when two schemas resolve
 *     to the same type name). Both are silent-wrong-output failures, so the generator fails
 *     the build rather than writing them.
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as jst from "json-schema-to-typescript";

const CONTRACT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_OUT_DIR = path.join(CONTRACT_DIR, "generated");

const BANNER =
  "/* eslint-disable */\n" +
  "/**\n" +
  " * GENERATED FILE - DO NOT EDIT.\n" +
  " *\n" +
  " * Produced by contract/scripts/generate-types.mjs from the JSON Schemas in /contract.\n" +
  " * Edit the schemas and re-run `npm run generate:types`.\n" +
  " */\n";

/**
 * Canonical write: UTF-8, LF, trailing newline (AD-8).
 *
 * Node writes exactly the bytes given - unlike Python's text mode it performs no newline
 * translation - so normalizing CRLF here is what keeps a Windows run byte-identical to a
 * POSIX one. The tool itself emits LF, but prettier's `endOfLine` default has changed across
 * major versions, so this does not rely on that.
 */
async function writeCanonical(filePath, contents) {
  const normalized = contents.replace(/\r\n/g, "\n");
  await writeFile(filePath, normalized.endsWith("\n") ? normalized : `${normalized}\n`, {
    encoding: "utf8",
  });
}

/**
 * Strip the compiler's cross-reference stanza from a declaration's JSDoc.
 *
 * The tool appends "This interface was referenced by `X`'s JSON-Schema via the `definition`
 * "Y"." to every declaration, where X is whichever schema file pulled it in. The same shared
 * $def therefore compiles to a byte-different comment depending on which of the six files is
 * being compiled, which would make identical declarations look like a name collision. The
 * stanza is also meaningless in the merged output - it names one arbitrary referrer out of
 * several - so it is removed rather than merely ignored.
 */
function stripCrossReferenceStanza(text) {
  // Anchored to the compiler's EXACT emitted form: it always names the referring schema in
  // backticks and always ends the sentence with a quoted keyword. A looser match would eat a
  // hand-written `description` that merely opens with the same words - which is silent
  // documentation loss, invisible in a diff of the schemas.
  const kept = text
    .split("\n")
    .filter(
      (line) =>
        !/^\s*\*\s*This interface was referenced by `[^`]+`'s JSON-Schema\b/.test(line) &&
        !/^\s*\*\s*via the `[^`]+` "[^"]*"\.\s*$/.test(line)
    );
  // Drop a bare " *" that the removal left stranded directly above the closing " */".
  const tidied = kept.filter(
    (line, i) => !(/^\s*\*\s*$/.test(line) && /^\s*\*\/\s*$/.test(kept[i + 1] ?? ""))
  );

  // A $def with no `description` had nothing in its JSDoc but the stanza. Leaving the empty
  // `/** */` husk behind would make the same declaration compile to two different texts
  // depending on the file, which reads as a name collision.
  const opening = tidied.findIndex((line) => /^\s*\/\*\*\s*$/.test(line));
  if (opening !== -1) {
    const closing = tidied.findIndex((line, i) => i > opening && /^\s*\*\/\s*$/.test(line));
    if (closing !== -1) {
      const hasContent = tidied
        .slice(opening + 1, closing)
        .some((line) => line.replace(/^\s*\*?/, "").trim().length > 0);
      if (!hasContent) {
        return [...tidied.slice(0, opening), ...tidied.slice(closing + 1)].join("\n");
      }
    }
  }
  return tidied.join("\n");
}

/**
 * Split a compilation into top-level declarations, each keyed by the name it declares.
 *
 * The compiler emits one JSDoc block immediately followed by one `export type` /
 * `export interface`, with no blank line between declarations, so a block boundary is a
 * line that is exactly `/**` or that opens an export when an export is already buffered.
 */
function splitDeclarations(source, originFile) {
  const lines = source.split("\n");
  const blocks = [];
  let current = [];
  let currentHasExport = false;

  const flush = () => {
    const text = stripCrossReferenceStanza(current.join("\n")).trim();
    current = [];
    currentHasExport = false;
    if (!text) return;
    const match = /^export (?:type|interface|const|enum) (\w+)/m.exec(text);
    if (!match) {
      throw new Error(
        `generate-types: could not identify the declaration emitted for ${originFile}:\n${text.slice(0, 200)}`
      );
    }
    blocks.push({ name: match[1], text, originFile });
  };

  for (const line of lines) {
    const opensComment = line === "/**";
    const opensExport = /^export (?:type|interface|const|enum) /.test(line);
    if ((opensComment || opensExport) && (currentHasExport || opensComment) && current.length) {
      if (opensComment || currentHasExport) flush();
    }
    if (opensExport) currentHasExport = true;
    current.push(line);
  }
  flush();
  return blocks;
}

/**
 * Names the tool suffixed to resolve a collision, as opposed to names that merely end in a
 * digit.
 *
 * The two are not distinguishable by shape - `Metres1` and `DistanceZone5` look identical to a
 * regex. What distinguishes them is that a collision suffix is only ever minted when the STEM
 * is already taken: the tool emits `Metres1` precisely because `Metres` exists. A name whose
 * stem is not also declared is somebody's deliberate title, and rejecting it would fail the
 * build over a collision that does not exist. The contract already carries distanceZone1..5 as
 * field names, so this is a live hazard rather than a hypothetical one.
 *
 * Exported for the test suite, which re-asserts the same property against the committed file.
 */
export function collisionSuffixedNames(declaredNames) {
  const declared = new Set(declaredNames);
  return declaredNames
    .filter((name) => {
      const match = /^(.*[A-Za-z])(\d+)$/.exec(name);
      return match !== null && declared.has(match[1]);
    })
    .sort();
}

function assertFidelity(source, declaredNames) {
  const problems = [];

  const indexSignatures = source.match(/^\s*\[k: string\]:.*$/gm);
  if (indexSignatures) {
    problems.push(
      `${indexSignatures.length} index signature(s) present - a schema is missing ` +
        `"additionalProperties": false, so its shape is not closed:\n  ` +
        indexSignatures.map((s) => s.trim()).join("\n  ")
    );
  }

  const suffixed = collisionSuffixedNames(declaredNames);
  if (suffixed.length) {
    problems.push(
      `${suffixed.length} collision-suffixed name(s) present - two schemas resolved to the ` +
        `same type name, usually because a $ref carries sibling keywords:\n  ` +
        suffixed.map((name) => `${name} (stem "${/^(.*[A-Za-z])\d+$/.exec(name)[1]}" is also declared)`).join("\n  ")
    );
  }

  if (problems.length) {
    throw new Error(`generate-types: round-trip fidelity failed.\n\n${problems.join("\n\n")}\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const outDir = positional[0] ? path.resolve(process.cwd(), positional[0]) : DEFAULT_OUT_DIR;
  if (!check) await mkdir(outDir, { recursive: true });

  const versionPath = path.join(CONTRACT_DIR, "version.json");
  const version = JSON.parse(await readFile(versionPath, "utf8"));
  const keys = Object.keys(version);
  if (keys.length !== 1 || keys[0] !== "schemaVersion") {
    // version.json is the single global version declaration (AD-2). A second key here would
    // mean the version now lives in two places, which is the drift AD-2 exists to prevent.
    throw new Error(
      `contract/version.json must hold exactly one key "schemaVersion", found: ${keys.join(", ")}`
    );
  }
  // Number.isInteger(1.0) is true in JS but Python's isinstance(1.0, int) is false, so a
  // version.json of {"schemaVersion": 1.0} would pass here and blow up on the Python side with
  // a bare TypeError. Rejecting the float form keeps the two readers of the single version
  // source agreeing on what it says.
  if (
    !Number.isInteger(version.schemaVersion) ||
    !/^-?\d+$/.test(JSON.stringify(version.schemaVersion))
  ) {
    throw new Error(
      `schemaVersion must be written as a plain integer, got ` +
        `${JSON.stringify(version.schemaVersion)}. Python reads this file too and rejects the ` +
        `float form, so 1.0 would split the two readers.`
    );
  }

  const schemaFiles = (await readdir(CONTRACT_DIR))
    .filter((name) => name.endsWith(".schema.json"))
    .sort();
  if (schemaFiles.length === 0) {
    throw new Error(`no *.schema.json files found in ${CONTRACT_DIR}`);
  }

  /** @type {Map<string, {text: string, originFile: string}>} */
  const declarations = new Map();

  for (const name of schemaFiles) {
    const compiled = await jst.compileFromFile(path.join(CONTRACT_DIR, name), {
      cwd: CONTRACT_DIR,
      // Without this the tool defaults additionalProperties to true and emits
      // `[k: string]: unknown;`, silently defeating every closed shape in the contract.
      additionalProperties: false,
      bannerComment: "",
      declareExternallyReferenced: true,
      enableConstEnums: false,
      unreachableDefinitions: true,
      style: { singleQuote: false },
    });

    for (const block of splitDeclarations(compiled, name)) {
      const existing = declarations.get(block.name);
      if (!existing) {
        declarations.set(block.name, { text: block.text, originFile: name });
        continue;
      }
      if (existing.text !== block.text) {
        throw new Error(
          `generate-types: type name collision on "${block.name}".\n` +
            `${existing.originFile} and ${name} both declare it, with different bodies. ` +
            `Rename one schema's title so the generated types stay unambiguous.\n\n` +
            `--- ${existing.originFile} ---\n${existing.text}\n\n--- ${name} ---\n${block.text}\n`
        );
      }
    }
  }

  const ordered = [...declarations.keys()].sort();
  const body = ordered.map((name) => declarations.get(name).text).join("\n\n");
  const source = `${BANNER}\n${body}\n`;

  assertFidelity(source, ordered);

  const typesPath = path.join(outDir, "contract-types.d.ts");
  const versionTsPath = path.join(outDir, "schema-version.ts");
  const versionSource = `${BANNER}\nexport const SCHEMA_VERSION = ${version.schemaVersion};\n`;

  // --check: verify the committed output still matches what the schemas produce, without
  // writing anything. AD-14 requires schemas, fixtures and generated types to move in the SAME
  // commit; nothing enforced that, and the committed types drifted four JSDoc blocks behind the
  // schemas without a single test going red. Comment-only drift still matters here: the
  // generated file is the only thing Epic 2 reads, so a stale comment is the contract lying.
  if (check) {
    const stale = [];
    for (const [filePath, expected] of [
      [typesPath, source],
      [versionTsPath, versionSource],
    ]) {
      let actual = null;
      try {
        actual = await readFile(filePath, "utf8");
      } catch {
        stale.push(`${path.relative(CONTRACT_DIR, filePath)} is missing`);
        continue;
      }
      const normalize = (text) => text.replace(/\r\n/g, "\n");
      if (normalize(actual) !== normalize(expected)) {
        stale.push(`${path.relative(CONTRACT_DIR, filePath)} is out of date`);
      }
    }
    if (stale.length) {
      throw new Error(
        `generate-types --check: generated output does not match the schemas.\n  ` +
          `${stale.join("\n  ")}\n\nRun \`npm run generate:types\` and commit the result ` +
          `alongside the schema change (AD-14).\n`
      );
    }
    console.log(
      `generate-types --check: generated output is up to date ` +
        `(${ordered.length} declarations from ${schemaFiles.length} schemas)`
    );
    return;
  }

  await writeCanonical(typesPath, source);
  await writeCanonical(versionTsPath, versionSource);

  console.log(
    `generated ${path.relative(CONTRACT_DIR, typesPath)}: ` +
      `${ordered.length} declarations from ${schemaFiles.length} schemas`
  );
  console.log(
    `generated ${path.relative(CONTRACT_DIR, versionTsPath)} (SCHEMA_VERSION = ${version.schemaVersion})`
  );
}

await main();
