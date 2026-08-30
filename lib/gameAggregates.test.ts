import { describe, it, expect, beforeEach } from "vitest";
import { createSteamGame } from "~/lib/steam/fixtures/fake";
import { createGogGame } from "~/lib/gog/fixtures/fake";
import { refreshGameAggregates } from "~/lib/gameAggregates";
import { flushDb } from "~/test/db";
import prisma from "~/lib/prisma";

describe("refreshGameAggregates", () => {
  beforeEach(() => {
    flushDb();
  });

  it("uses steam playtime and lastPlayedAt when only steam game present", async () => {
    const steamGame = await createSteamGame({
      playtimeForever: 120,
      rTimeLastPlayed: 1700000000,
    });
    const game = await refreshGameAggregates(steamGame.gameId);
    expect(game.playtimeMinutes).toBe(120);
    expect(game.lastPlayedAt).toStrictEqual(new Date(1700000000 * 1000));
  });

  it("uses gog playtime and lastPlayedAt when only gog game present", async () => {
    const lastPlayedAt = new Date("2024-01-01T00:00:00.000Z");
    const gogGame = await createGogGame({
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
    const steamGame = await createSteamGame({
      playtimeForever: 100,
      rTimeLastPlayed: 1700000000,
    });
    const gogGame = await createGogGame({
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

  it("defaults to zero playtime and null lastPlayedAt when neither present", async () => {
    const bareGame = await prisma.game.create({ data: { name: "Bare" } });
    const game = await refreshGameAggregates(bareGame.id);
    expect(game.playtimeMinutes).toBe(0);
    expect(game.lastPlayedAt).toBeNull();
  });

  it("treats steam rTimeLastPlayed of 0 as null", async () => {
    const steamGame = await createSteamGame({
      playtimeForever: 5,
      rTimeLastPlayed: 0,
    });
    const game = await refreshGameAggregates(steamGame.gameId);
    expect(game.playtimeMinutes).toBe(5);
    expect(game.lastPlayedAt).toBeNull();
  });
});
