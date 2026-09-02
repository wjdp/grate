process.env.TZ = "UTC";

import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createEpicGame,
  createGame,
  createGameDistinctPair,
  createGogGame,
  createSteamGame,
} from "~~/lib/fixtures/game";
import { db } from "~~/server/database/client";
import {
  epicGamePlaytime as epicGamePlaytimeTable,
  gameDistinctPair as gameDistinctPairTable,
  gameStateChange as gameStateChangeTable,
  game as gameTable,
  gogGamePlaytime as gogGamePlaytimeTable,
  gogGame as gogGameTable,
  steamAppInfo as steamAppInfoTable,
  steamGamePlaytime as steamGamePlaytimeTable,
} from "~~/server/database/schema";
import {
  getGame,
  getGamePlaytimes,
  getGames,
  getGameTimeline,
  getRecentGames,
  mergeGames,
  setGameHidden,
  setGameState,
  splitGame,
} from "~~/server/services/games";
import { flushDb } from "~~/test/db";

function stateChangesFor(gameId: number) {
  return db
    .select()
    .from(gameStateChangeTable)
    .where(eq(gameStateChangeTable.gameId, gameId))
    .orderBy(asc(gameStateChangeTable.id))
    .all();
}

describe("getGames", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("returns an empty list when there are no games", async () => {
    expect(await getGames()).toStrictEqual([]);
  });

  it("returns all games ordered by name ascending", async () => {
    createGame({ name: "Celeste" });
    createGame({ name: "Antichamber" });
    createGame({ name: "Baba Is You" });
    const games = await getGames();
    expect(games.map((game) => game.name)).toStrictEqual([
      "Antichamber",
      "Baba Is You",
      "Celeste",
    ]);
  });

  it("includes provider rows, empty when the provider is absent", async () => {
    const steamGame = createSteamGame({ name: "Aperture Desk Job" });
    createGame({ name: "Blue Prince" });
    const gogGame = createGogGame({ name: "Cyberpunk 2077" });
    const games = await getGames();
    expect(games[0].steamGames.map((row) => row.appId)).toStrictEqual([
      steamGame.appId,
    ]);
    expect(games[0].gogGames).toStrictEqual([]);
    expect(games[1].steamGames).toStrictEqual([]);
    expect(games[1].gogGames).toStrictEqual([]);
    expect(games[2].gogGames.map((row) => row.gogId)).toStrictEqual([
      gogGame.gogId,
    ]);
    expect(games[2].steamGames).toStrictEqual([]);
  });

  it("returns several rows of the same provider on one game", async () => {
    const first = createGogGame({ name: "The Witcher 3: Wild Hunt" });
    const second = createGogGame({
      gameId: first.gameId,
      name: "The Witcher 3: Wild Hunt GOTY",
    });
    const games = await getGames();
    expect(games).toHaveLength(1);
    expect(games[0].gogGames.map((row) => row.gogId)).toStrictEqual(
      [first.gogId, second.gogId].sort((a, b) => a - b),
    );
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
    const steamGame = createSteamGame({ name: "Portal 2" });
    db.insert(steamAppInfoTable)
      .values({
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
      })
      .run();
    const game = await getGame(steamGame.gameId);
    expect(game?.name).toBe("Portal 2");
    expect(game?.steamGames[0]?.appInfo?.name).toBe("Portal 2");
  });

  it("returns no provider rows for a game with neither", async () => {
    const bareGame = createGame({ name: "Tunic" });
    const game = await getGame(bareGame.id);
    expect(game?.steamGames).toStrictEqual([]);
    expect(game?.gogGames).toStrictEqual([]);
  });

  it("returns the game with its gog row", async () => {
    const gogGame = createGogGame({ name: "Baldur's Gate 3" });
    const game = await getGame(gogGame.gameId);
    expect(game?.gogGames[0]?.gogId).toBe(gogGame.gogId);
  });
});

