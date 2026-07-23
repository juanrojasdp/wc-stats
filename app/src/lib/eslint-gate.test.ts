import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Loading eslint-config-next dominates the first lint (~seconds); the rest
// reuse the cached config.
vi.setConfig({ testTimeout: 30_000 });

/*
 * Regression fixtures for the i18n build gate (AD-12, AC #2). The negative
 * proofs from Story 2.1 Task 8.2 were one-time manual edits; these tests make
 * them permanent so a config change that silently opens a bypass fails CI.
 * Each snippet is linted with the real eslint.config.mjs via the ESLint API.
 */

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url));
const GATE_RULES = ["react/jsx-no-literals", "no-restricted-syntax"];

let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: APP_DIR });
  await eslint.lintText("export {};\n", { filePath: "src/__gate_probe__.tsx" });
}, 60_000);

async function gateErrorsFor(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: "src/__gate_probe__.tsx" });
  return result.messages
    .filter((message) => message.ruleId !== null && GATE_RULES.includes(message.ruleId))
    .map((message) => message.ruleId as string);
}

describe("i18n gate catches hardcoded user-facing strings", () => {
  it("JSX text literal", async () => {
    const errors = await gateErrorsFor(`export function P() { return <p>hardcoded</p>; }`);
    expect(errors).toContain("react/jsx-no-literals");
  });

  it("JSX expression-container string literal", async () => {
    const errors = await gateErrorsFor(`export function P() { return <p>{"hardcoded"}</p>; }`);
    expect(errors).toContain("react/jsx-no-literals");
  });

  it("aria-label string literal", async () => {
    const errors = await gateErrorsFor(
      `export function P() { return <p aria-label="hardcoded" />; }`
    );
    expect(errors).toContain("no-restricted-syntax");
  });

  it("aria-label template literal (Story 2.1 review bypass)", async () => {
    const errors = await gateErrorsFor(
      "export function P() { return <p aria-label={`hardcoded`} />; }"
    );
    expect(errors).toContain("no-restricted-syntax");
  });

  it("title concatenation (Story 2.1 review bypass)", async () => {
    const errors = await gateErrorsFor(
      `export function P() { return <p title={"hard" + "coded"} />; }`
    );
    expect(errors).toContain("no-restricted-syntax");
  });

  it("title logical-expression fallback (Story 2.1 review bypass)", async () => {
    const errors = await gateErrorsFor(
      `export function P({ x }: { x?: string }) { return <p title={x || "hardcoded"} />; }`
    );
    expect(errors).toContain("no-restricted-syntax");
  });

  it("aria-roledescription literal (Story 2.1 review whitelist gap)", async () => {
    const errors = await gateErrorsFor(
      `export function P() { return <p aria-roledescription="hardcoded" />; }`
    );
    expect(errors).toContain("no-restricted-syntax");
  });

  it("copy-carrying prop on a custom component (resolved review decision)", async () => {
    const errors = await gateErrorsFor(
      `function Empty(props: { message: string }) { return <p>{props.message}</p>; }
       export function P() { return <Empty message="No data" />; }`
    );
    expect(errors).toContain("no-restricted-syntax");
  });

  it("metadata title template literal (Story 2.1 review bypass)", async () => {
    const errors = await gateErrorsFor("export const metadata = { title: `Hardcoded` };");
    expect(errors).toContain("no-restricted-syntax");
  });

  it("nested metadata title object", async () => {
    const errors = await gateErrorsFor(
      `export const metadata = { title: { default: "Hardcoded", template: "%s | Hard" } };`
    );
    expect(errors).toContain("no-restricted-syntax");
  });

  it("generateMetadata() strings (Story 2.1 review bypass)", async () => {
    const errors = await gateErrorsFor(
      `export function generateMetadata() { return { title: "Hardcoded" }; }`
    );
    expect(errors).toContain("no-restricted-syntax");
  });
});

/*
 * Client-import seam (Story 2.2 Task 4): a client component importing the
 * server-safe t() compiles, renders Spanish and silently ignores locale
 * switching. src/components/** must bind locale via useT()/useLocale();
 * server components and src/app/** keep direct t().
 */
describe("client-import seam bars direct t() from src/components", () => {
  const SEAM_RULE = "no-restricted-imports";

  async function seamErrorsFor(code: string, filePath: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath });
    return result.messages
      .filter((message) => message.ruleId === SEAM_RULE)
      .map((message) => message.ruleId as string);
  }

  it("t() import via the @ alias is barred in src/components/**", async () => {
    const errors = await seamErrorsFor(
      `import { t } from "@/lib/i18n";\nexport const x = t;\n`,
      "src/components/__seam_probe__.tsx"
    );
    expect(errors).toContain(SEAM_RULE);
  });

  it("t() import via a relative path is barred in src/components/**", async () => {
    const errors = await seamErrorsFor(
      `import { t } from "../lib/i18n";\nexport const x = t;\n`,
      "src/components/__seam_probe__.tsx"
    );
    expect(errors).toContain(SEAM_RULE);
  });

  it("type-only imports from @/lib/i18n stay legal in src/components/**", async () => {
    const errors = await seamErrorsFor(
      `import type { DictionaryKey, Locale } from "@/lib/i18n";\nexport type K = DictionaryKey;\nexport type L = Locale;\n`,
      "src/components/__seam_probe__.tsx"
    );
    expect(errors).toEqual([]);
  });

  it("useT()/useLocale() from the provider stay legal in src/components/**", async () => {
    const errors = await seamErrorsFor(
      `import { useLocale, useT } from "@/lib/i18n-provider";\nexport const hooks = { useLocale, useT };\n`,
      "src/components/__seam_probe__.tsx"
    );
    expect(errors).toEqual([]);
  });

  it("direct t() stays legal outside src/components (server components, metadata)", async () => {
    const errors = await seamErrorsFor(
      `import { t } from "@/lib/i18n";\nexport const x = t;\n`,
      "src/app/__seam_probe__.tsx"
    );
    expect(errors).toEqual([]);
  });
});

describe("i18n gate keeps legal patterns legal", () => {
  it("t() everywhere, className and data-* strings", async () => {
    const errors = await gateErrorsFor(
      `import { t } from "@/lib/i18n";
       export function P() {
         return (
           <p aria-label={t("a11y.scaffold.demoRegion")} className="type-body" data-slot="probe">
             {t("app.siteName")}
           </p>
         );
       }`
    );
    expect(errors).toEqual([]);
  });

  it("conditional between two t() calls", async () => {
    const errors = await gateErrorsFor(
      `import { t } from "@/lib/i18n";
       export function P({ on }: { on: boolean }) {
         return <p aria-label={on ? t("app.siteName") : t("app.scaffold.heading")} />;
       }`
    );
    expect(errors).toEqual([]);
  });
});
