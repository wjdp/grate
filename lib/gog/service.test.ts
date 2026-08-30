import { asc, eq } from "drizzle-orm";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getGogGameDetail,
  getGogGamePlaytime,
  getGogToken,
  getGogUserData,
  getGogUserGames,
  GogApiError,
  type GogGameDetail,
  refreshGogToken,
} from "~/lib/gog/api";
import {
  createGogUser,
  generateFakeGogGameDetail,
  generateFakeGogPlaytimeSessions,
  generateFakeGogToken,
  generateFakeGogUser,
} from "~/lib/gog/fixtures/fake";
import {
  createOrUpdateGogUser,
  getGogPlaytimeRecords,
  handleRefreshToken,
  recordGogPlaytime,
  recordGogPlaytimes,
  updateGogGames,
  updateGogUser,
} from "~/lib/gog/service";
import { createGogGame } from "~~/lib/fixtures/game";
import { db } from "~~/lib/db";
import { game, gogGame, gogIgnoredProduct, gogUser } from "~~/db/schema";
import { flushDb } from "~/test/db";

function withoutReleaseDates(detail: GogGameDetail): GogGameDetail {
  const {
    globalReleaseDate: _globalReleaseDate,
    gogReleaseDate: _gogReleaseDate,
    ...product
  } = detail._embedded.product;
  return { ...detail, _embedded: { ...detail._embedded, product } };
}

function firstOrThrow<T>(rows: T[]): T {
  const [row] = rows;
  if (!row) throw new Error("Expected at least one row");
  return row;
}

vi.mock("~/lib/gog/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/gog/api")>()),
  getGogGameDetail: vi.fn(),
  getGogGamePlaytime: vi.fn(),
  getGogToken: vi.fn(),
  getGogUserData: vi.fn(),
  getGogUserGames: vi.fn(),
  refreshGogToken: vi.fn(),
}));

const SECOND = 1000;
const MINUTE = 60 * SECOND;

function expiresAtIn(milliseconds: number) {
  return new Date(Date.now() + milliseconds);
}

function expectCloseTo(actual: Date, expected: Date, toleranceMs = 5 * SECOND) {
  expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThan(
    toleranceMs,
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  await flushDb();
});

describe("createOrUpdateGogUser", () => {
  it("creates a GogUser from the token and user data", async () => {
    const token = generateFakeGogToken({ expires_in: 3600 });
    const apiUser = generateFakeGogUser();
    vi.mocked(getGogToken).mockResolvedValue(token);
    vi.mocked(getGogUserData).mockResolvedValue(apiUser);

    const before = Date.now();
    const user = await createOrUpdateGogUser("code-123");

    expect(getGogToken).toHaveBeenCalledWith("code-123");
    expect(getGogUserData).toHaveBeenCalledWith(token.access_token);
    expect(user.gogUserId).toBe(apiUser.userId);
    expect(user.galaxyUserId).toBe(apiUser.galaxyUserId);
    expect(user.username).toBe(apiUser.username);
    expect(user.country).toBe(apiUser.country);
    expect(user.avatarUrl).toBe(apiUser.avatar);
    expect(user.checksumGames).toBe(apiUser.checksum.games);
    expect(user.accessToken).toBe(token.access_token);
    expect(user.refreshToken).toBe(token.refresh_token);
    expectCloseTo(user.accessTokenExpiresAt, new Date(before + 3600 * SECOND));
    expect(await db.$count(gogUser)).toBe(1);
  });

  it("updates the existing user when the gogUserId matches", async () => {
    const existing = await createGogUser();
    const token = generateFakeGogToken();
    const apiUser = generateFakeGogUser({ userId: existing.gogUserId });
    vi.mocked(getGogToken).mockResolvedValue(token);
    vi.mocked(getGogUserData).mockResolvedValue(apiUser);

    const user = await createOrUpdateGogUser("code-123");

    expect(await db.$count(gogUser)).toBe(1);
    expect(user.username).toBe(apiUser.username);
    expect(user.accessToken).toBe(token.access_token);
    expect(user.refreshToken).toBe(token.refresh_token);
  });

  it("throws when a different GOG account already exists", async () => {
    await createGogUser({ gogUserId: "111" });
    vi.mocked(getGogToken).mockResolvedValue(generateFakeGogToken());
    vi.mocked(getGogUserData).mockResolvedValue(
      generateFakeGogUser({ userId: "222" }),
    );

    await expect(createOrUpdateGogUser("code-123")).rejects.toThrow(
      "grate only supports a single GOG account",
    );
    expect(await db.$count(gogUser)).toBe(1);
  });

  it("throws when the token request fails", async () => {
    vi.mocked(getGogToken).mockRejectedValue(new Error("nope"));

    await expect(createOrUpdateGogUser("code-123")).rejects.toThrow(
      "Failed to authenticate with GOG",
    );
    expect(getGogUserData).not.toHaveBeenCalled();
  });

  it("throws when the user data request fails", async () => {
    vi.mocked(getGogToken).mockResolvedValue(generateFakeGogToken());
    vi.mocked(getGogUserData).mockRejectedValue(new Error("nope"));

    await expect(createOrUpdateGogUser("code-123")).rejects.toThrow(
      "Failed to get user data from GOG",
    );
    expect(await db.$count(gogUser)).toBe(0);
  });
});