describe("getGamePlaytimes", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("throws when the game does not exist", async () => {
    await expect(getGamePlaytimes(123456)).rejects.toThrow("Game not found");
  });

  it("returns an empty list for a game with no providers", async () => {
    const bareGame = createGame({ name: "Hollow Knight" });
    expect(await getGamePlaytimes(bareGame.id)).toStrictEqual([]);
  });

  it("returns the playtime records ordered by timestampStart descending", async () => {
    const steamGame = createSteamGame();
    const otherSteamGame = createSteamGame();
    const timestamps = [
      new Date("2024-01-01T00:00:00.000Z"),
      new Date("2024-03-01T00:00:00.000Z"),
      new Date("2024-02-01T00:00:00.000Z"),
    ];
    for (const timestampStart of timestamps) {
      db.insert(steamGamePlaytimeTable)
        .values({
          steamAppId: steamGame.appId,
          timestampStart,
          timestampEnd: new Date("2024-04-01T00:00:00.000Z"),
          playtimeForever: 10,
        })
        .run();
    }
    db.insert(steamGamePlaytimeTable)
      .values({
        steamAppId: otherSteamGame.appId,
        timestampStart: new Date("2024-05-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-06-01T00:00:00.000Z"),
        playtimeForever: 99,
      })
      .run();
    const playtimes = await getGamePlaytimes(steamGame.gameId);
    expect(playtimes.map((playtime) => playtime.timestampStart)).toStrictEqual([
      new Date("2024-03-01T00:00:00.000Z"),
      new Date("2024-02-01T00:00:00.000Z"),
      new Date("2024-01-01T00:00:00.000Z"),
    ]);
    expect(playtimes.map((playtime) => playtime.playtimeMinutes)).toStrictEqual(
      [10, 10, 10],
    );
    expect(playtimes.every((playtime) => playtime.provider === "steam")).toBe(
      true,
    );
  });

  it("maps a null steam playtimeForever to zero minutes", async () => {
    const steamGame = createSteamGame();
    db.insert(steamGamePlaytimeTable)
      .values({
        steamAppId: steamGame.appId,
        timestampStart: new Date("2024-01-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-01-02T00:00:00.000Z"),
        playtimeForever: null,
      })
      .run();
    const playtimes = await getGamePlaytimes(steamGame.gameId);
    expect(playtimes[0].playtimeMinutes).toBe(0);
  });

  it("returns the gog records for a gog-only game", async () => {
    const gogGame = createGogGame();
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: gogGame.gogId,
        timestampStart: new Date("2024-01-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-01-02T00:00:00.000Z"),
        playtimeMinutes: 42,
      })
      .run();
    const playtimes = await getGamePlaytimes(gogGame.gameId);
    expect(playtimes).toStrictEqual([
      {
        timestampStart: new Date("2024-01-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-01-02T00:00:00.000Z"),
        playtimeMinutes: 42,
        provider: "gog",
        providerId: gogGame.gogId,
        providerName: gogGame.name,
      },
    ]);
  });

  it("returns the epic records for an epic-only game", async () => {
    const epicGame = createEpicGame();
    db.insert(epicGamePlaytimeTable)
      .values({
        epicId: epicGame.epicId,
        timestampStart: new Date("2024-03-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-03-02T00:00:00.000Z"),
        playtimeMinutes: 77,
      })
      .run();
    const playtimes = await getGamePlaytimes(epicGame.gameId);
    expect(playtimes).toStrictEqual([
      {
        timestampStart: new Date("2024-03-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-03-02T00:00:00.000Z"),
        playtimeMinutes: 77,
        provider: "epic",
        providerId: epicGame.epicId,
        providerName: epicGame.name,
      },
    ]);
  });

  it("returns a record per provider row when one game owns two gog rows", async () => {
    const first = createGogGame({ name: "The Witcher 3: Wild Hunt" });
    const second = createGogGame({
      gameId: first.gameId,
      name: "The Witcher 3: Wild Hunt GOTY",
    });
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: first.gogId,
        timestampStart: new Date("2024-01-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-01-02T00:00:00.000Z"),
        playtimeMinutes: 10,
      })
      .run();
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: second.gogId,
        timestampStart: new Date("2024-02-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-02-02T00:00:00.000Z"),
        playtimeMinutes: 20,
      })
      .run();
    const playtimes = await getGamePlaytimes(first.gameId);
    expect(playtimes).toHaveLength(2);
    expect(
      playtimes.map((playtime) => playtime.providerId).sort((a, b) => a - b),
    ).toStrictEqual([first.gogId, second.gogId].sort((a, b) => a - b));
    expect(new Set(playtimes.map((playtime) => playtime.providerName))).toEqual(
      new Set([first.name, second.name]),
    );
  });

  it("merges both providers, ordering nulls last", async () => {
    const steamGame = createSteamGame();
    const gogGame = createGogGame();
    db.update(gogGameTable)
      .set({ gameId: steamGame.gameId })
      .where(eq(gogGameTable.gogId, gogGame.gogId))
      .run();
    db.insert(steamGamePlaytimeTable)
      .values({
        steamAppId: steamGame.appId,
        timestampStart: new Date("2024-02-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-02-02T00:00:00.000Z"),
        playtimeForever: 10,
      })
      .run();
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: gogGame.gogId,
        timestampStart: new Date("2024-03-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-03-02T00:00:00.000Z"),
        playtimeMinutes: 20,
      })
      .run();
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: gogGame.gogId,
        timestampStart: null,
        timestampEnd: new Date("2024-04-02T00:00:00.000Z"),
        playtimeMinutes: 30,
      })
      .run();
    const playtimes = await getGamePlaytimes(steamGame.gameId);
    expect(
      playtimes.map((playtime) => [
        playtime.provider,
        playtime.playtimeMinutes,
      ]),
    ).toStrictEqual([
      ["gog", 20],
      ["steam", 10],
      ["gog", 30],
    ]);
  });
});

