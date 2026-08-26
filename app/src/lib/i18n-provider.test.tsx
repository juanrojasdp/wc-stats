// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { localeClass } from "@/lib/bootstrap";
import { type Locale } from "@/lib/i18n";
import { LocaleProvider, useLocale } from "@/lib/i18n-provider";
import { STORAGE_KEYS } from "@/lib/storage";
import { en } from "@/locales/en";
import { es } from "@/locales/es";

/*
 * ═══════ FIRST-VISIT LOCALE DETECTION, RENDERED (Story 3.5, FR-37) ═══════
 *
 * WHY A RENDER TEST AND NOT ANOTHER UNIT TEST. `bootstrap.test.ts` proves the
 * algorithm and proves the pre-paint script agrees with it. Neither proves the
 * thing that actually reaches the reader: that the PROVIDER consults it. The
 * failure this file exists to catch is React re-rendering Spanish strings
 * underneath an `<html lang="en">` the pre-paint script has already set —
 * a disagreement that lives between two files and is invisible inside either.
 *
 * It also carries AC 4, which is satisfied by the ABSENCE of code (no write,
 * no announcement) and can therefore be proved by nothing except a test that
 * looks.
 *
 * ═══════ FOUR HARNESS FACTS THIS FILE OWES ITS READER ═══════
 *
 * 1. THE PRAGMA IS PER-FILE. The global `environment` in `vitest.config.ts`
 *    stays "node"; flipping it would change `storage.test.ts`'s
 *    `vi.unstubAllGlobals()` restore target (`HeaderSearch.test.tsx` documents
 *    this at length). Line 1, before the imports.
 * 2. RTL AUTO-CLEANUP DOES NOT RUN. `vitest.config.ts` has no `globals: true`,
 *    so @testing-library/react never registers its `afterEach(cleanup)`.
 *    Without the explicit call below the DOM leaks into the next test and the
 *    symptom reads as "found multiple elements".
 * 3. THIS FILE IS LINTED LIKE ANY OTHER `src/**` FILE. `jsx-no-literals` with
 *    `noStrings: true` is on and `--max-warnings 0` is link 1 of the build
 *    chain, so bare JSX text is a BUILD ERROR. The probe renders `{locale}` as
 *    an expression; attribute literals such as `data-testid` stay legal.
 * 4. JSDOM STATE IS PER-FILE, NOT PER-TEST. `documentElement.lang`, its class
 *    list and `window.localStorage` all survive into the next test, so all
 *    three are reset in `afterEach` below.
 *
 * ═══════ AND ONE FACT ABOUT THE INPUT ═══════
 *
 * jsdom's default `navigator.language` is "en-US" (measured). An "English is
 * detected" case that forgot to pin it would pass WITHOUT ASSERTING ANYTHING,
 * because the ambient default happens to agree. Every case below states the
 * tag it assumes — the Spanish ones included.
 */

/** The tag `navigator.language` reports for the duration of one test. */
function pinLanguage(tag: string): void {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(tag);
}

function LocaleProbe() {
  const { locale, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button data-testid="toggle-en" onClick={() => setLocale("en")} type="button">
        {en.a11y.localeAnnouncement}
      </button>
    </div>
  );
}

/**
 * `render()` wraps in `act`, so the mount effect has already flushed by the
 * time this returns — these assertions need no `waitFor`.
 */
function renderProbe(initialLocale?: Locale) {
  const { container } = render(
    <LocaleProvider initialLocale={initialLocale}>
      <LocaleProbe />
    </LocaleProvider>
  );
  return {
    container,
    locale: () => screen.getByTestId("locale").textContent,
    /*
     * Queried STRUCTURALLY rather than by its text: a test that looks the
     * region up by content cannot distinguish "silent" from "absent", and
     * silence is exactly what AC 4 asks it to prove.
     */
    liveRegion: () => container.querySelector('[aria-live="polite"]'),
  };
}

function storedLocale(): string | null {
  return window.localStorage.getItem(STORAGE_KEYS.locale);
}

afterEach(() => {
  // See harness facts 2 and 4.
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.lang = "";
  document.documentElement.classList.remove(localeClass("es"), localeClass("en"));
});

