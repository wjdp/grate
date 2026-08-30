import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSteamGame,
  createSteamUser,
  type FakeUserGameOverrides,
  generateFakeUserGame,
  generateFakeUserInfo,
  generateUnownedFakeUserGame,
} from "~/lib/steam/fixtures/fake";
import {
  findGamesNeedingStoreData,
  getPlaytimeRecords,
  populateStoreData,
  recordPlaytime,
  recordPlaytimes,
  SteamServiceError,
  updateGames,
  updateUser,
} from "~/lib/steam/service";
import { getUserGames, getUserInfo } from "~/lib/steam/api";
import { getAppDetails, SteamStoreError } from "~/lib/steam/store";
import prisma from "~/lib/prisma";

import { DateTime } from "luxon";
import { flushDb } from "~/test/db";

import Response7670 from "~/lib/steam/fixtures/store/7670.json";

vi.mock("~/lib/steam/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/steam/api")>()),
  getUserGames: vi.fn(),
  getUserInfo: vi.fn(),
}));

vi.mock("~/lib/steam/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/steam/store")>()),
  getAppDetails: vi.fn(),
}));

type StoreAppInfo = Awaited<ReturnType<typeof getAppDetails>>;

const BIOSHOCK_APP_ID = BigInt(7670);

function bioshockStoreAppInfo(
  overrides: Partial<StoreAppInfo> = {},
): StoreAppInfo {
  return {
    ...(Response7670["7670"].data as unknown as StoreAppInfo),
    ...overrides,
  };
}

const NO_PLAYTIME: FakeUserGameOverrides = {
  playtime_forever: 0,
  playtime_2weeks: undefined,
  playtime_windows_forever: 0,
  playtime_mac_forever: 0,
  playtime_linux_forever: 0,
  playtime_deck_forever: 0,
  playtime_disconnected: 0,
};

describe("recordPlaytime", () => {
  beforeEach(async () => {
    await flushDb();
  });
  it("should record playtime", async () => {
    const steamGame = await createSteamGame();
    const userGame = generateFakeUserGame(steamGame);
    const now = new Date();
    const record = await recordPlaytime(userGame, now);
    expect(record).toBeDefined();
    expect(record.timestampStart).toBeNull();
    expect(record.timestampEnd).toStrictEqual(now);
    expect(record.playtimeForever).toBe(userGame.playtime_forever);
  });
  it("should record and extend zero playtime in single record", async () => {
    const steamGame = await createSteamGame();
    const userGame = generateFakeUserGame(steamGame, NO_PLAYTIME);
    userGame.playtime_2weeks = undefined;
    const nowFirst = DateTime.now();
    const nowSecond = nowFirst.plus({ hours: 1 });
    const nowThird = nowFirst.plus({ hours: 2 });
    await recordPlaytime(userGame, nowFirst.toJSDate());
    await recordPlaytime(userGame, nowSecond.toJSDate());
    await recordPlaytime(userGame, nowThird.toJSDate());
    const records = await getPlaytimeRecords(steamGame.appId);
    expect(records).toHaveLength(2);
    const firstRecord = records[0];
    expect(firstRecord.timestampStart).toBeNull();
    expect(firstRecord.timestampEnd).toStrictEqual(nowFirst.toJSDate());
    expect(firstRecord.playtimeForever).toBe(0);
    expect(firstRecord.playtime2weeks).toBeNull();
    const secondRecord = records[1];
    expect(secondRecord.timestampStart).toStrictEqual(nowFirst.toJSDate());
    expect(secondRecord.timestampEnd).toStrictEqual(nowThird.toJSDate());
    expect(secondRecord.playtimeForever).toBe(0);
    expect(secondRecord.playtime2weeks).toBeNull();
  });
  it("should record and extend playtime in multiple records", async () => {
    // This test simulates an initial import, followed by two play sessions
    // with a break in between.
    const steamGame = await createSteamGame();
    const userGame1 = generateFakeUserGame(steamGame, { playtime_forever: 10 });
    const nowFirst = DateTime.now();
    await recordPlaytime(userGame1, nowFirst.toJSDate());
    const userGame2 = generateFakeUserGame(steamGame, { playtime_forever: 20 });
    const nowSecond = nowFirst.plus({ hours: 1 });
    await recordPlaytime(userGame2, nowSecond.toJSDate());
    const userGame3 = generateFakeUserGame(steamGame, { playtime_forever: 20 });
    const nowThird = nowSecond.plus({ hours: 1 });
    await recordPlaytime(userGame3, nowThird.toJSDate());
    const userGame4 = generateFakeUserGame(steamGame, { playtime_forever: 30 });
    const nowFourth = nowThird.plus({ hours: 1 });
    await recordPlaytime(userGame4, nowFourth.toJSDate());
    const userGame5 = generateFakeUserGame(steamGame, { playtime_forever: 30 });
    const nowFifth = nowFourth.plus({ hours: 1 });
    await recordPlaytime(userGame5, nowFifth.toJSDate());
    const userGame6 = generateFakeUserGame(steamGame, { playtime_forever: 30 });
    const nowSixth = nowFifth.plus({ hours: 1 });
    await recordPlaytime(userGame6, nowSixth.toJSDate());

    const records = await getPlaytimeRecords(steamGame.appId);
    expect(records).toHaveLength(5);
    const dates = records.map((r) => [r.timestampStart, r.timestampEnd]);
    expect(dates).toStrictEqual([
      [null, nowFirst.toJSDate()],
      [nowFirst.toJSDate(), nowSecond.toJSDate()],
      [nowSecond.toJSDate(), nowThird.toJSDate()],
      [nowThird.toJSDate(), nowFourth.toJSDate()],
      [nowFourth.toJSDate(), nowSixth.toJSDate()],
    ]);
    const playtimes = records.map((r) => r.playtimeForever);
    expect(playtimes).toStrictEqual([10, 20, 20, 30, 30]);
  });
});