describe("handleRefreshToken", () => {
  it("returns the user unchanged when the token has plenty of life left", async () => {
    const user = await createGogUser({
      accessTokenExpiresAt: expiresAtIn(10 * MINUTE),
    });

    const result = await handleRefreshToken(user);

    expect(result).toStrictEqual(user);
    expect(refreshGogToken).not.toHaveBeenCalled();
  });

  it("refreshes and persists new tokens when the token has expired", async () => {
    const user = await createGogUser({
      accessTokenExpiresAt: expiresAtIn(-1 * MINUTE),
    });
    const token = generateFakeGogToken({ expires_in: 3600 });
    vi.mocked(refreshGogToken).mockResolvedValue(token);

    const before = Date.now();
    const result = await handleRefreshToken(user);

    expect(refreshGogToken).toHaveBeenCalledWith(user.refreshToken);
    expect(result.accessToken).toBe(token.access_token);
    expect(result.refreshToken).toBe(token.refresh_token);
    expectCloseTo(
      result.accessTokenExpiresAt,
      new Date(before + 3600 * SECOND),
    );
    const stored = firstOrThrow(db.select().from(gogUser).all());
    expect(stored.accessToken).toBe(token.access_token);
    expect(stored.refreshToken).toBe(token.refresh_token);
  });

  it("refreshes when the token expires within the two minute buffer", async () => {
    const user = await createGogUser({
      accessTokenExpiresAt: expiresAtIn(MINUTE),
    });
    const token = generateFakeGogToken();
    vi.mocked(refreshGogToken).mockResolvedValue(token);

    const result = await handleRefreshToken(user);

    expect(refreshGogToken).toHaveBeenCalledOnce();
    expect(result.accessToken).toBe(token.access_token);
  });

  it("throws when the refresh request fails", async () => {
    const user = await createGogUser({
      accessTokenExpiresAt: expiresAtIn(-1 * MINUTE),
    });
    vi.mocked(refreshGogToken).mockRejectedValue(new Error("nope"));

    await expect(handleRefreshToken(user)).rejects.toThrow(
      "Failed to refresh GOG token",
    );
  });
});

describe("updateGogUser", () => {
  it("returns undefined when there is no user", async () => {
    expect(await updateGogUser()).toBeUndefined();
    expect(getGogUserData).not.toHaveBeenCalled();
  });

  it("updates the stored profile fields", async () => {
    const user = await createGogUser();
    const apiUser = generateFakeGogUser({ userId: user.gogUserId });
    vi.mocked(getGogUserData).mockResolvedValue(apiUser);

    const result = await updateGogUser();

    expect(getGogUserData).toHaveBeenCalledWith(user.accessToken);
    expect(result?.username).toBe(apiUser.username);
    expect(result?.country).toBe(apiUser.country);
    expect(result?.avatarUrl).toBe(apiUser.avatar);
    expect(result?.checksumGames).toBe(apiUser.checksum.games);
  });

  it("throws when the user data request fails", async () => {
    await createGogUser();
    vi.mocked(getGogUserData).mockRejectedValue(new Error("nope"));

    await expect(updateGogUser()).rejects.toThrow(
      "Failed to get user data from GOG",
    );
  });
});