describe("getGameTimeline", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("throws when the game does not exist", async () => {
    await expect(getGameTimeline(123456)).rejects.toThrow("Game not found");
  });

  it("derives one session from the cyberpunk-shaped gog records", async () => {
    const gogGame = createGogGame({ name: "Cyberpunk 2077" });
    const records = [
      {
        timestampStart: null,
        timestampEnd: new Date("2026-08-30T14:14:45.000Z"),
        playtimeMinutes: 11336,
      },
      {
        timestampStart: new Date("2026-08-30T14:14:45.000Z"),
        timestampEnd: new Date("2026-08-31T20:39:20.000Z"),
        playtimeMinutes: 11336,
      },
      {
        timestampStart: new Date("2026-08-31T20:39:20.000Z"),
        timestampEnd: new Date("2026-08-31T20:43:46.000Z"),
        playtimeMinutes: 11406,
      },
      {
        timestampStart: new Date("2026-08-31T20:43:46.000Z"),
        timestampEnd: new Date("2026-09-01T01:00:06.000Z"),
        playtimeMinutes: 11406,
      },
    ];
    for (const record of records) {
      db.insert(gogGamePlaytimeTable)
        .values({ gogId: gogGame.gogId, ...record })
        .run();
    }
    const sessions = await getGameTimeline(gogGame.gameId);
    expect(sessions).toStrictEqual([
      {
        provider: "gog",
        providerId: gogGame.gogId,
        providerName: gogGame.name,
        minutes: 70,
        endedAfter: new Date("2026-08-31T20:39:20.000Z"),
        endedBefore: new Date("2026-08-31T20:43:46.000Z"),
        estimatedStart: new Date("2026-08-31T19:33:46.000Z"),
        estimatedEnd: new Date("2026-08-31T20:43:46.000Z"),
        uncertaintyMinutes: 70,
        anchored: false,
        playDay: "2026-08-31",
      },
    ]);
  });

  it("counts a session ending before the day boundary towards the day before", async () => {
    const gogGame = createGogGame({ name: "Blue Prince" });
    const records = [
      {
        timestampStart: null,
        timestampEnd: new Date("2026-08-31T22:00:00.000Z"),
        playtimeMinutes: 100,
      },
      {
        timestampStart: new Date("2026-08-31T22:00:00.000Z"),
        timestampEnd: new Date("2026-09-01T01:00:00.000Z"),
        playtimeMinutes: 160,
      },
    ];
    for (const record of records) {
      db.insert(gogGamePlaytimeTable)
        .values({ gogId: gogGame.gogId, ...record })
        .run();
    }
    const sessions = await getGameTimeline(gogGame.gameId);
    expect(sessions.map((session) => session.playDay)).toStrictEqual([
      "2026-08-31",
    ]);
  });

  it("merges sessions across providers, newest first", async () => {
    const steamGame = createSteamGame({ name: "Portal 2" });
    const gogGame = createGogGame({
      gameId: steamGame.gameId,
      name: "Portal 2 GOG",
    });
    db.insert(steamGamePlaytimeTable)
      .values({
        steamAppId: steamGame.appId,
        timestampStart: null,
        timestampEnd: new Date("2024-01-01T00:00:00.000Z"),
        playtimeForever: 100,
        rTimeLastPlayed: 0,
      })
      .run();
    db.insert(steamGamePlaytimeTable)
      .values({
        steamAppId: steamGame.appId,
        timestampStart: new Date("2024-01-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-01-01T01:00:00.000Z"),
        playtimeForever: 130,
        rTimeLastPlayed: Math.floor(
          new Date("2024-01-01T00:20:00.000Z").getTime() / 1000,
        ),
      })
      .run();
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: gogGame.gogId,
        timestampStart: null,
        timestampEnd: new Date("2024-02-01T00:00:00.000Z"),
        playtimeMinutes: 500,
      })
      .run();
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: gogGame.gogId,
        timestampStart: new Date("2024-02-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-02-01T01:00:00.000Z"),
        playtimeMinutes: 545,
      })
      .run();
    const sessions = await getGameTimeline(steamGame.gameId);
    expect(
      sessions.map((session) => [
        session.provider,
        session.minutes,
        session.anchored,
        session.endedBefore,
      ]),
    ).toStrictEqual([
      ["gog", 45, false, new Date("2024-02-01T01:00:00.000Z")],
      ["steam", 30, true, new Date("2024-01-01T01:00:00.000Z")],
    ]);
  });

  it("returns no sessions for a game with no providers", async () => {
    const bareGame = createGame({ name: "Hollow Knight" });
    expect(await getGameTimeline(bareGame.id)).toStrictEqual([]);
  });
});