describe("updateUser", () => {
  beforeEach(async () => {
    await flushDb();
    vi.resetAllMocks();
  });

  it("throws when there is no steam user", async () => {
    vi.mocked(getUserInfo).mockResolvedValue(generateFakeUserInfo());
    await expect(updateUser()).rejects.toThrow("User not found");
  });

  it("updates the stored user from the steam api", async () => {
    const steamUser = await createSteamUser();
    const userInfo = generateFakeUserInfo({
      personaname: "New Persona",
      realname: "New Real Name",
      lastlogoff: 1700000000,
    });
    vi.mocked(getUserInfo).mockResolvedValue(userInfo);
    const updatedUser = await updateUser();
    expect(updatedUser.steamId).toBe(steamUser.steamId);
    expect(updatedUser.personaName).toBe("New Persona");
    expect(updatedUser.realName).toBe("New Real Name");
    expect(updatedUser.lastLogoff).toBe(1700000000);
    expect(updatedUser.profileUrl).toBe(userInfo.profileurl);
    expect(updatedUser.avatarHash).toBe(userInfo.avatarhash);
  });

  it("does not adopt the steam id returned by the api", async () => {
    const steamUser = await createSteamUser();
    vi.mocked(getUserInfo).mockResolvedValue(
      generateFakeUserInfo({ steamid: 999 }),
    );
    const updatedUser = await updateUser();
    expect(updatedUser.steamId).toBe(steamUser.steamId);
  });
});