describe("updateGogGames", () => {
  it("does nothing when there is no user", async () => {
    expect(await updateGogGames()).toBeUndefined();
    expect(getGogUserGames).not.toHaveBeenCalled();
  });

  it("creates a Game and GogGame for a GAME product", async () => {
    await createGogUser();
    const detail = generateFakeGogGameDetail({
      id: 100,
      title: "Some Game",
      globalReleaseDate: "2014-01-02T00:00:00.000+00:00",
      gogReleaseDate: "2015-05-19T00:00:00.000+00:00",
      developers: [{ name: "Dev One" }, { name: "Dev Two" }],
      publisher: "A Publisher",
    });
    vi.mocked(getGogUserGames).mockResolvedValue([100]);
    vi.mocked(getGogGameDetail).mockResolvedValue(detail);

    await updateGogGames();

    const storedGame = firstOrThrow(
      await db.query.gogGame.findMany({ with: { game: true } }),
    );
    expect(storedGame.gogId).toBe(100);
    expect(storedGame.name).toBe("Some Game");
    expect(storedGame.game.name).toBe("Some Game");
    expect(storedGame.releaseDate).toStrictEqual(
      new Date("2014-01-02T00:00:00.000Z"),
    );
    expect(storedGame.description).toBe(detail.description);
    expect(storedGame.publisher).toBe("A Publisher");
    expect(storedGame.developer).toBe("Dev One, Dev Two");
    expect(storedGame.iconUrl).toBe(detail._links.icon?.href);
    expect(storedGame.iconSquareUrl).toBe(detail._links.iconSquare?.href);
    expect(storedGame.logoUrl).toBe(detail._links.logo?.href);
    expect(storedGame.boxArtImageUrl).toBe(detail._links.boxArtImage?.href);
    expect(storedGame.backgroundImageUrl).toBe(
      detail._links.backgroundImage?.href,
    );
    expect(storedGame.galaxyBackgroundImageUrl).toBe(
      detail._links.galaxyBackgroundImage?.href,
    );
    expect(storedGame.tags).toStrictEqual(detail._embedded.tags);
    expect(storedGame.properties).toStrictEqual(detail._embedded.properties);
  });

  it("falls back to gogReleaseDate when there is no globalReleaseDate", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([101]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      generateFakeGogGameDetail({
        id: 101,
        gogReleaseDate: "2015-05-19T00:00:00.000+00:00",
      }),
    );

    await updateGogGames();

    const storedGame = firstOrThrow(db.select().from(gogGame).all());
    expect(storedGame.releaseDate).toStrictEqual(
      new Date("2015-05-19T00:00:00.000Z"),
    );
  });

  it("stores a null releaseDate when the product has neither release date", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([102]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      withoutReleaseDates(generateFakeGogGameDetail({ id: 102 })),
    );

    await updateGogGames();

    const storedGame = firstOrThrow(db.select().from(gogGame).all());
    expect(storedGame.gogId).toBe(102);
    expect(storedGame.releaseDate).toBeNull();
  });

  it("ignores a DLC product that has no release date", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([103]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      withoutReleaseDates(
        generateFakeGogGameDetail({ id: 103, productType: "DLC" }),
      ),
    );

    await updateGogGames();

    expect(await db.$count(gogGame)).toBe(0);
    const ignored = firstOrThrow(
      db
        .select()
        .from(gogIgnoredProduct)
        .where(eq(gogIgnoredProduct.gogId, 103))
        .all(),
    );
    expect(ignored.reason).toBe("DLC");
  });

  it("updates an existing GogGame without creating another Game", async () => {
    await createGogUser();
    const existing = await createGogGame({ gogId: 200, name: "Old Name" });
    vi.mocked(getGogUserGames).mockResolvedValue([200]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      generateFakeGogGameDetail({ id: 200, title: "New Name" }),
    );

    await updateGogGames();

    expect(await db.$count(game)).toBe(1);
    expect(await db.$count(gogGame)).toBe(1);
    const storedGame = firstOrThrow(
      await db.query.gogGame.findMany({ with: { game: true } }),
    );
    expect(storedGame.gameId).toBe(existing.gameId);
    expect(storedGame.name).toBe("New Name");
    expect(storedGame.game.name).toBe("New Name");
  });

  it.each(["DLC", "PACK"])(
    "skips %s products and remembers them as ignored",
    async (productType) => {
      await createGogUser();
      vi.mocked(getGogUserGames).mockResolvedValue([300]);
      vi.mocked(getGogGameDetail).mockResolvedValue(
        generateFakeGogGameDetail({ id: 300, productType }),
      );

      await updateGogGames();

      expect(await db.$count(gogGame)).toBe(0);
      expect(await db.$count(game)).toBe(0);
      const ignored = firstOrThrow(
        db
          .select()
          .from(gogIgnoredProduct)
          .where(eq(gogIgnoredProduct.gogId, 300))
          .all(),
      );
      expect(ignored.reason).toBe(productType);
    },
  );

  it("skips the ignored product id", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([1185685769]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      generateFakeGogGameDetail({ id: 1185685769 }),
    );

    await updateGogGames();

    expect(await db.$count(gogGame)).toBe(0);
    expect(getGogGameDetail).not.toHaveBeenCalled();
  });

  it("does not fetch details for products already ignored", async () => {
    await createGogUser();
    db.insert(gogIgnoredProduct)
      .values({ gogId: 500, reason: "NOT_FOUND" })
      .run();
    vi.mocked(getGogUserGames).mockResolvedValue([500]);

    await updateGogGames();

    expect(getGogGameDetail).not.toHaveBeenCalled();
    expect(await db.$count(gogGame)).toBe(0);
  });

  it("ignores a product whose detail request 404s and skips it next run", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([501]);
    vi.mocked(getGogGameDetail).mockRejectedValue(
      new GogApiError({ message: "Not Found", statusCode: 404 }),
    );

    await updateGogGames();

    const ignored = firstOrThrow(
      db
        .select()
        .from(gogIgnoredProduct)
        .where(eq(gogIgnoredProduct.gogId, 501))
        .all(),
    );
    expect(ignored.reason).toBe("NOT_FOUND");

    vi.mocked(getGogGameDetail).mockClear();
    await updateGogGames();
    expect(getGogGameDetail).not.toHaveBeenCalled();
  });

  it("does not count a 404 as a sync failure", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([504]);
    vi.mocked(getGogGameDetail).mockRejectedValue(
      new GogApiError({ message: "Not Found", statusCode: 404 }),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await updateGogGames();

    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("Failed to sync"),
    );
    consoleError.mockRestore();
  });

  it("does not ignore a product whose detail request fails transiently", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([502]);
    vi.mocked(getGogGameDetail).mockRejectedValue(
      new GogApiError({
        message: "Too Many Requests",
        statusCode: 429,
        retriable: true,
      }),
    );

    await updateGogGames();

    expect(
      await db.$count(gogIgnoredProduct, eq(gogIgnoredProduct.gogId, 502)),
    ).toBe(0);
  });

  it("persists the product type", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([503]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      generateFakeGogGameDetail({ id: 503, productType: "GAME" }),
    );

    await updateGogGames();

    const storedGame = firstOrThrow(db.select().from(gogGame).all());
    expect(storedGame.productType).toBe("GAME");
  });

  it("continues with the rest when one game fails to store", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([600, 601, 602]);
    vi.mocked(getGogGameDetail).mockImplementation(async (id: number) =>
      generateFakeGogGameDetail({
        id,
        title: `Game ${id}`,
        gogReleaseDate: id === 601 ? "not-a-date" : undefined,
      }),
    );

    await updateGogGames();

    const gogGames = db
      .select()
      .from(gogGame)
      .orderBy(asc(gogGame.gogId))
      .all();
    expect(gogGames.map((g) => g.gogId)).toStrictEqual([600, 602]);
  });

  it("refreshes the parent Game aggregates after an update", async () => {
    await createGogUser();
    const existing = await createGogGame({
      gogId: 700,
      playtimeMinutes: 120,
      lastPlayedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    vi.mocked(getGogUserGames).mockResolvedValue([700]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      generateFakeGogGameDetail({ id: 700 }),
    );

    await updateGogGames();

    const storedGame = firstOrThrow(
      db.select().from(game).where(eq(game.id, existing.gameId)).all(),
    );
    expect(storedGame.playtimeMinutes).toBe(120);
    expect(storedGame.lastPlayedAt).toStrictEqual(
      new Date("2024-01-01T00:00:00.000Z"),
    );
  });

  it("skips games whose detail request fails and continues with the rest", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([400, 401, 402]);
    vi.mocked(getGogGameDetail).mockImplementation(async (id: number) => {
      if (id === 401) throw new Error("404");
      return generateFakeGogGameDetail({ id, title: `Game ${id}` });
    });

    await updateGogGames();

    const gogGames = db
      .select()
      .from(gogGame)
      .orderBy(asc(gogGame.gogId))
      .all();
    expect(gogGames.map((g) => g.gogId)).toStrictEqual([400, 402]);
  });

  it("throws when the user games request fails", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockRejectedValue(new Error("nope"));

    await expect(updateGogGames()).rejects.toThrow(
      "Failed to get user games from GOG",
    );
  });
});

