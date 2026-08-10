/*
 * Data access root (AD-10, FR-33). FLIPPED TO REAL DATA BY STORY 2.19 — this
 * read "/data/fixtures" until the cutover. Runtime env vars are structurally
 * banned; this is a compile-time constant on purpose.
 *
 * It is one of TWO constants that must agree: this one is the runtime (client
 * fetch) root, and `build-data.ts`'s is the build-time filesystem root. Nothing
 * derives one from the other, and the failure when they disagree is silent and
 * split — the pre-rendered Hero shows one corpus while the below-Hero region
 * fetches the other or 404s. `data-root-agreement.test.ts` is the guard that
 * makes flipping one alone impossible to land.
 *
 * `/data/fixtures` still exists and is still shipped; the fixture-pinned unit
 * tests read it by relative path and are deliberately NOT swept by the flip (D2).
 */
export const DATA_ROOT = "/data";

/**
 * Same-origin JSON fetch keyed off DATA_ROOT. `path` is artifact-relative
 * (e.g. "/index/tournament.json"). Full fetch-rendering lands with the route
 * stories; the scaffold ships the helper so every consumer goes through it.
 */
export async function fetchArtifact<T>(path: string): Promise<T> {
  const url = `${DATA_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`data: ${url} responded ${response.status}`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    // e.g. a host's HTML fallback page served with a 200 status.
    throw new Error(`data: ${url} returned a 200 response that is not valid JSON`);
  }
}
