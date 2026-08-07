import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTournamentIndex, resetTournamentIndexCache } from "@/lib/tournament-index";

/*
 * THE SHARED LOADER'S CACHE CONTRACT (Story 2.14, Task 4.3).
 *
 * Two properties, and the second is the one that makes Task 4.4's Hub swap safe:
 *  1. a FULFILLED result is shared — the artifact is fetched at most once per
 *     page load however many surfaces ask for it;
 *  2. a REJECTED result is NOT cached — the slot is cleared so the next
 *     engagement retries.
 *
 * Without (2), one network blip would kill search for the whole page lifetime,
 * AND the Hub's retry button would become inert: `attempt` re-runs its effect,
 * the effect re-awaits the same dead promise, and the reader can never recover.
 * The story's own tripwire ("revert if a 2.12 test goes red") does NOT cover
 * this — no 2.12 test exercises a network failure at all.
 *
 * `fetch` is stubbed rather than `fetchArtifact` mocked, so the assertion runs
 * through the real single fetch path (`@/lib/data`) including its `!ok` and
 * 200-with-HTML throws.
 */

const PAYLOAD = { schemaVersion: 4, tournamentName: "Test Cup" };

function stubFetch(implementation: () => Promise<unknown>) {
  const spy = vi.fn(implementation);
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetTournamentIndexCache();
});

describe("loadTournamentIndex", () => {
  it("fetches ONCE however many callers ask, and hands them the same payload", async () => {
    const spy = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => PAYLOAD,
    }));

    const [first, second, third] = await Promise.all([
      loadTournamentIndex(),
      loadTournamentIndex(),
      loadTournamentIndex(),
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first.tournamentName).toBe("Test Cup");
  });

  it("keeps serving the fulfilled result to a caller that arrives later", async () => {
    const spy = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => PAYLOAD,
    }));

    await loadTournamentIndex();
    await loadTournamentIndex();

    // The Hub mounts on `/` and the header engages afterwards; the second
    // engagement must not cost a second ~39 KB gzip download.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("reads the DATA_ROOT-prefixed path, through the one fetch helper", async () => {
    const spy = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => PAYLOAD,
    }));
    await loadTournamentIndex();
    expect(spy).toHaveBeenCalledWith("/data/fixtures/index/tournament.json");
  });

  it("does NOT cache a rejection — the next engagement retries", async () => {
    let calls = 0;
    const spy = stubFetch(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("network down");
      }
      return { ok: true, status: 200, json: async () => PAYLOAD };
    });

    await expect(loadTournamentIndex()).rejects.toThrow("network down");
    // The retry succeeds, which is only possible if the slot was cleared.
    await expect(loadTournamentIndex()).resolves.toMatchObject({ tournamentName: "Test Cup" });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does NOT cache a non-ok response either — fetchArtifact's own throw", async () => {
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => PAYLOAD };
    });

    await expect(loadTournamentIndex()).rejects.toThrow("503");
    await expect(loadTournamentIndex()).resolves.toMatchObject({ tournamentName: "Test Cup" });
  });

  it("rejects the SAME error to every caller waiting on one failed attempt", async () => {
    // Both callers must land in their own error state; neither may hang, and
    // neither may see an unhandled rejection (Task 11.7's zero-console bar).
    stubFetch(async () => {
      throw new Error("network down");
    });
    const results = await Promise.allSettled([loadTournamentIndex(), loadTournamentIndex()]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
  });
});