describe("getRecentGames", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("excludes games with a null lastPlayedAt", async () => {
    createGame({ name: "Balatro" });
    createSteamGame({ name: "Never Played" });
    expect(await getRecentGames()).toStrictEqual([]);
  });

  it("orders by lastPlayedAt descending, across providers", async () => {
    const steamGame = createSteamGame({ name: "Newest" });
    db.update(gameTable)
      .set({ lastPlayedAt: new Date("2024-03-01T00:00:00.000Z") })
      .where(eq(gameTable.id, steamGame.gameId))
      .run();
    const gogGame = createGogGame({ name: "Middle" });
    db.update(gameTable)
      .set({ lastPlayedAt: new Date("2024-02-01T00:00:00.000Z") })
      .where(eq(gameTable.id, gogGame.gameId))
      .run();
    createGame({
      name: "Oldest",
      lastPlayedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    const games = await getRecentGames();
    expect(games.map((game) => game.name)).toStrictEqual([
      "Newest",
      "Middle",
      "Oldest",
    ]);
    expect(games[1].gogGames[0]?.gogId).toBe(gogGame.gogId);
  });

  it("defaults to a limit of six", async () => {
    for (let index = 0; index < 8; index++) {
      createGame({ lastPlayedAt: new Date(2024, 0, index + 1) });
    }
    expect(await getRecentGames()).toHaveLength(6);
  });

  it("respects an explicit limit", async () => {
    for (let index = 0; index < 8; index++) {
      createGame({ lastPlayedAt: new Date(2024, 0, index + 1) });
    }
    expect(await getRecentGames(2)).toHaveLength(2);
  });

  it("excludes hidden games", async () => {
    createGame({
      name: "Wallpaper Engine",
      lastPlayedAt: new Date("2024-03-01T00:00:00.000Z"),
      hidden: true,
    });
    createGame({
      name: "Hades",
      lastPlayedAt: new Date("2024-02-01T00:00:00.000Z"),
    });
    expect((await getRecentGames()).map((game) => game.name)).toStrictEqual([
      "Hades",
    ]);
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
    const game = createGame({ name: "Outer Wilds" });
    const updatedGame = await setGameState(game.id, "PLAYING");
    expect(updatedGame.state).toBe("PLAYING");
    const stateChanges = stateChangesFor(game.id);
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0].state).toBe("PLAYING");
  });

  it("does nothing when the state is unchanged", async () => {
    const game = createGame({ name: "Stardew Valley" });
    await setGameState(game.id, "BACKLOG");
    const unchangedGame = await setGameState(game.id, "BACKLOG");
    expect(unchangedGame.state).toBe("BACKLOG");
    expect(stateChangesFor(game.id)).toHaveLength(1);
  });

  it("does nothing when clearing an already null state", async () => {
    const game = createGame({ name: "Return of the Obra Dinn" });
    const unchangedGame = await setGameState(game.id, null);
    expect(unchangedGame.state).toBeNull();
    expect(stateChangesFor(game.id)).toHaveLength(0);
  });

  it("clears the state and records a null state change", async () => {
    const game = createGame({ name: "Disco Elysium" });
    await setGameState(game.id, "COMPLETED");
    const clearedGame = await setGameState(game.id, null);
    expect(clearedGame.state).toBeNull();
    const stateChanges = stateChangesFor(game.id);
    expect(stateChanges.map((change) => change.state)).toStrictEqual([
      "COMPLETED",
      null,
    ]);
  });
});

