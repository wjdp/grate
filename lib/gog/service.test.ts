import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getGogGameDetail,
  getGogToken,
  getGogUserData,
  getGogUserGames,
  refreshGogToken,
} from "~/lib/gog/api";
import {
  createGogGame,
  createGogUser,
  generateFakeGogGameDetail,
  generateFakeGogToken,
  generateFakeGogUser,
} from "~/lib/gog/fixtures/fake";
import {
  createOrUpdateGogUser,
  handleRefreshToken,
  updateGogGames,
  updateGogUser,
} from "~/lib/gog/service";
import prisma from "~/lib/prisma";
import { flushDb } from "~/test/db";

vi.mock("~/lib/gog/api");

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
    expect(await prisma.gogUser.count()).toBe(1);
  });

  it("updates the existing user when the gogUserId matches", async () => {
    const existing = await createGogUser();
    const token = generateFakeGogToken();
    const apiUser = generateFakeGogUser({ userId: existing.gogUserId });
    vi.mocked(getGogToken).mockResolvedValue(token);
    vi.mocked(getGogUserData).mockResolvedValue(apiUser);

    const user = await createOrUpdateGogUser("code-123");

    expect(await prisma.gogUser.count()).toBe(1);
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
    expect(await prisma.gogUser.count()).toBe(1);
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
    expect(await prisma.gogUser.count()).toBe(0);
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
    const stored = await prisma.gogUser.findFirstOrThrow();
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

    const gogGame = await prisma.gogGame.findFirstOrThrow({
      include: { game: true },
    });
    expect(gogGame.gogId).toBe(100);
    expect(gogGame.name).toBe("Some Game");
    expect(gogGame.game.name).toBe("Some Game");
    expect(gogGame.releaseDate).toStrictEqual(
      new Date("2014-01-02T00:00:00.000Z"),
    );
    expect(gogGame.description).toBe(detail.description);
    expect(gogGame.publisher).toBe("A Publisher");
    expect(gogGame.developer).toBe("Dev One, Dev Two");
    expect(gogGame.iconUrl).toBe(detail._links.icon?.href);
    expect(gogGame.iconSquareUrl).toBe(detail._links.iconSquare?.href);
    expect(gogGame.logoUrl).toBe(detail._links.logo?.href);
    expect(gogGame.boxArtImageUrl).toBe(detail._links.boxArtImage?.href);
    expect(gogGame.backgroundImageUrl).toBe(
      detail._links.backgroundImage?.href,
    );
    expect(gogGame.galaxyBackgroundImageUrl).toBe(
      detail._links.galaxyBackgroundImage?.href,
    );
    expect(gogGame.tags).toStrictEqual(detail._embedded.tags);
    expect(gogGame.properties).toStrictEqual(detail._embedded.properties);
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

    const gogGame = await prisma.gogGame.findFirstOrThrow();
    expect(gogGame.releaseDate).toStrictEqual(
      new Date("2015-05-19T00:00:00.000Z"),
    );
  });

  it("updates an existing GogGame without creating another Game", async () => {
    await createGogUser();
    const existing = await createGogGame({ gogId: 200, name: "Old Name" });
    vi.mocked(getGogUserGames).mockResolvedValue([200]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      generateFakeGogGameDetail({ id: 200, title: "New Name" }),
    );

    await updateGogGames();

    expect(await prisma.game.count()).toBe(1);
    expect(await prisma.gogGame.count()).toBe(1);
    const gogGame = await prisma.gogGame.findFirstOrThrow({
      include: { game: true },
    });
    expect(gogGame.gameId).toBe(existing.gameId);
    expect(gogGame.name).toBe("New Name");
    // The parent Game name is not updated, only the GogGame name
    expect(gogGame.game.name).toBe("Old Name");
  });

  it.each(["DLC", "PACK"])("skips %s products", async (productType) => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([300]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      generateFakeGogGameDetail({ id: 300, productType }),
    );

    await updateGogGames();

    expect(await prisma.gogGame.count()).toBe(0);
    expect(await prisma.game.count()).toBe(0);
  });

  it("skips the ignored product id", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([1185685769]);
    vi.mocked(getGogGameDetail).mockResolvedValue(
      generateFakeGogGameDetail({ id: 1185685769 }),
    );

    await updateGogGames();

    expect(await prisma.gogGame.count()).toBe(0);
  });

  it("skips games whose detail request fails and continues with the rest", async () => {
    await createGogUser();
    vi.mocked(getGogUserGames).mockResolvedValue([400, 401, 402]);
    vi.mocked(getGogGameDetail).mockImplementation(async (id: number) => {
      if (id === 401) throw new Error("404");
      return generateFakeGogGameDetail({ id, title: `Game ${id}` });
    });

    await updateGogGames();

    const gogGames = await prisma.gogGame.findMany({
      orderBy: { gogId: "asc" },
    });
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