describe("updateGames", () => {
  beforeEach(async () => {
    await flushDb();
    vi.resetAllMocks();
  });

  it("throws when there is no steam user", async () => {
    vi.mocked(getUserGames).mockResolvedValue([]);
    await expect(updateGames()).rejects.toThrow("User not found");
  });

  it("creates a game and steam game for an unknown appid", async () => {
    await createSteamUser();
    const userGame = generateUnownedFakeUserGame({ name: "Brand New Game" });
    vi.mocked(getUserGames).mockResolvedValue([userGame]);
    await updateGames();
    const steamGame = await prisma.steamGame.findUnique({
      where: { appId: userGame.appid },
      include: { game: true },
    });
    expect(steamGame?.name).toBe("Brand New Game");
    expect(steamGame?.game.name).toBe("Brand New Game");
    expect(steamGame?.playtimeForever).toBe(userGame.playtime_forever);
    expect(steamGame?.appInfoState).toBe("NOT_FETCHED");
    expect(steamGame?.game.playtimeMinutes).toBe(userGame.playtime_forever);
    expect(steamGame?.game.lastPlayedAt).toStrictEqual(
      new Date(userGame.rtime_last_played! * 1000),
    );
  });

  it("updates an existing steam game", async () => {
    await createSteamUser();
    const existingSteamGame = await createSteamGame({ name: "Old Name" });
    const userGame = generateFakeUserGame(
      { ...existingSteamGame, name: "New Name" },
      { playtime_forever: 4321 },
    );
    vi.mocked(getUserGames).mockResolvedValue([userGame]);
    await updateGames();
    expect(await prisma.steamGame.count()).toBe(1);
    const steamGame = await prisma.steamGame.findUnique({
      where: { appId: existingSteamGame.appId },
      include: { game: true },
    });
    expect(steamGame?.name).toBe("New Name");
    expect(steamGame?.playtimeForever).toBe(4321);
    // The owning Game is renamed alongside the SteamGame
    expect(steamGame?.game.name).toBe("New Name");
    expect(steamGame?.game.playtimeMinutes).toBe(4321);
    expect(steamGame?.game.lastPlayedAt).toStrictEqual(
      new Date(userGame.rtime_last_played! * 1000),
    );
  });

  it("returns the games reported by the steam api", async () => {
    await createSteamUser();
    const userGames = [
      generateUnownedFakeUserGame(),
      generateUnownedFakeUserGame(),
    ];
    vi.mocked(getUserGames).mockResolvedValue(userGames);
    expect(await updateGames()).toStrictEqual(userGames);
  });
});

describe("recordPlaytimes", () => {
  beforeEach(async () => {
    await flushDb();
    vi.resetAllMocks();
  });

  it("throws when an owned game is not in the database", async () => {
    const userGame = generateUnownedFakeUserGame({ name: "Missing Game" });
    vi.mocked(getUserGames).mockResolvedValue([userGame]);
    await expect(recordPlaytimes()).rejects.toThrow(
      "Game Missing Game not found in db",
    );
  });

  it("records a playtime for every owned game", async () => {
    const firstSteamGame = await createSteamGame();
    const secondSteamGame = await createSteamGame();
    vi.mocked(getUserGames).mockResolvedValue([
      generateFakeUserGame(firstSteamGame, { playtime_forever: 11 }),
      generateFakeUserGame(secondSteamGame, { playtime_forever: 22 }),
    ]);
    await recordPlaytimes();
    const firstRecords = await getPlaytimeRecords(firstSteamGame.appId);
    const secondRecords = await getPlaytimeRecords(secondSteamGame.appId);
    expect(firstRecords).toHaveLength(1);
    expect(firstRecords[0].playtimeForever).toBe(11);
    expect(secondRecords).toHaveLength(1);
    expect(secondRecords[0].playtimeForever).toBe(22);
    expect(firstRecords[0].timestampEnd).toStrictEqual(
      secondRecords[0].timestampEnd,
    );
  });
});

describe("findGamesNeedingStoreData", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("returns only games whose app info has not been fetched", async () => {
    const notFetched = await createSteamGame({ appInfoState: "NOT_FETCHED" });
    await createSteamGame({ appInfoState: "FETCHED" });
    await createSteamGame({ appInfoState: "UNAVAILABLE" });
    const games = await findGamesNeedingStoreData();
    expect(games.map((game) => game.appId)).toStrictEqual([notFetched.appId]);
  });
});