describe("LocaleProvider — first-visit detection (AC 1, AC 3)", () => {
  const ENGLISH_TAGS = ["en-US", "en-GB", "en"];

  for (const tag of ENGLISH_TAGS) {
    it(`renders English for a first-time visitor whose browser asks for ${tag}`, () => {
      pinLanguage(tag);
      const probe = renderProbe();
      expect(probe.locale()).toBe("en");
    });
  }

  for (const tag of ["fr-FR", "es-CO"]) {
    it(`renders the canonical Spanish for a first-time visitor asking for ${tag}`, () => {
      pinLanguage(tag);
      const probe = renderProbe();
      expect(probe.locale()).toBe("es");
    });
  }

  /*
   * AC 3's ACTUAL failure mode, asserted from both sides: not "the wrong
   * string" but "the right `<html lang>` over the wrong strings". The
   * pre-paint script sets `lang` and the locale class; React must agree with
   * it, and does so by re-asserting them rather than by trusting they ran.
   */
  it("re-asserts <html lang> and the locale class to match the strings it renders", () => {
    pinLanguage("en-US");
    const probe = renderProbe();

    expect(probe.locale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.classList.contains(localeClass("en"))).toBe(true);
    expect(document.documentElement.classList.contains(localeClass("es"))).toBe(false);
  });

  it("re-asserts them for a detected Spanish visitor too, not only when something changed", () => {
    pinLanguage("fr-FR");
    document.documentElement.lang = "";
    const probe = renderProbe();

    expect(probe.locale()).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(document.documentElement.classList.contains(localeClass("es"))).toBe(true);
  });
});

describe("LocaleProvider — a stored choice beats a detected guess (AC 1)", () => {
  it("keeps the stored es against a browser asking for English", () => {
    window.localStorage.setItem(STORAGE_KEYS.locale, "es");
    pinLanguage("en-US");
    const probe = renderProbe();

    expect(probe.locale()).toBe("es");
    expect(storedLocale()).toBe("es");
  });

  it("keeps the stored en against a browser asking for Spanish", () => {
    window.localStorage.setItem(STORAGE_KEYS.locale, "en");
    pinLanguage("es-CO");
    const probe = renderProbe();

    expect(probe.locale()).toBe("en");
    expect(storedLocale()).toBe("en");
  });

  /*
   * A value that is not one of the two locales is not a choice, so detection
   * decides — and detection does NOT repair storage on its way past. Leaving
   * the garbage in place is deliberate: rewriting it would turn a guess into
   * something a later read cannot tell apart from a choice.
   */
  it("falls through stored garbage to detection without repairing storage", () => {
    window.localStorage.setItem(STORAGE_KEYS.locale, "fr");
    pinLanguage("en-GB");
    const probe = renderProbe();

    expect(probe.locale()).toBe("en");
    expect(storedLocale()).toBe("fr");
  });
});

describe("LocaleProvider — a guess is not a choice (AC 4)", () => {
  /*
   * Bare `en` is here because Task 6.3's table has five detection rows and
   * this list had four (code review 2026-08-26): `en` was asserted for locale
   * in the AC-1 block above but never for the two things AC 4 is actually
   * about — that nothing is persisted and nothing is announced.
   */
  const DETECTION_CASES = [
    ["en-US", "en"],
    ["en-GB", "en"],
    ["en", "en"],
    ["fr-FR", "es"],
    ["es-CO", "es"],
  ] as const;

  for (const [tag, expected] of DETECTION_CASES) {
    it(`never persists the locale it detected from ${tag}`, () => {
      pinLanguage(tag);
      const probe = renderProbe();

      expect(probe.locale()).toBe(expected);
      expect(storedLocale()).toBeNull();
    });

    it(`never announces the locale it detected from ${tag}`, () => {
      pinLanguage(tag);
      const probe = renderProbe();

      expect(probe.locale()).toBe(expected);
      expect(probe.liveRegion()).not.toBeNull();
      expect(probe.liveRegion()?.textContent).toBe("");
    });
  }

  /*
   * THE CONTROL THAT KEEPS THE SILENCE HONEST. Without this pair, the two
   * assertions above would pass just as well against a provider whose live
   * region never works at all and whose toggle never persists — the classic
   * green-for-the-wrong-reason. An explicit toggle must do BOTH of the things
   * detection deliberately does not.
   */
  it("DOES persist and DOES announce when the reader actually chooses", async () => {
    // `delay: null` is this repo's idiom (HeaderSearch.test.tsx:98). Without
    // it user-event waits on real timers between events, which is fine alone
    // and exceeds the 5 s timeout under a loaded full-suite run.
    const user = userEvent.setup({ delay: null });
    pinLanguage("es-CO");
    const probe = renderProbe();

    expect(probe.locale()).toBe("es");
    expect(storedLocale()).toBeNull();
    expect(probe.liveRegion()?.textContent).toBe("");

    await user.click(screen.getByTestId("toggle-en"));

    expect(probe.locale()).toBe("en");
    expect(storedLocale()).toBe("en");
    // Announced in the TARGET language (WCAG 4.1.3).
    expect(probe.liveRegion()?.textContent).toBe(en.a11y.localeAnnouncement);
    expect(probe.liveRegion()?.textContent).not.toBe(es.a11y.localeAnnouncement);
  });
});

