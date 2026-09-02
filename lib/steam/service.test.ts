import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewSteamGame } from "~~/db/schema";
import { steamGame, steamUser, user } from "~~/db/schema";
import { db } from "~~/lib/db";
import {
  createGogGame as createGogGameFixture,
  createSteamGame as createSteamGameFixture,
  createSteamUser,
} from "~~/lib/fixtures/game";
import { getCommunityProfile, getUserGames } from "~~/lib/steam/api";
import {
  type FakeUserGameOverrides,
  generateFakeCommunityProfile,
  generateFakeUserGame,
  generateUnownedFakeUserGame,
} from "~~/lib/steam/fixtures/fake";
import Response7670 from "~~/lib/steam/fixtures/store/7670.json";
import {
  findGamesNeedingStoreData,
  getPlaytimeRecords,
  linkSteamAccount,
  populateStoreData,
  recordPlaytime,
  recordPlaytimes,
  SteamServiceError,
  updateGames,
  updateUser,
} from "~~/lib/steam/service";
import { getAppDetails, SteamStoreError } from "~~/lib/steam/store";
import { getAccessToken, tryRenewRefreshToken } from "~~/lib/steam/webSession";
import { flushDb } from "~~/test/db";

vi.mock("~~/lib/steam/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~~/lib/steam/api")>()),
  getUserGames: vi.fn(),
  getCommunityProfile: vi.fn(),
}));

vi.mock("~~/lib/steam/webSession", () => ({
  getAccessToken: vi.fn(async () => "ACCESS-TOKEN"),
  tryRenewRefreshToken: vi.fn(async () => false),
  clearAccessTokenCache: vi.fn(),
}));

vi.mock("~~/lib/steam/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~~/lib/steam/store")>()),
  getAppDetails: vi.fn(),
}));

type StoreAppInfo = Awaited<ReturnType<typeof getAppDetails>>;

const BIOSHOCK_APP_ID = 7670;