describe("populateStoreData", () => {
  beforeEach(async () => {
    await flushDb();
    vi.resetAllMocks();
  });

  it("throws when the game is not in the database", async () => {
    await expect(populateStoreData(BIOSHOCK_APP_ID)).rejects.toThrow(
      SteamServiceError,
    );
    await expect(populateStoreData(BIOSHOCK_APP_ID)).rejects.toThrow(
      `Game ${BIOSHOCK_APP_ID} not in database`,
    );
  });

  it("stores the app info and marks the game fetched", async () => {
    const steamGame = await createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockResolvedValue(
      bioshockStoreAppInfo({
        release_date: { coming_soon: false, date: "21 Aug, 2007" },
      }),
    );
    const updatedGame = await populateStoreData(BIOSHOCK_APP_ID);
    expect(updatedGame.appInfoState).toBe("FETCHED");
    const appInfo = await prisma.steamAppInfo.findUnique({
      where: { appId: BIOSHOCK_APP_ID },
    });
    expect(appInfo?.name).toBe("BioShock™");
    expect(appInfo?.type).toBe("game");
    expect(appInfo?.requiredAge).toBe(0);
    expect(appInfo?.isFree).toBe(false);
    expect(appInfo?.developers).toStrictEqual(["2K Boston", "2K Australia"]);
    expect(appInfo?.publishers).toStrictEqual(["2K"]);
    expect(appInfo?.platformWindows).toBe(true);
    expect(appInfo?.platformMac).toBe(false);
    expect(appInfo?.metacriticScore).toBe(96);
    expect(appInfo?.comingSoon).toBe(false);
    expect(appInfo?.releaseDate?.getFullYear()).toBe(2007);
    expect(appInfo?.releaseDate?.getMonth()).toBe(7);
    expect(appInfo?.releaseDate?.getDate()).toBe(21);
  });

  it("coerces a string required_age to a number", async () => {
    await createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockResolvedValue(
      bioshockStoreAppInfo({
        required_age: "18",
        release_date: { coming_soon: false, date: "21 Aug, 2007" },
      }),
    );
    await populateStoreData(BIOSHOCK_APP_ID);
    const appInfo = await prisma.steamAppInfo.findUnique({
      where: { appId: BIOSHOCK_APP_ID },
    });
    expect(appInfo?.requiredAge).toBe(18);
  });

  it("throws on a release date the store returned in a non-english locale", async () => {
    // The checked in BioShock fixture has a Portuguese release date, which
    // Date cannot parse. parseReleaseDate is called outside the try/catch so
    // the raw error escapes rather than becoming a SteamServiceError.
    await createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockResolvedValue(bioshockStoreAppInfo());
    await expect(populateStoreData(BIOSHOCK_APP_ID)).rejects.toThrow(
      "Invalid date: 21/ago./2007",
    );
    const steamGame = await prisma.steamGame.findUnique({
      where: { appId: BIOSHOCK_APP_ID },
    });
    expect(steamGame?.appInfoState).toBe("NOT_FETCHED");
  });

  it("marks the game unavailable on a non-retriable store error", async () => {
    await createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockRejectedValue(
      new SteamStoreError("App details unavailable", false),
    );
    const updatedGame = await populateStoreData(BIOSHOCK_APP_ID);
    expect(updatedGame.appInfoState).toBe("UNAVAILABLE");
    expect(
      await prisma.steamAppInfo.count({ where: { appId: BIOSHOCK_APP_ID } }),
    ).toBe(0);
  });

  it("throws a SteamServiceError on a retriable store error", async () => {
    await createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockRejectedValue(
      new SteamStoreError("Too many requests", true),
    );
    await expect(populateStoreData(BIOSHOCK_APP_ID)).rejects.toThrow(
      SteamServiceError,
    );
    const steamGame = await prisma.steamGame.findUnique({
      where: { appId: BIOSHOCK_APP_ID },
    });
    expect(steamGame?.appInfoState).toBe("NOT_FETCHED");
  });
});
