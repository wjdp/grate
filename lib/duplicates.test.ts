import { beforeEach, describe, expect, it } from "vitest";
import { steamAppInfo as steamAppInfoTable } from "~~/db/schema";
import { db } from "~~/lib/db";
import {
  findDuplicatePairs,
  getDistinctPairs,
  markDistinct,
  unmarkDistinct,
} from "~~/lib/duplicates";
import {
  createEpicGame,
  createGame,
  createGameDistinctPair,
  createGogGame,
  createSteamGame,
} from "~~/lib/fixtures/game";
import { flushDb } from "~~/test/db";

function createSteamAppInfo(appId: number, releaseDate: Date) {
  db.insert(steamAppInfoTable)
    .values({
      appId,
      fetchedAt: new Date(),
      type: "game",
      name: "Any",
      isFree: false,
      detailedDescription: "detailed",
      aboutTheGame: "about",
      shortDescription: "short",
      headerImage: "header.jpg",
      capsuleImage: "capsule.jpg",
      capsuleImagev5: "capsulev5.jpg",
      developers: [],
      publishers: [],
      platformWindows: true,
      platformMac: false,
      platformLinux: false,
      categories: [],
      genres: [],
      screenshots: [],
      releaseDate,
      background: "background.jpg",
      backgroundRaw: "background_raw.jpg",
    })
    .run();
}

describe("findDuplicatePairs", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("pairs games whose names normalise to the same key", async () => {
    const first = createGame({ name: "Dishonored®" });
    const second = createGame({ name: "Dishonored - Definitive Edition" });
    const pairs = await findDuplicatePairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.id).toBe(first.id);
    expect(pairs[0].b.id).toBe(second.id);
  });

  it("excludes hidden games from pairs", async () => {
    createGame({ name: "Dishonored" });
    createGame({ name: "Dishonored - Definitive Edition", hidden: true });
    expect(await findDuplicatePairs()).toStrictEqual([]);
  });

  it("does not pair sequels", async () => {
    createGame({ name: "Portal" });
    createGame({ name: "Portal 2" });
    expect(await findDuplicatePairs()).toStrictEqual([]);
  });

  it("excludes opted-out pairs and restores them when unmarked", async () => {
    const first = createGame({ name: "RUINER" });
    const second = createGame({ name: "Ruiner" });
    const distinctPair = createGameDistinctPair(first.id, second.id);
    expect(await findDuplicatePairs()).toStrictEqual([]);
    await unmarkDistinct(distinctPair.id);
    expect(await findDuplicatePairs()).toHaveLength(1);
  });

  it("does not pair provider rows already merged onto one game", async () => {
    const merged = createGame({ name: "Prey" });
    createSteamGame({ gameId: merged.id, name: "PREY" });
    createEpicGame({ gameId: merged.id, name: "Prey" });
    expect(await findDuplicatePairs()).toStrictEqual([]);
  });

  it("computes the release year from the earliest provider release date", async () => {
    const steamRow = createSteamGame({ name: "Metro 2033" });
    createSteamAppInfo(steamRow.appId, new Date("2010-03-16"));
    const gogRow = createGogGame({
      name: "Metro 2033 Redux",
      releaseDate: new Date("2014-08-26"),
    });
    const pairs = await findDuplicatePairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.releaseYear).toBe(2010);
    expect(pairs[0].b.releaseYear).toBe(2014);
    expect(pairs[0].a.id).toBe(steamRow.gameId);
    expect(pairs[0].b.id).toBe(gogRow.gameId);
  });

  it("reports a null release year when no provider row has one", async () => {
    createGame({ name: "Bad North: Jotunn Edition" });
    createGame({ name: "Bad North Jotunn Edition" });
    const pairs = await findDuplicatePairs();
    expect(pairs[0].a.releaseYear).toBeNull();
    expect(pairs[0].b.releaseYear).toBeNull();
  });

  it("emits every pair when three games share a key", async () => {
    const first = createGame({ name: "Metro: Last Light Complete Edition" });
    const second = createGame({ name: "Metro: Last Light Redux" });
    const third = createGame({ name: "Metro Last Light Redux" });
    const pairs = await findDuplicatePairs();
    expect(pairs.map((pair) => [pair.a.id, pair.b.id])).toStrictEqual([
      [first.id, second.id],
      [first.id, third.id],
      [second.id, third.id],
    ]);
  });

  it("sorts pairs by the first game's name", async () => {
    createGame({ name: "Zeno Clash" });
    createGame({ name: "Zeno Clash™" });
    createGame({ name: "Amnesia" });
    createGame({ name: "Amnesia®" });
    const pairs = await findDuplicatePairs();
    expect(pairs.map((pair) => pair.a.name)).toStrictEqual([
      "Amnesia",
      "Zeno Clash",
    ]);
  });
});

describe("markDistinct", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("stores the pair with the lower id first", async () => {
    const first = createGame({ name: "BioShock" });
    const second = createGame({ name: "BioShock Remastered" });
    const pair = await markDistinct(second.id, first.id);
    expect(pair.gameAId).toBe(first.id);
    expect(pair.gameBId).toBe(second.id);
  });

  it("is idempotent", async () => {
    const first = createGame({ name: "BioShock" });
    const second = createGame({ name: "BioShock Remastered" });
    const pair = await markDistinct(first.id, second.id);
    const again = await markDistinct(second.id, first.id);
    expect(again.id).toBe(pair.id);
    expect(await getDistinctPairs()).toHaveLength(1);
  });

  it("rejects equal ids", async () => {
    const only = createGame({ name: "Celeste" });
    await expect(markDistinct(only.id, only.id)).rejects.toThrow();
  });

  it("rejects missing games", async () => {
    const only = createGame({ name: "Celeste" });
    await expect(markDistinct(only.id, only.id + 1000)).rejects.toThrow();
  });
});

describe("getDistinctPairs", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("returns both game names, newest first", async () => {
    const first = createGame({ name: "Tomb Raider" });
    const second = createGame({ name: "Tomb Raider GOTY" });
    const third = createGame({ name: "Prey" });
    const fourth = createGame({ name: "PREY" });
    await markDistinct(first.id, second.id);
    await markDistinct(third.id, fourth.id);
    const distinct = await getDistinctPairs();
    expect(distinct.map((pair) => [pair.a.name, pair.b.name])).toStrictEqual([
      ["Prey", "PREY"],
      ["Tomb Raider", "Tomb Raider GOTY"],
    ]);
  });
});

describe("unmarkDistinct", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("throws when the pair does not exist", async () => {
    await expect(unmarkDistinct(9999)).rejects.toThrow();
  });
});
