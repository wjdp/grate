import { describe, it, expect, beforeEach } from "vitest";
import {
  getGame,
  getGamePlaytimes,
  getGames,
  getRecentGames,
  setGameState,
} from "~/lib/games";
import { createGame, createSteamGame } from "~/lib/steam/fixtures/fake";
import prisma from "~/lib/prisma";
import { flushDb } from "~/test/db";

describe("getGames", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("returns an empty list when there are no games", async () => {
    expect(await getGames()).toStrictEqual([]);
  });

  it("returns all games ordered by name ascending", async () => {
    await createGame({ name: "Celeste" });
    await createGame({ name: "Antichamber" });
    await createGame({ name: "Baba Is You" });
    const games = await getGames();
    expect(games.map((game) => game.name)).toStrictEqual([
      "Antichamber",
      "Baba Is You",
      "Celeste",
    ]);
  });

  it("includes steamGame, null for non-steam games", async () => {
    const steamGame = await createSteamGame({ name: "Aperture Desk Job" });
    await createGame({ name: "Blue Prince" });
    const games = await getGames();
    expect(games[0].steamGame?.appId).toBe(steamGame.appId);
    expect(games[1].steamGame).toBeNull();
  });
});

describe("getGame", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("returns null for a missing id", async () => {
    expect(await getGame(123456)).toBeNull();
  });

  it("returns the game with its steamGame and appInfo", async () => {
    const steamGame = await createSteamGame({ name: "Portal 2" });
    await prisma.steamAppInfo.create({
      data: {
        appId: steamGame.appId,
        fetchedAt: new Date(),
        type: "game",
        name: "Portal 2",
        isFree: false,
        detailedDescription: "detailed",
        aboutTheGame: "about",
        shortDescription: "short",
        headerImage: "header.jpg",
        capsuleImage: "capsule.jpg",
        capsuleImagev5: "capsulev5.jpg",
        developers: ["Valve"],
        publishers: ["Valve"],
        platformWindows: true,
        platformMac: true,
        platformLinux: true,
        categories: [],
        genres: [],
        screenshots: [],
        background: "background.jpg",
        backgroundRaw: "background_raw.jpg",
      },
    });
    const game = await getGame(steamGame.gameId);
    expect(game?.name).toBe("Portal 2");
    expect(game?.steamGame?.appInfo?.name).toBe("Portal 2");
  });

  it("returns null steamGame for a non-steam game", async () => {
    const bareGame = await createGame({ name: "Tunic" });
    const game = await getGame(bareGame.id);
    expect(game?.steamGame).toBeNull();
  });
});

describe("getGamePlaytimes", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("throws when the game does not exist", async () => {
    await expect(getGamePlaytimes(123456)).rejects.toThrow("Game not found");
  });

  it("throws when the game is not a Steam game", async () => {
    const bareGame = await createGame({ name: "Hollow Knight" });
    await expect(getGamePlaytimes(bareGame.id)).rejects.toThrow(
      "Game is not a Steam game",
    );
  });

  it("returns the playtime records ordered by timestampStart descending", async () => {
    const steamGame = await createSteamGame();
    const otherSteamGame = await createSteamGame();
    const timestamps = [
      new Date("2024-01-01T00:00:00.000Z"),
      new Date("2024-03-01T00:00:00.000Z"),
      new Date("2024-02-01T00:00:00.000Z"),
    ];
    for (const timestampStart of timestamps) {
      await prisma.steamGamePlaytime.create({
        data: {
          steamAppId: steamGame.appId,
          timestampStart,
          timestampEnd: new Date("2024-04-01T00:00:00.000Z"),
          playtimeForever: 10,
        },
      });
    }
    await prisma.steamGamePlaytime.create({
      data: {
        steamAppId: otherSteamGame.appId,
        timestampStart: new Date("2024-05-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-06-01T00:00:00.000Z"),
        playtimeForever: 99,
      },
    });
    const playtimes = await getGamePlaytimes(steamGame.gameId);
    expect(playtimes.map((playtime) => playtime.timestampStart)).toStrictEqual([
      new Date("2024-03-01T00:00:00.000Z"),
      new Date("2024-02-01T00:00:00.000Z"),
      new Date("2024-01-01T00:00:00.000Z"),
    ]);
  });
});

describe("getRecentGames", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("excludes games without a steamGame", async () => {
    await createGame({ name: "Balatro" });
    expect(await getRecentGames()).toStrictEqual([]);
  });

  it("excludes steam games with a null rTimeLastPlayed", async () => {
    await createSteamGame({ name: "Never Played", rTimeLastPlayed: null });
    expect(await getRecentGames()).toStrictEqual([]);
  });

  it("orders by rTimeLastPlayed descending", async () => {
    await createSteamGame({ name: "Oldest", rTimeLastPlayed: 1000 });
    await createSteamGame({ name: "Newest", rTimeLastPlayed: 3000 });
    await createSteamGame({ name: "Middle", rTimeLastPlayed: 2000 });
    const games = await getRecentGames();
    expect(games.map((game) => game.name)).toStrictEqual([
      "Newest",
      "Middle",
      "Oldest",
    ]);
  });

  it("defaults to a limit of six", async () => {
    for (let index = 0; index < 8; index++) {
      await createSteamGame({ rTimeLastPlayed: 1000 + index });
    }
    expect(await getRecentGames()).toHaveLength(6);
  });

  it("respects an explicit limit", async () => {
    for (let index = 0; index < 8; index++) {
      await createSteamGame({ rTimeLastPlayed: 1000 + index });
    }
    expect(await getRecentGames(2)).toHaveLength(2);
  });
});

describe("setGameState", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("throws when the game does not exist", async () => {
    await expect(setGameState(123456, "BACKLOG")).rejects.toThrow(
      "Game not found",
    );
  });

  it("updates the state and records a state change", async () => {
    const game = await createGame({ name: "Outer Wilds" });
    const updatedGame = await setGameState(game.id, "PLAYING");
    expect(updatedGame.state).toBe("PLAYING");
    const stateChanges = await prisma.gameStateChange.findMany({
      where: { gameId: game.id },
    });
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0].state).toBe("PLAYING");
  });

  it("does nothing when the state is unchanged", async () => {
    const game = await createGame({ name: "Stardew Valley" });
    await setGameState(game.id, "BACKLOG");
    const unchangedGame = await setGameState(game.id, "BACKLOG");
    expect(unchangedGame.state).toBe("BACKLOG");
    expect(
      await prisma.gameStateChange.count({ where: { gameId: game.id } }),
    ).toBe(1);
  });

  it("does nothing when clearing an already null state", async () => {
    const game = await createGame({ name: "Return of the Obra Dinn" });
    const unchangedGame = await setGameState(game.id, null);
    expect(unchangedGame.state).toBeNull();
    expect(
      await prisma.gameStateChange.count({ where: { gameId: game.id } }),
    ).toBe(0);
  });

  it("clears the state and records a null state change", async () => {
    const game = await createGame({ name: "Disco Elysium" });
    await setGameState(game.id, "COMPLETED");
    const clearedGame = await setGameState(game.id, null);
    expect(clearedGame.state).toBeNull();
    const stateChanges = await prisma.gameStateChange.findMany({
      where: { gameId: game.id },
      orderBy: { id: "asc" },
    });
    expect(stateChanges.map((change) => change.state)).toStrictEqual([
      "COMPLETED",
      null,
    ]);
  });
});