/*
 * ═══════ THE THREE SEAMS THE CODE REVIEW OF 2026-08-26 FOUND UNPINNED ═══════
 *
 * All three are provider-side. The ES5 literal's equivalents were already
 * covered in bootstrap.test.ts, and that asymmetry was the finding: the two
 * implementations read the same two external sources, and only one of them
 * had its failure modes asserted.
 */
describe("LocaleProvider — the external reads, when they misbehave", () => {
  /*
   * The provider does NOT read storage the way the script does. The script
   * calls `localStorage.getItem` raw inside its own try/catch; the provider
   * goes through `readStorage`, whose catch returns the in-memory fallback
   * (storage.ts). So "storage throws" is a genuinely different input on this
   * side, and detection must still happen underneath it.
   */
  it("still detects when localStorage.getItem throws", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    pinLanguage("en-GB");

    const probe = renderProbe();

    expect(probe.locale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  /*
   * Before the review the provider read `window.navigator.language` bare while
   * the literal try/catch'd the identical read — and `readStorage` on the very
   * same line was hardened too. `LocaleProvider` wraps the whole tree in
   * layout.tsx, so an uncaught throw here is a blank site, in the one world
   * the pre-paint script survives.
   */
  it("falls to the canonical when navigator.language throws, rather than taking down the tree", () => {
    vi.spyOn(window.navigator, "language", "get").mockImplementation(() => {
      throw new Error("navigator unavailable");
    });

    const probe = renderProbe();

    expect(probe.locale()).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(storedLocale()).toBeNull();
  });

  it("falls to the canonical when navigator.language is a truthy non-string", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue(
      ["en-US"] as unknown as string
    );

    const probe = renderProbe();

    expect(probe.locale()).toBe("es");
  });
});

/*
 * `initialLocale` is a REAL third tier as of the 2026-08-26 review. It was
 * previously inert — the effect overwrote it unconditionally and resolveLocale
 * hardcoded `es` — while the effect's own comment claimed this precedence.
 * These cases are what stop it going inert again.
 */
describe("LocaleProvider — initialLocale is the fallback, not a suggestion", () => {
  it("honours initialLocale when nothing is stored and nothing English is detected", () => {
    pinLanguage("fr-FR");

    const probe = renderProbe("en");

    expect(probe.locale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    // Still a guess, not a choice.
    expect(storedLocale()).toBeNull();
  });

  it("lets a stored choice outrank initialLocale", () => {
    window.localStorage.setItem(STORAGE_KEYS.locale, "es");
    pinLanguage("fr-FR");

    const probe = renderProbe("en");

    expect(probe.locale()).toBe("es");
  });

  it("lets a detected English tag outrank a Spanish initialLocale", () => {
    pinLanguage("en-US");

    const probe = renderProbe("es");

    expect(probe.locale()).toBe("en");
  });

  it("falls to the canonical es when no initialLocale is given", () => {
    pinLanguage("fr-FR");

    const probe = renderProbe();

    expect(probe.locale()).toBe("es");
  });
});