// The shared fixture spreads its overrides over its defaults, so an omitted
// name arrives as undefined and hits the NOT NULL Game.name column.
function createSteamGame(overrides: Partial<NewSteamGame> = {}) {
  return createSteamGameFixture({
    name: faker.commerce.productName(),
    ...overrides,
  });
}

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
    const steamGame = createSteamGame();
    const userGame = {
      ...generateFakeUserGame(steamGame),
      rtime_last_played: undefined,
    };
    const now = new Date();
    const record = await recordPlaytime(userGame, now);
    expect(record).toBeDefined();
    expect(record.timestampStart).toBeNull();
    expect(record.timestampEnd).toStrictEqual(now);
    expect(record.playtimeForever).toBe(userGame.playtime_forever);
  });
  it("should record and extend zero playtime in single record", async () => {
    const steamGame = createSteamGame();
    const userGame = {
      ...generateFakeUserGame(steamGame, NO_PLAYTIME),
      rtime_last_played: undefined,
    };
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
    const steamGame = createSteamGame();
    const userGame1 = {
      ...generateFakeUserGame(steamGame, { playtime_forever: 10 }),
      rtime_last_played: undefined,
    };
    const nowFirst = DateTime.now();
    await recordPlaytime(userGame1, nowFirst.toJSDate());
    const userGame2 = {
      ...generateFakeUserGame(steamGame, { playtime_forever: 20 }),
      rtime_last_played: undefined,
    };
    const nowSecond = nowFirst.plus({ hours: 1 });
    await recordPlaytime(userGame2, nowSecond.toJSDate());
    const userGame3 = {
      ...generateFakeUserGame(steamGame, { playtime_forever: 20 }),
      rtime_last_played: undefined,
    };
    const nowThird = nowSecond.plus({ hours: 1 });
    await recordPlaytime(userGame3, nowThird.toJSDate());
    const userGame4 = {
      ...generateFakeUserGame(steamGame, { playtime_forever: 30 }),
      rtime_last_played: undefined,
    };
    const nowFourth = nowThird.plus({ hours: 1 });
    await recordPlaytime(userGame4, nowFourth.toJSDate());
    const userGame5 = {
      ...generateFakeUserGame(steamGame, { playtime_forever: 30 }),
      rtime_last_played: undefined,
    };
    const nowFifth = nowFourth.plus({ hours: 1 });
    await recordPlaytime(userGame5, nowFifth.toJSDate());
    const userGame6 = {
      ...generateFakeUserGame(steamGame, { playtime_forever: 30 }),
      rtime_last_played: undefined,
    };
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
  it("grounds the initial import on the last session", async () => {
    const steamGame = createSteamGame();
    const now = DateTime.now();
    const lastPlayed = now.minus({ days: 30 });
    const userGame = {
      ...generateFakeUserGame(steamGame, { playtime_forever: 235 }),
      rtime_last_played: Math.floor(lastPlayed.toSeconds()),
    };
    const record = await recordPlaytime(userGame, now.toJSDate());

    const records = await getPlaytimeRecords(steamGame.appId);
    expect(records).toHaveLength(2);
    const groundedAt = new Date(userGame.rtime_last_played * 1000);
    expect(
      records.map((r) => [r.timestampStart, r.timestampEnd]),
    ).toStrictEqual([
      [null, groundedAt],
      [groundedAt, now.toJSDate()],
    ]);
    expect(records.map((r) => r.playtimeForever)).toStrictEqual([235, 235]);
    expect(records.map((r) => r.rTimeLastPlayed)).toStrictEqual([
      userGame.rtime_last_played,
      userGame.rtime_last_played,
    ]);
    expect(record.id).toBe(records[1].id);
  });
  it("records a single row when the last session is unknown", async () => {
    const steamGame = createSteamGame();
    const userGame = {
      ...generateFakeUserGame(steamGame, { playtime_forever: 235 }),
      rtime_last_played: undefined,
    };
    await recordPlaytime(userGame, new Date());
    expect(await getPlaytimeRecords(steamGame.appId)).toHaveLength(1);
  });
  it("records a single row when the game has never been played", async () => {
    const steamGame = createSteamGame();
    const userGame = {
      ...generateFakeUserGame(steamGame, NO_PLAYTIME),
      rtime_last_played: 0,
    };
    await recordPlaytime(userGame, new Date());
    const records = await getPlaytimeRecords(steamGame.appId);
    expect(records).toHaveLength(1);
    expect(records[0].timestampStart).toBeNull();
  });
  it("extends the grounded import on a later run", async () => {
    const steamGame = createSteamGame();
    const first = DateTime.now();
    const lastPlayed = first.minus({ days: 30 });
    const rtime_last_played = Math.floor(lastPlayed.toSeconds());
    const groundedAt = new Date(rtime_last_played * 1000);
    await recordPlaytime(
      {
        ...generateFakeUserGame(steamGame, { playtime_forever: 235 }),
        rtime_last_played,
      },
      first.toJSDate(),
    );
    const second = first.plus({ hours: 1 });
    await recordPlaytime(
      {
        ...generateFakeUserGame(steamGame, { playtime_forever: 300 }),
        rtime_last_played,
      },
      second.toJSDate(),
    );

    const records = await getPlaytimeRecords(steamGame.appId);
    expect(
      records.map((r) => [r.timestampStart, r.timestampEnd]),
    ).toStrictEqual([
      [null, groundedAt],
      [groundedAt, first.toJSDate()],
      [first.toJSDate(), second.toJSDate()],
    ]);
    expect(records.map((r) => r.playtimeForever)).toStrictEqual([
      235, 235, 300,
    ]);
  });
});

