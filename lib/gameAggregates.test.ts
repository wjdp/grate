import { beforeEach, describe, expect, it } from "vitest";
import {
  createEpicGame,
  createGame,
  createGogGame,
  createSteamGame,
} from "~~/lib/fixtures/game";
import { refreshGameAggregates } from "~~/lib/gameAggregates";
import { flushDb } from "~~/test/db";

describe("refreshGameAggregates", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("uses steam playtime and lastPlayedAt when only steam game present", async () => {
    const steamGame = createSteamGame({
      playtimeForever: 120,
      rTimeLastPlayed: 1700000000,
    });
    const game = await refreshGameAggregates(steamGame.gameId);
    expect(game.playtimeMinutes).toBe(120);
    expect(game.lastPlayedAt).toStrictEqual(new Date(1700000000 * 1000));
  });

  it("uses gog playtime and lastPlayedAt when only gog game present", async () => {
    const lastPlayedAt = new Date("2024-01-01T00:00:00.000Z");
    const gogGame = createGogGame({
      playtimeMinutes: 90,
      lastPlayedAt,
    });
    const game = await refreshGameAggregates(gogGame.gameId);
    expect(game.playtimeMinutes).toBe(90);
    expect(game.lastPlayedAt).toStrictEqual(lastPlayedAt);
  });

  it("sums playtime and takes the max lastPlayedAt when both present", async () => {
    const steamLastPlayedAt = new Date(1700000000 * 1000);
    const gogLastPlayedAt = new Date("2024-06-01T00:00:00.000Z");
    const steamGame = createSteamGame({
      playtimeForever: 100,
      rTimeLastPlayed: 1700000000,
    });
    const gogGame = createGogGame({
      gameId: steamGame.gameId,
      playtimeMinutes: 50,
      lastPlayedAt: gogLastPlayedAt,
    });
    const game = await refreshGameAggregates(steamGame.gameId);
    expect(game.playtimeMinutes).toBe(150);
    expect(game.lastPlayedAt).toStrictEqual(
      steamLastPlayedAt > gogLastPlayedAt ? steamLastPlayedAt : gogLastPlayedAt,
    );
    expect(gogGame.gogId).toBeDefined();
  });

  it("sums across two gog rows on one game and takes the max lastPlayedAt", async () => {
    const firstLastPlayedAt = new Date("2024-01-01T00:00:00.000Z");
    const secondLastPlayedAt = new Date("2024-06-01T00:00:00.000Z");
    const first = createGogGame({
      name: "The Witcher 3: Wild Hunt",
      playtimeMinutes: 200,
      lastPlayedAt: firstLastPlayedAt,
    });
    createGogGame({
      gameId: first.gameId,
      name: "The Witcher 3: Wild Hunt GOTY",
      playtimeMinutes: 300,
      lastPlayedAt: secondLastPlayedAt,
    });
    const game = await refreshGameAggregates(first.gameId);
    expect(game.playtimeMinutes).toBe(500);
    expect(game.lastPlayedAt).toStrictEqual(secondLastPlayedAt);
  });

  it("uses epic playtime and lastPlayedAt when only epic game present", async () => {
    const lastPlayedAt = new Date("2024-03-01T00:00:00.000Z");
    const epicGame = createEpicGame({ playtimeMinutes: 75, lastPlayedAt });
    const game = await refreshGameAggregates(epicGame.gameId);
    expect(game.playtimeMinutes).toBe(75);
    expect(game.lastPlayedAt).toStrictEqual(lastPlayedAt);
  });

  it("sums playtime and takes the max lastPlayedAt across all three providers", async () => {
    const steamGame = createSteamGame({
      playtimeForever: 100,
      rTimeLastPlayed: 1700000000,
    });
    createGogGame({
      gameId: steamGame.gameId,
      playtimeMinutes: 50,
      lastPlayedAt: new Date("2024-06-01T00:00:00.000Z"),
    });
    const epicLastPlayedAt = new Date("2025-01-01T00:00:00.000Z");
    createEpicGame({
      gameId: steamGame.gameId,
      playtimeMinutes: 25,
      lastPlayedAt: epicLastPlayedAt,
    });
    const game = await refreshGameAggregates(steamGame.gameId);
    expect(game.playtimeMinutes).toBe(175);
    expect(game.lastPlayedAt).toStrictEqual(epicLastPlayedAt);
  });

  it("sums across two epic rows on one game and takes the max lastPlayedAt", async () => {
    const secondLastPlayedAt = new Date("2024-06-01T00:00:00.000Z");
    const first = createEpicGame({
      name: "Fortnite",
      playtimeMinutes: 200,
      lastPlayedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    createEpicGame({
      gameId: first.gameId,
      name: "Fortnite Save the World",
      playtimeMinutes: 300,
      lastPlayedAt: secondLastPlayedAt,
    });
    const game = await refreshGameAggregates(first.gameId);
    expect(game.playtimeMinutes).toBe(500);
    expect(game.lastPlayedAt).toStrictEqual(secondLastPlayedAt);
  });

  it("defaults to zero playtime and null lastPlayedAt when neither present", async () => {
    const bareGame = createGame({ name: "Bare" });
    const game = await refreshGameAggregates(bareGame.id);
    expect(game.playtimeMinutes).toBe(0);
    expect(game.lastPlayedAt).toBeNull();
  });

  it("treats steam rTimeLastPlayed of 0 as null", async () => {
    const steamGame = createSteamGame({
      playtimeForever: 5,
      rTimeLastPlayed: 0,
    });
    const game = await refreshGameAggregates(steamGame.gameId);
    expect(game.playtimeMinutes).toBe(5);
    expect(game.lastPlayedAt).toBeNull();
  });
});