describe("setGameHidden", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("throws when the game does not exist", async () => {
    await expect(setGameHidden(123456, true)).rejects.toThrow("Game not found");
  });

  it("hides and unhides a game without recording a state change", async () => {
    const game = createGame({ name: "SteamVR" });
    expect(game.hidden).toBe(false);

    const hiddenGame = await setGameHidden(game.id, true);
    expect(hiddenGame.hidden).toBe(true);
    expect(gameById(game.id)?.hidden).toBe(true);

    const shownGame = await setGameHidden(game.id, false);
    expect(shownGame.hidden).toBe(false);
    expect(gameById(game.id)?.hidden).toBe(false);
    expect(stateChangesFor(game.id)).toHaveLength(0);
  });
});

function gameById(id: number) {
  return db.select().from(gameTable).where(eq(gameTable.id, id)).get() ?? null;
}

function allGames() {
  return db.select().from(gameTable).all();
}

function distinctPairs() {
  return db
    .select()
    .from(gameDistinctPairTable)
    .orderBy(asc(gameDistinctPairTable.id))
    .all();
}

describe("mergeGames", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("moves steam and gog rows onto the target and deletes the source", async () => {
    const steamGame = createSteamGame({
      name: "Cyberpunk 2077",
      playtimeForever: 120,
      rTimeLastPlayed: Math.floor(
        new Date("2024-05-01T00:00:00.000Z").getTime() / 1000,
      ),
    });
    const gogGame = createGogGame({
      name: "Cyberpunk 2077 GOG",
      playtimeMinutes: 30,
      lastPlayedAt: new Date("2024-06-01T00:00:00.000Z"),
    });
    await setGameState(gogGame.gameId, "PLAYING");
    const merged = await mergeGames(steamGame.gameId, [gogGame.gameId]);

    expect(allGames()).toHaveLength(1);
    expect(gameById(gogGame.gameId)).toBeNull();
    expect(merged.name).toBe("Cyberpunk 2077");
    expect(merged.playtimeMinutes).toBe(150);
    expect(merged.lastPlayedAt).toStrictEqual(
      new Date("2024-06-01T00:00:00.000Z"),
    );
    const game = await getGame(steamGame.gameId);
    expect(game?.steamGames.map((row) => row.appId)).toStrictEqual([
      steamGame.appId,
    ]);
    expect(game?.gogGames.map((row) => row.gogId)).toStrictEqual([
      gogGame.gogId,
    ]);
    expect(
      stateChangesFor(steamGame.gameId).map((change) => change.state),
    ).toStrictEqual(["PLAYING", "PLAYING"]);
  });

  it("moves several rows of the same provider onto the target", async () => {
    const first = createGogGame({
      name: "The Witcher 3: Wild Hunt",
      playtimeMinutes: 100,
    });
    const second = createGogGame({
      name: "The Witcher 3: Wild Hunt Complete Edition",
      playtimeMinutes: 250,
    });
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: first.gogId,
        timestampStart: new Date("2024-01-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-01-02T00:00:00.000Z"),
        playtimeMinutes: 100,
      })
      .run();
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: second.gogId,
        timestampStart: new Date("2024-02-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-02-02T00:00:00.000Z"),
        playtimeMinutes: 250,
      })
      .run();
    const merged = await mergeGames(first.gameId, [second.gameId]);

    expect(merged.playtimeMinutes).toBe(350);
    const game = await getGame(first.gameId);
    expect(
      game?.gogGames.map((row) => row.gogId).sort((a, b) => a - b),
    ).toStrictEqual([first.gogId, second.gogId].sort((a, b) => a - b));
    const playtimes = await getGamePlaytimes(first.gameId);
    expect(
      playtimes.map((playtime) => playtime.providerId).sort((a, b) => a - b),
    ).toStrictEqual([first.gogId, second.gogId].sort((a, b) => a - b));
  });

  it("brings the playtime records of every source across", async () => {
    const target = createSteamGame({ name: "Target" });
    const source = createGogGame({ name: "Source" });
    db.insert(steamGamePlaytimeTable)
      .values({
        steamAppId: target.appId,
        timestampStart: new Date("2024-01-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-01-02T00:00:00.000Z"),
        playtimeForever: 10,
      })
      .run();
    db.insert(gogGamePlaytimeTable)
      .values({
        gogId: source.gogId,
        timestampStart: new Date("2024-02-01T00:00:00.000Z"),
        timestampEnd: new Date("2024-02-02T00:00:00.000Z"),
        playtimeMinutes: 20,
      })
      .run();
    await mergeGames(target.gameId, [source.gameId]);
    const playtimes = await getGamePlaytimes(target.gameId);
    expect(
      playtimes.map((playtime) => [
        playtime.provider,
        playtime.playtimeMinutes,
      ]),
    ).toStrictEqual([
      ["gog", 20],
      ["steam", 10],
    ]);
  });

  it("adopts the most recently changed source state when the target has none", async () => {
    const target = createGame({ name: "Target" });
    const older = createGame({ name: "Older" });
    const newer = createGame({ name: "Newer" });
    await setGameState(older.id, "BACKLOG");
    await setGameState(newer.id, "COMPLETED");
    db.update(gameStateChangeTable)
      .set({ timestamp: new Date("2024-01-01T00:00:00.000Z") })
      .where(eq(gameStateChangeTable.gameId, older.id))
      .run();
    db.update(gameStateChangeTable)
      .set({ timestamp: new Date("2024-02-01T00:00:00.000Z") })
      .where(eq(gameStateChangeTable.gameId, newer.id))
      .run();

    const merged = await mergeGames(target.id, [older.id, newer.id]);

    expect(merged.state).toBe("COMPLETED");
    const stateChanges = stateChangesFor(target.id);
    expect(stateChanges).toHaveLength(3);
    expect(stateChanges.at(-1)?.state).toBe("COMPLETED");
  });

  it("adopts a source state that has no history rows", async () => {
    const target = createGame({ name: "Target" });
    const source = createGame({ name: "Source", state: "PLAYING" });

    const merged = await mergeGames(target.id, [source.id]);

    expect(merged.state).toBe("PLAYING");
    expect(
      stateChangesFor(target.id).map((change) => change.state),
    ).toStrictEqual(["PLAYING"]);
  });

  it("keeps the target state and discards the source state", async () => {
    const target = createGame({ name: "Target" });
    const source = createGame({ name: "Source" });
    await setGameState(target.id, "PLAYING");
    await setGameState(source.id, "COMPLETED");

    const merged = await mergeGames(target.id, [source.id]);

    expect(merged.state).toBe("PLAYING");
    expect(
      stateChangesFor(target.id).map((change) => change.state),
    ).toStrictEqual(["PLAYING", "COMPLETED"]);
  });

  it("rejects an empty source list", async () => {
    const target = createGame({ name: "Target" });
    await expect(mergeGames(target.id, [])).rejects.toThrow(
      "No source games given to merge",
    );
  });

  it("rejects merging a game into itself", async () => {
    const target = createGame({ name: "Target" });
    await expect(mergeGames(target.id, [target.id])).rejects.toThrow(
      "Cannot merge a game into itself",
    );
  });

  it("rejects duplicate source ids", async () => {
    const target = createGame({ name: "Target" });
    const source = createGame({ name: "Source" });
    await expect(mergeGames(target.id, [source.id, source.id])).rejects.toThrow(
      "Duplicate source game ids",
    );
  });

  it("moves epic rows onto the target and deletes the source", async () => {
    const steamGame = createSteamGame({
      name: "Alan Wake 2",
      playtimeForever: 30,
      rTimeLastPlayed: Math.floor(
        new Date("2024-04-01T00:00:00.000Z").getTime() / 1000,
      ),
    });
    const epicGame = createEpicGame({
      name: "Alan Wake 2 Epic",
      playtimeMinutes: 90,
      lastPlayedAt: new Date("2024-05-01T00:00:00.000Z"),
    });

    const merged = await mergeGames(steamGame.gameId, [epicGame.gameId]);

    expect(merged.playtimeMinutes).toBe(120);
    expect(merged.lastPlayedAt).toStrictEqual(
      new Date("2024-05-01T00:00:00.000Z"),
    );
    expect(gameById(epicGame.gameId)).toBeNull();
    const game = await getGame(steamGame.gameId);
    expect(game?.epicGames.map((row) => row.epicId)).toStrictEqual([
      epicGame.epicId,
    ]);
  });

  it("rejects an unknown target", async () => {
    const source = createGame({ name: "Source" });
    await expect(mergeGames(123456, [source.id])).rejects.toThrow(
      "Game 123456 not found",
    );
  });

  it("writes nothing when a source is unknown", async () => {
    const target = createSteamGame({ name: "Target" });
    const source = createGogGame({ name: "Source" });
    await setGameState(source.gameId, "PLAYING");

    await expect(
      mergeGames(target.gameId, [source.gameId, 123456]),
    ).rejects.toThrow("Game 123456 not found");

    expect(allGames()).toHaveLength(2);
    expect(gameById(target.gameId)?.state).toBeNull();
    expect(stateChangesFor(target.gameId)).toHaveLength(0);
    expect(stateChangesFor(source.gameId)).toHaveLength(1);
    const targetGame = await getGame(target.gameId);
    expect(targetGame?.gogGames).toStrictEqual([]);
  });

  it("re-points a distinct pair from the source onto the target", async () => {
    const target = createGame({ name: "Target" });
    const other = createGame({ name: "Other" });
    const source = createGame({ name: "Source" });
    createGameDistinctPair(source.id, other.id);

    await mergeGames(target.id, [source.id]);

    expect(
      distinctPairs().map((pair) => [pair.gameAId, pair.gameBId]),
    ).toStrictEqual([[target.id, other.id]]);
  });

  it("drops a distinct pair between the target and a source", async () => {
    const target = createGame({ name: "Target" });
    const source = createGame({ name: "Source" });
    createGameDistinctPair(target.id, source.id);

    await mergeGames(target.id, [source.id]);

    expect(distinctPairs()).toStrictEqual([]);
  });

  it("collapses distinct pairs that become duplicates", async () => {
    const target = createGame({ name: "Target" });
    const other = createGame({ name: "Other" });
    const source = createGame({ name: "Source" });
    createGameDistinctPair(target.id, other.id);
    createGameDistinctPair(source.id, other.id);

    await mergeGames(target.id, [source.id]);

    expect(
      distinctPairs().map((pair) => [pair.gameAId, pair.gameBId]),
    ).toStrictEqual([
      [Math.min(target.id, other.id), Math.max(target.id, other.id)],
    ]);
  });

  it("keeps the pair ordering when re-mapping reverses the ids", async () => {
    const other = createGame({ name: "Other" });
    const source = createGame({ name: "Source" });
    const target = createGame({ name: "Target" });
    createGameDistinctPair(other.id, source.id);

    await mergeGames(target.id, [source.id]);

    expect(
      distinctPairs().map((pair) => [pair.gameAId, pair.gameBId]),
    ).toStrictEqual([[other.id, target.id]]);
    expect(other.id).toBeLessThan(target.id);
  });
});