describe("updateUser", () => {
  beforeEach(async () => {
    await flushDb();
    vi.resetAllMocks();
  });

  it("throws when there is no steam user", async () => {
    vi.mocked(getCommunityProfile).mockResolvedValue(
      generateFakeCommunityProfile(),
    );
    await expect(updateUser()).rejects.toThrow("User not found");
  });

  it("updates the stored user from the community profile", async () => {
    const steamUser = createSteamUser();
    const profile = generateFakeCommunityProfile({
      steamID: "New Persona",
      realname: "New Real Name",
      customURL: "new-vanity",
    });
    vi.mocked(getCommunityProfile).mockResolvedValue(profile);
    const updatedUser = await updateUser();
    expect(updatedUser.steamId).toBe(steamUser.steamId);
    expect(updatedUser.personaName).toBe("New Persona");
    expect(updatedUser.realName).toBe("New Real Name");
    expect(updatedUser.profileUrl).toBe(
      "https://steamcommunity.com/id/new-vanity",
    );
    expect(updatedUser.avatarFull).toBe(profile.avatarFull);
  });

  it("fetches the profile for the stored steam id", async () => {
    const storedUser = createSteamUser();
    vi.mocked(getCommunityProfile).mockResolvedValue(
      generateFakeCommunityProfile(),
    );
    await updateUser();
    expect(getCommunityProfile).toHaveBeenCalledWith(storedUser.steamId);
    expect(tryRenewRefreshToken).toHaveBeenCalled();
  });

  it("does not adopt the steam id returned by the api", async () => {
    const steamUser = createSteamUser();
    vi.mocked(getCommunityProfile).mockResolvedValue(
      generateFakeCommunityProfile({ steamID64: "999" }),
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

  it("reports progress", async () => {
    createSteamUser();
    vi.mocked(getUserGames).mockResolvedValue([generateUnownedFakeUserGame()]);
    const messages: string[] = [];

    await updateGames(({ message }) => {
      messages.push(message);
    });

    expect(messages).toStrictEqual(["fetched 1 games", "updated 1 games"]);
  });

  it("creates a game and steam game for an unknown appid", async () => {
    createSteamUser();
    const userGame = generateUnownedFakeUserGame({ name: "Brand New Game" });
    vi.mocked(getUserGames).mockResolvedValue([userGame]);
    await updateGames();
    const steamGame = await db.query.steamGame.findFirst({
      where: (table, { eq }) => eq(table.appId, userGame.appid),
      with: { game: true },
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
    createSteamUser();
    const existingSteamGame = createSteamGame({ name: "Old Name" });
    const userGame = generateFakeUserGame(
      { ...existingSteamGame, name: "New Name" },
      { playtime_forever: 4321 },
    );
    vi.mocked(getUserGames).mockResolvedValue([userGame]);
    await updateGames();
    expect(await db.query.steamGame.findMany()).toHaveLength(1);
    const steamGame = await db.query.steamGame.findFirst({
      where: (table, { eq }) => eq(table.appId, existingSteamGame.appId),
      with: { game: true },
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

  it("does not rename a Game that owns more than one provider row", async () => {
    createSteamUser();
    const existingSteamGame = createSteamGameFixture({ name: "Old Name" });
    createGogGameFixture({
      gameId: existingSteamGame.gameId,
      name: "Old Name (GOG)",
    });
    const userGame = generateFakeUserGame(
      { ...existingSteamGame, name: "New Name" },
      { playtime_forever: 4321 },
    );
    vi.mocked(getUserGames).mockResolvedValue([userGame]);
    await updateGames();
    const steamGame = await db.query.steamGame.findFirst({
      where: (table, { eq }) => eq(table.appId, existingSteamGame.appId),
      with: { game: true },
    });
    expect(steamGame?.name).toBe("New Name");
    expect(steamGame?.game.name).toBe("Old Name");
  });

  it("returns the games reported by the steam api", async () => {
    createSteamUser();
    const userGames = [
      generateUnownedFakeUserGame(),
      generateUnownedFakeUserGame(),
    ];
    vi.mocked(getUserGames).mockResolvedValue(userGames);
    expect(await updateGames()).toStrictEqual(userGames);
  });

  it("calls the steam api with a session access token", async () => {
    const storedUser = createSteamUser();
    vi.mocked(getAccessToken).mockResolvedValue("ACCESS-TOKEN");
    vi.mocked(getUserGames).mockResolvedValue([]);
    await updateGames();
    expect(getUserGames).toHaveBeenCalledWith({
      accessToken: "ACCESS-TOKEN",
      steamId: storedUser.steamId,
    });
    expect(tryRenewRefreshToken).toHaveBeenCalled();
  });

  it("throws when there is no usable session", async () => {
    createSteamUser();
    vi.mocked(getAccessToken).mockResolvedValue(null);
    await expect(updateGames()).rejects.toThrow("Steam account not connected");
    expect(getUserGames).not.toHaveBeenCalled();
  });
});

describe("linkSteamAccount", () => {
  beforeEach(async () => {
    await flushDb();
    vi.resetAllMocks();
  });

  function sessionLink(steamId: string) {
    return {
      steamId,
      refreshToken: "SCANNED-TOKEN",
      refreshTokenExpiresAt: new Date(Date.now() + 200 * 86_400_000),
    };
  }

  it("creates a user and steam user", async () => {
    const profile = generateFakeCommunityProfile({ steamID: "Fresh Persona" });
    vi.mocked(getCommunityProfile).mockResolvedValue(profile);
    const link = sessionLink(profile.steamID64);
    const created = await linkSteamAccount(link);
    expect(getCommunityProfile).toHaveBeenCalledWith(profile.steamID64);
    expect(created.steamId).toBe(profile.steamID64);
    expect(created.personaName).toBe("Fresh Persona");
    expect(created.refreshToken).toBe("SCANNED-TOKEN");
    expect(created.refreshTokenExpiresAt).toStrictEqual(
      link.refreshTokenExpiresAt,
    );
    expect(db.select().from(user).all()).toHaveLength(1);
    expect(db.select().from(steamUser).all()).toHaveLength(1);
  });

  it("updates the existing row with the new session", async () => {
    const existing = createSteamUser();
    vi.mocked(getCommunityProfile).mockResolvedValue(
      generateFakeCommunityProfile({
        steamID64: existing.steamId,
        steamID: "Renamed Persona",
      }),
    );
    const updated = await linkSteamAccount(sessionLink(existing.steamId));
    expect(updated.refreshToken).toBe("SCANNED-TOKEN");
    expect(updated.personaName).toBe("Renamed Persona");
    expect(updated.userId).toBe(existing.userId);
    expect(db.select().from(user).all()).toHaveLength(1);
    expect(db.select().from(steamUser).all()).toHaveLength(1);
  });

  it("rejects a different steam account without writing", async () => {
    const existing = createSteamUser();
    const otherSteamId = faker.string.numeric(17);
    await expect(linkSteamAccount(sessionLink(otherSteamId))).rejects.toThrow(
      `grate only supports a single Steam account (linked: ${existing.steamId}, scanned: ${otherSteamId})`,
    );
    expect(getCommunityProfile).not.toHaveBeenCalled();
    const rows = db.select().from(steamUser).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].steamId).toBe(existing.steamId);
    expect(rows[0].refreshToken).toBe(existing.refreshToken);
  });

  it("derives the profile url from the custom url", async () => {
    const profile = generateFakeCommunityProfile({ customURL: "robinwalker" });
    vi.mocked(getCommunityProfile).mockResolvedValue(profile);
    const created = await linkSteamAccount(sessionLink(profile.steamID64));
    expect(created.profileUrl).toBe(
      "https://steamcommunity.com/id/robinwalker",
    );
  });

  it("falls back to the profiles url without a custom url", async () => {
    const profile = generateFakeCommunityProfile({ customURL: null });
    vi.mocked(getCommunityProfile).mockResolvedValue(profile);
    const created = await linkSteamAccount(sessionLink(profile.steamID64));
    expect(created.profileUrl).toBe(
      `https://steamcommunity.com/profiles/${profile.steamID64}`,
    );
  });

  it("propagates an api failure without writing", async () => {
    vi.mocked(getCommunityProfile).mockRejectedValue(new Error("Forbidden"));
    await expect(
      linkSteamAccount(sessionLink(faker.string.numeric(17))),
    ).rejects.toThrow("Forbidden");
    expect(db.select().from(user).all()).toHaveLength(0);
    expect(db.select().from(steamUser).all()).toHaveLength(0);
  });
});

describe("recordPlaytimes", () => {
  beforeEach(async () => {
    await flushDb();
    vi.resetAllMocks();
  });

  it("creates an owned game that is not in the database and records its playtime", async () => {
    createSteamUser();
    const userGame = {
      ...generateUnownedFakeUserGame({ name: "Missing Game" }),
      playtime_forever: 33,
      rtime_last_played: undefined,
    };
    vi.mocked(getUserGames).mockResolvedValue([userGame]);

    const result = await recordPlaytimes();

    expect(result).toStrictEqual({ gamesCreated: 1, unknownGames: 0 });
    const created = db
      .select()
      .from(steamGame)
      .where(eq(steamGame.appId, userGame.appid))
      .all();
    expect(created.map((row) => row.name)).toStrictEqual(["Missing Game"]);
    const records = await getPlaytimeRecords(userGame.appid);
    expect(records).toHaveLength(1);
    expect(records[0].playtimeForever).toBe(33);
  });

  it("reports progress", async () => {
    createSteamUser();
    const existing = createSteamGame();
    vi.mocked(getUserGames).mockResolvedValue([
      {
        ...generateFakeUserGame(existing, { playtime_forever: 5 }),
        rtime_last_played: undefined,
      },
    ]);
    const messages: string[] = [];

    await recordPlaytimes(({ message }) => {
      messages.push(message);
    });

    expect(messages).toContain("fetched 1 owned games");
    expect(messages).toContain("recorded playtime for 1 games, created 0");
  });

  it("records a playtime for every owned game", async () => {
    createSteamUser();
    const firstSteamGame = createSteamGame();
    const secondSteamGame = createSteamGame();
    vi.mocked(getUserGames).mockResolvedValue([
      {
        ...generateFakeUserGame(firstSteamGame, { playtime_forever: 11 }),
        rtime_last_played: undefined,
      },
      {
        ...generateFakeUserGame(secondSteamGame, { playtime_forever: 22 }),
        rtime_last_played: undefined,
      },
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
    const notFetched = createSteamGame({ appInfoState: "NOT_FETCHED" });
    createSteamGame({ appInfoState: "FETCHED" });
    createSteamGame({ appInfoState: "UNAVAILABLE" });
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
    createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockResolvedValue(
      bioshockStoreAppInfo({
        release_date: { coming_soon: false, date: "21 Aug, 2007" },
      }),
    );
    const updatedGame = await populateStoreData(BIOSHOCK_APP_ID);
    expect(updatedGame.appInfoState).toBe("FETCHED");
    const appInfo = await db.query.steamAppInfo.findFirst({
      where: (table, { eq }) => eq(table.appId, BIOSHOCK_APP_ID),
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
    createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockResolvedValue(
      bioshockStoreAppInfo({
        required_age: "18",
        release_date: { coming_soon: false, date: "21 Aug, 2007" },
      }),
    );
    await populateStoreData(BIOSHOCK_APP_ID);
    const appInfo = await db.query.steamAppInfo.findFirst({
      where: (table, { eq }) => eq(table.appId, BIOSHOCK_APP_ID),
    });
    expect(appInfo?.requiredAge).toBe(18);
  });

  it("throws on a release date the store returned in a non-english locale", async () => {
    // The checked in BioShock fixture has a Portuguese release date, which
    // Date cannot parse. parseReleaseDate is called outside the try/catch so
    // the raw error escapes rather than becoming a SteamServiceError.
    createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockResolvedValue(bioshockStoreAppInfo());
    await expect(populateStoreData(BIOSHOCK_APP_ID)).rejects.toThrow(
      "Invalid date: 21/ago./2007",
    );
    const steamGame = await db.query.steamGame.findFirst({
      where: (table, { eq }) => eq(table.appId, BIOSHOCK_APP_ID),
    });
    expect(steamGame?.appInfoState).toBe("NOT_FETCHED");
  });

  it("marks the game unavailable on a non-retriable store error", async () => {
    createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockRejectedValue(
      new SteamStoreError("App details unavailable", false),
    );
    const updatedGame = await populateStoreData(BIOSHOCK_APP_ID);
    expect(updatedGame.appInfoState).toBe("UNAVAILABLE");
    expect(
      await db.query.steamAppInfo.findMany({
        where: (table, { eq }) => eq(table.appId, BIOSHOCK_APP_ID),
      }),
    ).toHaveLength(0);
  });

  it("throws a SteamServiceError on a retriable store error", async () => {
    createSteamGame({ appId: BIOSHOCK_APP_ID });
    vi.mocked(getAppDetails).mockRejectedValue(
      new SteamStoreError("Too many requests", true),
    );
    await expect(populateStoreData(BIOSHOCK_APP_ID)).rejects.toThrow(
      SteamServiceError,
    );
    const steamGame = await db.query.steamGame.findFirst({
      where: (table, { eq }) => eq(table.appId, BIOSHOCK_APP_ID),
    });
    expect(steamGame?.appInfoState).toBe("NOT_FETCHED");
  });
});
