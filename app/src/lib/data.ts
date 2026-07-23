/*
 * Data access root (AD-10, FR-33). ONE build-time constant is the single flip
 * point for the Story 2.19 real-data swap: fixtures ship under /data/fixtures
 * today; flipping this to "/data" is the entire cutover. Runtime env vars are
 * structurally banned — this is a compile-time constant on purpose.
 */
export const DATA_ROOT = "/data/fixtures";

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
  return (await response.json()) as T;
}