describe("recordGogPlaytime", () => {
  it("creates a first record with no start timestamp", async () => {
    const playedGame = await createGogGame({ gogId: 800 });
    const sessions = generateFakeGogPlaytimeSessions({
      time_sum: 60,
      last_session_date: 1700000000,
    });
    const now = new Date("2026-01-01T00:00:00.000Z");

    const record = await recordGogPlaytime(playedGame, sessions, now);

    expect(record.timestampStart).toBeNull();
    expect(record.timestampEnd).toStrictEqual(now);
    expect(record.playtimeMinutes).toBe(60);
    expect(record.lastPlayedAt).toStrictEqual(new Date(1700000000 * 1000));
  });

  it("extends the last record when the playtime has not changed", async () => {
    const playedGame = await createGogGame({ gogId: 801 });
    const sessions = generateFakeGogPlaytimeSessions({ time_sum: 60 });
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");
    const third = new Date("2026-01-03T00:00:00.000Z");

    await recordGogPlaytime(playedGame, sessions, first);
    await recordGogPlaytime(playedGame, sessions, second);
    await recordGogPlaytime(playedGame, sessions, third);

    const records = await getGogPlaytimeRecords(801);
    expect(records).toHaveLength(2);
    expect(records[1].timestampStart).toStrictEqual(first);
    expect(records[1].timestampEnd).toStrictEqual(third);
  });

  it("creates a new record when the playtime changes", async () => {
    const playedGame = await createGogGame({ gogId: 802 });
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");

    await recordGogPlaytime(
      playedGame,
      generateFakeGogPlaytimeSessions({ time_sum: 60 }),
      first,
    );
    const record = await recordGogPlaytime(
      playedGame,
      generateFakeGogPlaytimeSessions({ time_sum: 90 }),
      second,
    );

    expect(await getGogPlaytimeRecords(802)).toHaveLength(2);
    expect(record.timestampStart).toStrictEqual(first);
    expect(record.playtimeMinutes).toBe(90);
  });

  it("updates the GogGame and parent Game fields", async () => {
    const playedGame = await createGogGame({ gogId: 803 });
    const sessions = generateFakeGogPlaytimeSessions({
      time_sum: 150,
      last_session_date: 1700000000,
    });

    await recordGogPlaytime(playedGame, sessions, new Date());

    const stored = firstOrThrow(
      db.select().from(gogGame).where(eq(gogGame.gogId, 803)).all(),
    );
    expect(stored.playtimeMinutes).toBe(150);
    expect(stored.lastPlayedAt).toStrictEqual(new Date(1700000000 * 1000));
    const storedGame = firstOrThrow(
      db.select().from(game).where(eq(game.id, playedGame.gameId)).all(),
    );
    expect(storedGame.playtimeMinutes).toBe(150);
    expect(storedGame.lastPlayedAt).toStrictEqual(new Date(1700000000 * 1000));
  });

  it("stores a null lastPlayedAt when there is no session date", async () => {
    const playedGame = await createGogGame({ gogId: 804 });
    const sessions = generateFakeGogPlaytimeSessions({
      time_sum: 0,
      last_session_date: null,
    });

    const record = await recordGogPlaytime(playedGame, sessions, new Date());

    expect(record.lastPlayedAt).toBeNull();
  });
});

describe("recordGogPlaytimes", () => {
  it("does nothing when there is no user", async () => {
    expect(await recordGogPlaytimes()).toBeUndefined();
    expect(getGogGamePlaytime).not.toHaveBeenCalled();
  });

  it("records playtime for each game, skipping those whose fetch fails", async () => {
    const user = await createGogUser();
    await createGogGame({ gogId: 900 });
    await createGogGame({ gogId: 901 });
    vi.mocked(getGogGamePlaytime).mockImplementation(async (gameId: number) => {
      if (gameId === 901) throw new Error("nope");
      return generateFakeGogPlaytimeSessions({ time_sum: 42 });
    });

    await recordGogPlaytimes();

    expect(getGogGamePlaytime).toHaveBeenCalledWith(
      900,
      user.galaxyUserId,
      user.accessToken,
    );
    expect(getGogGamePlaytime).not.toHaveBeenCalledWith(
      900,
      user.gogUserId,
      user.accessToken,
    );
    expect(await getGogPlaytimeRecords(900)).toHaveLength(1);
    expect(await getGogPlaytimeRecords(901)).toHaveLength(0);
  });
});
