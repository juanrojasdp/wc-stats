import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { PlayerProfile } from "@/lib/contract/contract-types";
import {
  HERO_TILE_METRICS,
  composePlayerDescription,
  composePlayerTitle,
  toPlayerHeroData,
} from "@/lib/player-profile";

function readProfile(slug: string): PlayerProfile {
  const file = path.join(
    process.cwd(),
    "..",
    "data",
    "fixtures",
    "index",
    "player-profiles",
    `${slug}.json`
  );
  return JSON.parse(readFileSync(file, "utf8")) as PlayerProfile;
}

const quinones = readProfile("quinones-julian-mex");
const acevedo = readProfile("acevedo-carlos-mex");

describe("composePlayerTitle", () => {
  /*
   * The expectation is a HAND-WRITTEN literal, not a template over the same
   * fragments the composer joins — that form passes even if the function
   * returns its inputs in the wrong order.
   */
  it("reads name, team, site", () => {
    expect(
      composePlayerTitle({
        playerName: "Julian QUINONES",
        teamName: "Mexico",
        siteName: "WC Stats",
        separator: " · ",
      })
    ).toBe("Julian QUINONES · Mexico · WC Stats");
  });

  it("passes both proper nouns through untranslated (AD-7)", () => {
    const title = composePlayerTitle({
      playerName: quinones.name,
      teamName: quinones.team.name,
      siteName: "WC Stats",
      separator: " · ",
    });
    expect(title).toContain("Julian QUINONES");
    expect(title).toContain("Mexico");
  });
});

describe("composePlayerDescription", () => {
  it("reads position, team", () => {
    expect(
      composePlayerDescription({
        positionLabel: "Delantero",
        teamName: "Mexico",
        separator: " · ",
      })
    ).toBe("Delantero · Mexico");
  });
});

describe("toPlayerHeroData", () => {
  it("projects the identity block verbatim", () => {
    const hero = toPlayerHeroData(quinones);
    expect(hero.playerId).toBe("quinones-julian-mex");
    expect(hero.name).toBe("Julian QUINONES");
    expect(hero.team).toEqual({ id: "mexico", name: "Mexico" });
    expect(hero.position).toBe("fw");
    expect(hero.shirtNumber).toBe(16);
    expect(hero.appearances).toEqual({
      played: 5,
      started: 5,
      substituteAppearances: 0,
      minutesPlayed: 414,
    });
  });

  it("selects exactly the four ruled tiles, in tile order (D5)", () => {
    expect(HERO_TILE_METRICS).toEqual(["goals", "topSpeed", "totalDistance", "passCompletion"]);
    expect(toPlayerHeroData(quinones).tiles).toEqual([
      { metricCode: "goals", value: 4 },
      { metricCode: "topSpeed", value: 33 },
      { metricCode: "totalDistance", value: 47274.9 },
      { metricCode: "passCompletion", value: 82.2 },
    ]);
  });

  it("carries NO aggregates, matches, trends or physical block (AD-11)", () => {
    // Inlining the artifact into the HTML would ship every byte twice on all
    // 1,248 routes; the region fetches it below the Hero.
    expect(Object.keys(toPlayerHeroData(quinones))).toEqual([
      "playerId",
      "name",
      "team",
      "position",
      "shirtNumber",
      "appearances",
      "tiles",
    ]);
  });

  it("projects the zero-appearance goalkeeper without a shape branch", () => {
    const hero = toPlayerHeroData(acevedo);
    expect(hero.position).toBe("gk");
    expect(hero.appearances.played).toBe(0);
    expect(hero.tiles.map((tile) => tile.value)).toEqual([0, 0, 0, 0]);
  });

  it("throws NAMING the player and the code when an aggregate is missing", () => {
    const broken = {
      ...quinones,
      aggregates: quinones.aggregates.filter((a) => a.metricCode !== "topSpeed"),
    } as PlayerProfile;
    expect(() => toPlayerHeroData(broken)).toThrow(/quinones-julian-mex.*topSpeed/s);
  });
});