describe("mergeGames hidden flag", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("keeps a hidden target hidden", async () => {
    const target = createGame({ name: "Target", hidden: true });
    const source = createGame({ name: "Source" });
    const merged = await mergeGames(target.id, [source.id]);
    expect(merged.hidden).toBe(true);
  });

  it("keeps a visible target visible when a source was hidden", async () => {
    const target = createGame({ name: "Target" });
    const source = createGame({ name: "Source", hidden: true });
    const merged = await mergeGames(target.id, [source.id]);
    expect(merged.hidden).toBe(false);
  });
});

describe("splitGame", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("throws when the provider row does not exist", async () => {
    await expect(splitGame("steam", 123456)).rejects.toThrow(
      "No steam game 123456",
    );
    await expect(splitGame("gog", 123456)).rejects.toThrow(
      "No gog game 123456",
    );
    await expect(splitGame("epic", 123456)).rejects.toThrow(
      "No epic game 123456",
    );
  });

  it("is a no-op for a game with a single provider row", async () => {
    const steamGame = createSteamGame({ name: "Portal 2" });
    const result = await splitGame("steam", steamGame.appId);

    expect(result.id).toBe(steamGame.gameId);
    expect(allGames()).toHaveLength(1);
  });

  it("moves a provider row onto a fresh game and refreshes both", async () => {
    const first = createGogGame({
      name: "The Witcher 3: Wild Hunt",
      playtimeMinutes: 100,
      lastPlayedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    const second = createGogGame({
      gameId: first.gameId,
      name: "The Witcher 3: Wild Hunt Complete Edition",
      playtimeMinutes: 250,
      lastPlayedAt: new Date("2024-02-01T00:00:00.000Z"),
    });

    const splitOff = await splitGame("gog", second.gogId);

    expect(splitOff.id).not.toBe(first.gameId);
    expect(splitOff.name).toBe("The Witcher 3: Wild Hunt Complete Edition");
    expect(splitOff.playtimeMinutes).toBe(250);
    expect(splitOff.lastPlayedAt).toStrictEqual(
      new Date("2024-02-01T00:00:00.000Z"),
    );
    expect(splitOff.state).toBeNull();
    expect(stateChangesFor(splitOff.id)).toHaveLength(0);

    const previousGame = gameById(first.gameId);
    expect(previousGame?.playtimeMinutes).toBe(100);
    expect(previousGame?.lastPlayedAt).toStrictEqual(
      new Date("2024-01-01T00:00:00.000Z"),
    );
    const remaining = await getGame(first.gameId);
    expect(remaining?.gogGames.map((row) => row.gogId)).toStrictEqual([
      first.gogId,
    ]);
  });

  it("inherits the hidden flag from the game it was split from", async () => {
    const first = createGogGame({ name: "Tool" });
    const second = createGogGame({ gameId: first.gameId, name: "Tool Beta" });
    await setGameHidden(first.gameId, true);

    const splitOff = await splitGame("gog", second.gogId);

    expect(splitOff.hidden).toBe(true);
    expect(gameById(first.gameId)?.hidden).toBe(true);
  });

  it("splits a steam row off a mixed-provider game", async () => {
    const gogGame = createGogGame({ name: "Cyberpunk 2077" });
    const steamGame = createSteamGame({
      gameId: gogGame.gameId,
      name: "Cyberpunk 2077 Steam",
      playtimeForever: 60,
    });

    const splitOff = await splitGame("steam", steamGame.appId);

    expect(splitOff.name).toBe("Cyberpunk 2077 Steam");
    expect(splitOff.playtimeMinutes).toBe(60);
    const remaining = await getGame(gogGame.gameId);
    expect(remaining?.steamGames).toStrictEqual([]);
  });

  it("splits an epic row off a mixed-provider game", async () => {
    const steamGame = createSteamGame({
      name: "Control",
      playtimeForever: 40,
    });
    const epicGame = createEpicGame({
      gameId: steamGame.gameId,
      name: "Control Epic",
      playtimeMinutes: 85,
      lastPlayedAt: new Date("2024-04-01T00:00:00.000Z"),
    });

    const splitOff = await splitGame("epic", epicGame.epicId);

    expect(splitOff.id).not.toBe(steamGame.gameId);
    expect(splitOff.name).toBe("Control Epic");
    expect(splitOff.playtimeMinutes).toBe(85);
    expect(splitOff.lastPlayedAt).toStrictEqual(
      new Date("2024-04-01T00:00:00.000Z"),
    );

    const previousGame = gameById(steamGame.gameId);
    expect(previousGame?.playtimeMinutes).toBe(40);
    const remaining = await getGame(steamGame.gameId);
    expect(remaining?.epicGames).toStrictEqual([]);
  });
});
