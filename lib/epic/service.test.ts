import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { epicGame, epicIgnoredItem, epicUser, game } from "~~/db/schema";
import { db } from "~~/lib/db";
import {
  EpicApiError,
  type EpicCatalogItem,
  getEpicAccount,
  getEpicCatalogItems,
  getEpicLibraryItems,
  getEpicPlaytimes,
  getEpicStoreContent,
  getEpicStoreSlug,
  getEpicToken,
  refreshEpicToken,
} from "~~/lib/epic/api";
import {
  createEpicUser,
  generateFakeEpicCatalogItem,
  generateFakeEpicLibraryRecord,
  generateFakeEpicPlaytime,
  generateFakeEpicToken,
} from "~~/lib/epic/fixtures/fake";
import {
  createOrUpdateEpicUser,
  getEpicPlaytimeRecords,
  handleRefreshToken,
  recordEpicPlaytime,
  recordEpicPlaytimes,
  updateEpicGames,
  updateEpicUser,
} from "~~/lib/epic/service";
import { createEpicGame } from "~~/lib/fixtures/game";
import { flushDb } from "~~/test/db";

vi.mock("~~/lib/epic/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~~/lib/epic/api")>()),
  getEpicAccount: vi.fn(),
  getEpicCatalogItems: vi.fn(),
  getEpicLibraryItems: vi.fn(),
  getEpicPlaytimes: vi.fn(),
  getEpicStoreContent: vi.fn(),
  getEpicStoreSlug: vi.fn(),
  getEpicToken: vi.fn(),
  refreshEpicToken: vi.fn(),
}));

const SECOND = 1000;
const MINUTE = 60 * SECOND;

function expiresAtIn(milliseconds: number) {
  return new Date(Date.now() + milliseconds);
}

function firstOrThrow<T>(rows: T[]): T {
  const [row] = rows;
  if (!row) throw new Error("Expected at least one row");
  return row;
}

function catalogResponse(
  ...items: EpicCatalogItem[]
): Record<string, EpicCatalogItem> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

beforeEach(async () => {
  vi.resetAllMocks();
  await flushDb();
  vi.mocked(getEpicStoreSlug).mockResolvedValue(null);
  vi.mocked(getEpicStoreContent).mockResolvedValue(null);
  vi.mocked(getEpicAccount).mockImplementation(async (accountId: string) => ({
    id: accountId,
    displayName: "Account Name",
    country: "GB",
  }));
});

describe("createOrUpdateEpicUser", () => {
  it("creates an EpicUser from the token and account details", async () => {
    const token = generateFakeEpicToken({
      account_id: "account-1",
      displayName: "Player One",
      expires_at: "2026-01-02T00:00:00.000Z",
      refresh_expires_at: "2026-02-01T00:00:00.000Z",
    });
    vi.mocked(getEpicToken).mockResolvedValue(token);

    const user = await createOrUpdateEpicUser("code-123");

    expect(getEpicToken).toHaveBeenCalledWith("code-123");
    expect(user.accountId).toBe("account-1");
    expect(user.displayName).toBe("Player One");
    expect(user.country).toBe("GB");
    expect(user.accessToken).toBe(token.access_token);
    expect(user.refreshToken).toBe(token.refresh_token);
    expect(user.accessTokenExpiresAt).toStrictEqual(
      new Date("2026-01-02T00:00:00.000Z"),
    );
    expect(user.refreshTokenExpiresAt).toStrictEqual(
      new Date("2026-02-01T00:00:00.000Z"),
    );
    expect(await db.$count(epicUser)).toBe(1);
  });

  it("falls back to expires_in when the token has no expires_at", async () => {
    const token = generateFakeEpicToken({ expires_in: 3600 });
    const { expires_at: _expiresAt, ...withoutExpiresAt } = token;
    vi.mocked(getEpicToken).mockResolvedValue(withoutExpiresAt);

    const before = Date.now();
    const user = await createOrUpdateEpicUser("code-123");

    expect(
      Math.abs(user.accessTokenExpiresAt.getTime() - (before + 3600 * SECOND)),
    ).toBeLessThan(5 * SECOND);
  });

  it("tolerates a failing account lookup", async () => {
    vi.mocked(getEpicToken).mockResolvedValue(
      generateFakeEpicToken({ displayName: "Player One" }),
    );
    vi.mocked(getEpicAccount).mockRejectedValue(new Error("nope"));

    const user = await createOrUpdateEpicUser("code-123");

    expect(user.displayName).toBe("Player One");
    expect(user.country).toBeNull();
  });

  it("updates the existing user when the accountId matches", async () => {
    const existing = await createEpicUser();
    const token = generateFakeEpicToken({ account_id: existing.accountId });
    vi.mocked(getEpicToken).mockResolvedValue(token);

    const user = await createOrUpdateEpicUser("code-123");

    expect(await db.$count(epicUser)).toBe(1);
    expect(user.accessToken).toBe(token.access_token);
    expect(user.refreshToken).toBe(token.refresh_token);
  });

  it("throws when a different Epic account already exists", async () => {
    await createEpicUser({ accountId: "111" });
    vi.mocked(getEpicToken).mockResolvedValue(
      generateFakeEpicToken({ account_id: "222" }),
    );

    await expect(createOrUpdateEpicUser("code-123")).rejects.toThrow(
      "grate only supports a single Epic account",
    );
    expect(await db.$count(epicUser)).toBe(1);
  });

  it("throws when the token request fails", async () => {
    vi.mocked(getEpicToken).mockRejectedValue(new Error("nope"));

    await expect(createOrUpdateEpicUser("code-123")).rejects.toThrow(
      "Failed to authenticate with Epic",
    );
    expect(await db.$count(epicUser)).toBe(0);
  });
});

describe("handleRefreshToken", () => {
  it("returns the user unchanged when the token has plenty of life left", async () => {
    const user = await createEpicUser({
      accessTokenExpiresAt: expiresAtIn(10 * MINUTE),
    });

    const result = await handleRefreshToken(user);

    expect(result).toStrictEqual(user);
    expect(refreshEpicToken).not.toHaveBeenCalled();
  });

  it("refreshes and persists new tokens when the access token has expired", async () => {
    const user = await createEpicUser({
      accessTokenExpiresAt: expiresAtIn(-1 * MINUTE),
    });
    const token = generateFakeEpicToken({
      expires_at: "2026-01-02T00:00:00.000Z",
      refresh_expires_at: "2026-02-01T00:00:00.000Z",
    });
    vi.mocked(refreshEpicToken).mockResolvedValue(token);

    const result = await handleRefreshToken(user);

    expect(refreshEpicToken).toHaveBeenCalledWith(user.refreshToken);
    expect(result.accessToken).toBe(token.access_token);
    expect(result.refreshToken).toBe(token.refresh_token);
    expect(result.refreshTokenExpiresAt).toStrictEqual(
      new Date("2026-02-01T00:00:00.000Z"),
    );
    const stored = firstOrThrow(db.select().from(epicUser).all());
    expect(stored.accessToken).toBe(token.access_token);
  });

  it("refreshes when the token expires within the two minute buffer", async () => {
    const user = await createEpicUser({
      accessTokenExpiresAt: expiresAtIn(MINUTE),
    });
    vi.mocked(refreshEpicToken).mockResolvedValue(generateFakeEpicToken());

    await handleRefreshToken(user);

    expect(refreshEpicToken).toHaveBeenCalledOnce();
  });

  it("throws when the refresh token itself has expired", async () => {
    const user = await createEpicUser({
      accessTokenExpiresAt: expiresAtIn(-1 * MINUTE),
      refreshTokenExpiresAt: expiresAtIn(-1 * MINUTE),
    });

    await expect(handleRefreshToken(user)).rejects.toThrow(
      "The Epic refresh token has expired",
    );
    expect(refreshEpicToken).not.toHaveBeenCalled();
  });

  it("throws when the refresh request fails", async () => {
    const user = await createEpicUser({
      accessTokenExpiresAt: expiresAtIn(-1 * MINUTE),
    });
    vi.mocked(refreshEpicToken).mockRejectedValue(new Error("nope"));

    await expect(handleRefreshToken(user)).rejects.toThrow(
      "Failed to refresh Epic token",
    );
  });
});

describe("updateEpicUser", () => {
  it("returns undefined when there is no user", async () => {
    expect(await updateEpicUser()).toBeUndefined();
    expect(getEpicAccount).not.toHaveBeenCalled();
  });

  it("updates the stored profile fields", async () => {
    const user = await createEpicUser({ displayName: "Old", country: "US" });
    vi.mocked(getEpicAccount).mockResolvedValue({
      id: user.accountId,
      displayName: "New",
      country: "GB",
    });

    const result = await updateEpicUser();

    expect(getEpicAccount).toHaveBeenCalledWith(
      user.accountId,
      user.accessToken,
    );
    expect(result?.displayName).toBe("New");
    expect(result?.country).toBe("GB");
  });

  it("throws when the account request fails", async () => {
    await createEpicUser();
    vi.mocked(getEpicAccount).mockRejectedValue(new Error("nope"));

    await expect(updateEpicUser()).rejects.toThrow(
      "Failed to get account details from Epic",
    );
  });
});

describe("updateEpicGames", () => {
  it("does nothing when there is no user", async () => {
    expect(await updateEpicGames()).toBeUndefined();
    expect(getEpicLibraryItems).not.toHaveBeenCalled();
  });

  it("reports progress per record", async () => {
    await createEpicUser();
    const record = generateFakeEpicLibraryRecord({
      namespace: "ns-progress",
      catalogItemId: "item-progress",
      appName: "AppProgress",
    });
    const item = generateFakeEpicCatalogItem({
      id: "item-progress",
      namespace: "ns-progress",
      title: "Progress Game",
    });
    vi.mocked(getEpicLibraryItems).mockResolvedValue([record]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue(catalogResponse(item));
    const messages: string[] = [];

    await updateEpicGames(({ message }) => {
      messages.push(message);
    });

    expect(messages).toStrictEqual(["updated 1/1 games"]);
  });

  it("creates a Game and EpicGame from the library and catalog", async () => {
    await createEpicUser();
    const record = generateFakeEpicLibraryRecord({
      namespace: "ns-1",
      catalogItemId: "item-1",
      appName: "AppOne",
      acquisitionDate: "2024-03-04T05:06:07.000Z",
    });
    const item = generateFakeEpicCatalogItem({
      id: "item-1",
      namespace: "ns-1",
      title: "Some Game",
      description: "A fine game",
      developer: "Dev One",
      categories: [{ path: "games" }, { path: "applications" }],
      keyImages: [
        { type: "OfferImageTall", url: "https://cdn/tall.png" },
        { type: "DieselGameBox", url: "https://cdn/wide.png" },
        { type: "DieselGameBoxLogo", url: "https://cdn/logo.png" },
      ],
      customAttributes: {
        ThirdPartyManagedApp: { type: "STRING", value: "Ubisoft" },
      },
    });
    vi.mocked(getEpicLibraryItems).mockResolvedValue([record]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue(catalogResponse(item));

    await updateEpicGames();

    const stored = firstOrThrow(
      await db.query.epicGame.findMany({ with: { game: true } }),
    );
    expect(stored.appName).toBe("AppOne");
    expect(stored.namespace).toBe("ns-1");
    expect(stored.catalogItemId).toBe("item-1");
    expect(stored.name).toBe("Some Game");
    expect(stored.game.name).toBe("Some Game");
    expect(stored.description).toBe("A fine game");
    expect(stored.developer).toBe("Dev One");
    expect(stored.categories).toStrictEqual(["games", "applications"]);
    expect(stored.acquisitionDate).toStrictEqual(
      new Date("2024-03-04T05:06:07.000Z"),
    );
    expect(stored.boxArtTallUrl).toBe("https://cdn/tall.png");
    expect(stored.boxArtWideUrl).toBe("https://cdn/wide.png");
    expect(stored.logoUrl).toBe("https://cdn/logo.png");
    expect(stored.thirdPartyStore).toBe("Ubisoft");
  });

  it("stores a null description when the catalog description is just the title", async () => {
    await createEpicUser();
    const record = generateFakeEpicLibraryRecord({ catalogItemId: "item-2" });
    vi.mocked(getEpicLibraryItems).mockResolvedValue([record]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue(
      catalogResponse(
        generateFakeEpicCatalogItem({
          id: "item-2",
          title: "Manifold Garden",
          description: "Manifold Garden",
        }),
      ),
    );

    await updateEpicGames();

    const stored = firstOrThrow(db.select().from(epicGame).all());
    expect(stored.description).toBeNull();
  });

  it("enriches a new game from the store pages", async () => {
    await createEpicUser();
    const record = generateFakeEpicLibraryRecord({
      namespace: "ns-3",
      catalogItemId: "item-3",
    });
    vi.mocked(getEpicLibraryItems).mockResolvedValue([record]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue(
      catalogResponse(generateFakeEpicCatalogItem({ id: "item-3" })),
    );
    vi.mocked(getEpicStoreSlug).mockResolvedValue("manifold-garden");
    vi.mocked(getEpicStoreContent).mockResolvedValue({
      releaseDate: "2019-10-18T00:00:00.000Z",
      developer: ["William Chyr Studio"],
      publisher: ["William Chyr Studio"],
      shortDescription: "An Escher-esque puzzle game",
    });

    await updateEpicGames();

    expect(getEpicStoreSlug).toHaveBeenCalledWith("ns-3");
    expect(getEpicStoreContent).toHaveBeenCalledWith("manifold-garden");
    const stored = firstOrThrow(db.select().from(epicGame).all());
    expect(stored.storeSlug).toBe("manifold-garden");
    expect(stored.releaseDate).toStrictEqual(
      new Date("2019-10-18T00:00:00.000Z"),
    );
    expect(stored.publisher).toBe("William Chyr Studio");
    expect(stored.description).toBe("An Escher-esque puzzle game");
  });

  it("creates the game when the store enrichment fails", async () => {
    await createEpicUser();
    vi.mocked(getEpicLibraryItems).mockResolvedValue([
      generateFakeEpicLibraryRecord({ catalogItemId: "item-4" }),
    ]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue(
      catalogResponse(generateFakeEpicCatalogItem({ id: "item-4" })),
    );
    vi.mocked(getEpicStoreSlug).mockRejectedValue(new Error("nope"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await updateEpicGames();

    const stored = firstOrThrow(db.select().from(epicGame).all());
    expect(stored.storeSlug).toBeNull();
    consoleError.mockRestore();
  });

  it("ignores Unreal Marketplace and private records without a catalog call", async () => {
    await createEpicUser();
    vi.mocked(getEpicLibraryItems).mockResolvedValue([
      generateFakeEpicLibraryRecord({ namespace: "ue", appName: "UeAsset" }),
      generateFakeEpicLibraryRecord({
        sandboxName: "fab-listing-live",
        appName: "FabItem",
      }),
      generateFakeEpicLibraryRecord({
        namespace: "89efe5924d3d467c839449ab6ab52e7f",
        appName: "FabNamespaceItem",
      }),
      generateFakeEpicLibraryRecord({
        sandboxType: "PRIVATE",
        appName: "PrivateItem",
      }),
    ]);

    await updateEpicGames();

    expect(getEpicCatalogItems).not.toHaveBeenCalled();
    const ignored = db.select().from(epicIgnoredItem).all();
    expect(
      Object.fromEntries(ignored.map((item) => [item.appName, item.reason])),
    ).toStrictEqual({
      UeAsset: "UE",
      FabItem: "UE",
      FabNamespaceItem: "UE",
      PrivateItem: "PRIVATE",
    });
    expect(await db.$count(epicGame)).toBe(0);
  });

  it.each([
    [
      "DLC",
      { mainGameItem: { id: "parent" } } satisfies Partial<EpicCatalogItem>,
    ],
    ["MOD", { categories: [{ path: "mods" }] }],
    ["UE", { categories: [{ path: "engines/ue4" }] }],
    ["UE", { categories: [{ path: "plugins" }] }],
    [
      "MOBILE_ONLY",
      { releaseInfo: [{ appId: "mob", platform: ["Android", "IOS"] }] },
    ],
    ["EDITOR_RESOURCE", { entitlementType: "AUDIENCE" }],
    ["EDITOR_RESOURCE", { categories: [{ path: "type/format-item" }] }],
    [
      "EDITOR_RESOURCE",
      { customAttributes: { ListingIdentifier: { value: "x" } } },
    ],
    [
      "EDITOR_RESOURCE",
      {
        releaseInfo: [
          { appId: "a", platform: [], compatibleApps: ["UE_4.27"] },
        ],
      },
    ],
  ])(
    "ignores a catalog item as %s",
    async (reason, overrides: Partial<EpicCatalogItem>) => {
      await createEpicUser();
      vi.mocked(getEpicLibraryItems).mockResolvedValue([
        generateFakeEpicLibraryRecord({
          catalogItemId: "item-x",
          appName: "IgnoredApp",
        }),
      ]);
      vi.mocked(getEpicCatalogItems).mockResolvedValue(
        catalogResponse(
          generateFakeEpicCatalogItem({ id: "item-x", ...overrides }),
        ),
      );

      await updateEpicGames();

      expect(await db.$count(epicGame)).toBe(0);
      expect(await db.$count(game)).toBe(0);
      const ignored = firstOrThrow(db.select().from(epicIgnoredItem).all());
      expect(ignored.reason).toBe(reason);
    },
  );

  it("syncs an ordinary game whose releaseInfo has an empty compatibleApps array", async () => {
    await createEpicUser();
    vi.mocked(getEpicLibraryItems).mockResolvedValue([
      generateFakeEpicLibraryRecord({
        catalogItemId: "item-y",
        appName: "OrdinaryGame",
      }),
    ]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue(
      catalogResponse(
        generateFakeEpicCatalogItem({
          id: "item-y",
          title: "Control",
          releaseInfo: [
            { appId: "control", platform: ["Windows"], compatibleApps: [] },
          ],
        }),
      ),
    );

    await updateEpicGames();

    expect(await db.$count(epicIgnoredItem)).toBe(0);
    const stored = firstOrThrow(db.select().from(epicGame).all());
    expect(stored.name).toBe("Control");
  });

  it("ignores an item missing from the catalog response and skips it next run", async () => {
    await createEpicUser();
    vi.mocked(getEpicLibraryItems).mockResolvedValue([
      generateFakeEpicLibraryRecord({
        catalogItemId: "missing",
        appName: "MissingApp",
      }),
    ]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue({});

    await updateEpicGames();

    const ignored = firstOrThrow(db.select().from(epicIgnoredItem).all());
    expect(ignored.appName).toBe("MissingApp");
    expect(ignored.reason).toBe("NOT_FOUND");

    vi.mocked(getEpicCatalogItems).mockClear();
    await updateEpicGames();
    expect(getEpicCatalogItems).not.toHaveBeenCalled();
  });

  it("updates an existing EpicGame without creating another Game", async () => {
    await createEpicUser();
    const existing = createEpicGame({ appName: "AppTwo", name: "Old Name" });
    vi.mocked(getEpicLibraryItems).mockResolvedValue([
      generateFakeEpicLibraryRecord({
        appName: "AppTwo",
        catalogItemId: "item-5",
      }),
    ]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue(
      catalogResponse(
        generateFakeEpicCatalogItem({ id: "item-5", title: "New Name" }),
      ),
    );

    await updateEpicGames();

    expect(await db.$count(game)).toBe(1);
    expect(await db.$count(epicGame)).toBe(1);
    const stored = firstOrThrow(
      await db.query.epicGame.findMany({ with: { game: true } }),
    );
    expect(stored.gameId).toBe(existing.gameId);
    expect(stored.name).toBe("New Name");
    expect(stored.game.name).toBe("New Name");
  });

  it("does not rename a Game that owns more than one provider row", async () => {
    await createEpicUser();
    const existing = createEpicGame({ appName: "AppThree", name: "Old Name" });
    createEpicGame({
      appName: "AppThreeDeluxe",
      gameId: existing.gameId,
      name: "Old Name (Deluxe)",
    });
    vi.mocked(getEpicLibraryItems).mockResolvedValue([
      generateFakeEpicLibraryRecord({
        appName: "AppThree",
        catalogItemId: "item-6",
      }),
    ]);
    vi.mocked(getEpicCatalogItems).mockResolvedValue(
      catalogResponse(
        generateFakeEpicCatalogItem({ id: "item-6", title: "New Name" }),
      ),
    );

    await updateEpicGames();

    const stored = firstOrThrow(
      await db.query.epicGame.findMany({
        where: eq(epicGame.appName, "AppThree"),
        with: { game: true },
      }),
    );
    expect(stored.name).toBe("New Name");
    expect(stored.game.name).toBe("Old Name");
  });

  it("does not ignore items when the catalog request fails transiently", async () => {
    await createEpicUser();
    vi.mocked(getEpicLibraryItems).mockResolvedValue([
      generateFakeEpicLibraryRecord({
        namespace: "ns-a",
        appName: "TransientApp",
      }),
      generateFakeEpicLibraryRecord({
        namespace: "ns-b",
        catalogItemId: "item-7",
        appName: "GoodApp",
      }),
    ]);
    vi.mocked(getEpicCatalogItems).mockImplementation(
      async (namespace: string) => {
        if (namespace === "ns-a") {
          throw new EpicApiError({
            message: "Too Many Requests",
            statusCode: 429,
            retriable: true,
          });
        }
        return catalogResponse(generateFakeEpicCatalogItem({ id: "item-7" }));
      },
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await updateEpicGames();

    expect(await db.$count(epicIgnoredItem)).toBe(0);
    const stored = db
      .select()
      .from(epicGame)
      .orderBy(asc(epicGame.epicId))
      .all();
    expect(stored.map((row) => row.appName)).toStrictEqual(["GoodApp"]);
    consoleError.mockRestore();
  });

  it("batches the catalog call per namespace", async () => {
    await createEpicUser();
    vi.mocked(getEpicLibraryItems).mockResolvedValue([
      generateFakeEpicLibraryRecord({
        namespace: "ns-1",
        catalogItemId: "item-a",
        appName: "A",
      }),
      generateFakeEpicLibraryRecord({
        namespace: "ns-1",
        catalogItemId: "item-b",
        appName: "B",
      }),
    ]);
    const user = firstOrThrow(db.select().from(epicUser).all());
    vi.mocked(getEpicCatalogItems).mockResolvedValue(
      catalogResponse(
        generateFakeEpicCatalogItem({ id: "item-a" }),
        generateFakeEpicCatalogItem({ id: "item-b" }),
      ),
    );

    await updateEpicGames();

    expect(getEpicCatalogItems).toHaveBeenCalledOnce();
    expect(getEpicCatalogItems).toHaveBeenCalledWith(
      "ns-1",
      ["item-a", "item-b"],
      user.accessToken,
    );
    expect(await db.$count(epicGame)).toBe(2);
  });

  it("throws when the library request fails", async () => {
    await createEpicUser();
    vi.mocked(getEpicLibraryItems).mockRejectedValue(new Error("nope"));

    await expect(updateEpicGames()).rejects.toThrow(
      "Failed to get library items from Epic",
    );
  });
});

describe("recordEpicPlaytime", () => {
  it("converts seconds to whole minutes on the first record", async () => {
    const playedGame = createEpicGame();
    const now = new Date("2026-01-01T00:00:00.000Z");

    const record = await recordEpicPlaytime(playedGame, 217450, now);

    expect(await getEpicPlaytimeRecords(playedGame.epicId)).toHaveLength(1);
    expect(record.timestampStart).toBeNull();
    expect(record.timestampEnd).toStrictEqual(now);
    expect(record.playtimeMinutes).toBe(3624);
    expect(record.lastPlayedAt).toBeNull();
  });

  it("extends the last record when the playtime has not changed", async () => {
    const playedGame = createEpicGame();
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");
    const third = new Date("2026-01-03T00:00:00.000Z");

    await recordEpicPlaytime(playedGame, 3600, first);
    await recordEpicPlaytime(playedGame, 3600, second);
    await recordEpicPlaytime(playedGame, 3600, third);

    const records = await getEpicPlaytimeRecords(playedGame.epicId);
    expect(records).toHaveLength(2);
    expect(records[1].timestampStart).toStrictEqual(first);
    expect(records[1].timestampEnd).toStrictEqual(third);
  });

  it("creates a new record when the playtime changes", async () => {
    const playedGame = createEpicGame();
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");

    await recordEpicPlaytime(playedGame, 3600, first);
    const record = await recordEpicPlaytime(playedGame, 5400, second);

    expect(await getEpicPlaytimeRecords(playedGame.epicId)).toHaveLength(2);
    expect(record.timestampStart).toStrictEqual(first);
    expect(record.playtimeMinutes).toBe(90);
  });

  it("updates the EpicGame and parent Game aggregates", async () => {
    const playedGame = createEpicGame();

    await recordEpicPlaytime(playedGame, 9000, new Date());

    const stored = firstOrThrow(
      db
        .select()
        .from(epicGame)
        .where(eq(epicGame.epicId, playedGame.epicId))
        .all(),
    );
    expect(stored.playtimeMinutes).toBe(150);
    const storedGame = firstOrThrow(
      db.select().from(game).where(eq(game.id, playedGame.gameId)).all(),
    );
    expect(storedGame.playtimeMinutes).toBe(150);
  });

  it("leaves lastPlayedAt null on the first record and the EpicGame", async () => {
    const playedGame = createEpicGame();
    const now = new Date("2026-01-01T00:00:00.000Z");

    const record = await recordEpicPlaytime(playedGame, 3600, now);

    expect(record.lastPlayedAt).toBeNull();
    const stored = firstOrThrow(
      db
        .select()
        .from(epicGame)
        .where(eq(epicGame.epicId, playedGame.epicId))
        .all(),
    );
    expect(stored.lastPlayedAt).toBeNull();
  });

  it("sets lastPlayedAt to now when playtime increases, on both the row and the EpicGame", async () => {
    const playedGame = createEpicGame();
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");

    await recordEpicPlaytime(playedGame, 3600, first);
    const record = await recordEpicPlaytime(playedGame, 5400, second);

    expect(record.lastPlayedAt).toStrictEqual(second);
    const stored = firstOrThrow(
      db
        .select()
        .from(epicGame)
        .where(eq(epicGame.epicId, playedGame.epicId))
        .all(),
    );
    expect(stored.lastPlayedAt).toStrictEqual(second);
    const storedGame = firstOrThrow(
      db.select().from(game).where(eq(game.id, playedGame.gameId)).all(),
    );
    expect(storedGame.lastPlayedAt).toStrictEqual(second);
  });

  it("backfills a null lastPlayedAt from existing history", async () => {
    const playedGame = createEpicGame();
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");
    const third = new Date("2026-01-03T00:00:00.000Z");

    await recordEpicPlaytime(playedGame, 3600, first);
    await recordEpicPlaytime(playedGame, 5400, second);
    db.update(epicGame)
      .set({ lastPlayedAt: null })
      .where(eq(epicGame.epicId, playedGame.epicId))
      .run();

    await recordEpicPlaytime(playedGame, 5400, third);

    const stored = firstOrThrow(
      db
        .select()
        .from(epicGame)
        .where(eq(epicGame.epicId, playedGame.epicId))
        .all(),
    );
    expect(stored.lastPlayedAt).toStrictEqual(second);
  });

  it("keeps the previously derived lastPlayedAt on an unchanged sync", async () => {
    const playedGame = createEpicGame();
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");
    const third = new Date("2026-01-03T00:00:00.000Z");

    await recordEpicPlaytime(playedGame, 3600, first);
    await recordEpicPlaytime(playedGame, 5400, second);
    await recordEpicPlaytime(playedGame, 5400, third);

    const stored = firstOrThrow(
      db
        .select()
        .from(epicGame)
        .where(eq(epicGame.epicId, playedGame.epicId))
        .all(),
    );
    expect(stored.lastPlayedAt).toStrictEqual(second);
  });
});

describe("recordEpicPlaytimes", () => {
  it("does nothing when there is no user", async () => {
    expect(await recordEpicPlaytimes()).toStrictEqual({
      gamesCreated: 0,
      unknownGames: 0,
    });
    expect(getEpicPlaytimes).not.toHaveBeenCalled();
  });

  it("counts played games missing from the database as unknown", async () => {
    await createEpicUser();
    createEpicGame({ appName: "AppKnown" });
    vi.mocked(getEpicPlaytimes).mockResolvedValue([
      generateFakeEpicPlaytime({ artifactId: "AppKnown", totalTime: 120 }),
      generateFakeEpicPlaytime({ artifactId: "AppUnknown", totalTime: 120 }),
      generateFakeEpicPlaytime({ artifactId: "AppUnplayed", totalTime: 0 }),
    ]);

    expect(await recordEpicPlaytimes()).toStrictEqual({
      gamesCreated: 0,
      unknownGames: 1,
    });
  });

  it("does not count persistently ignored items as unknown", async () => {
    await createEpicUser();
    createEpicGame({ appName: "AppTracked" });
    db.insert(epicIgnoredItem)
      .values({ appName: "AppIgnored", reason: "DLC" })
      .run();
    vi.mocked(getEpicPlaytimes).mockResolvedValue([
      generateFakeEpicPlaytime({ artifactId: "AppTracked", totalTime: 120 }),
      generateFakeEpicPlaytime({ artifactId: "AppIgnored", totalTime: 120 }),
    ]);

    expect(await recordEpicPlaytimes()).toStrictEqual({
      gamesCreated: 0,
      unknownGames: 0,
    });
  });

  it("reports progress", async () => {
    await createEpicUser();
    createEpicGame({ appName: "AppProgress" });
    vi.mocked(getEpicPlaytimes).mockResolvedValue([
      generateFakeEpicPlaytime({ artifactId: "AppProgress", totalTime: 60 }),
    ]);
    const messages: string[] = [];

    await recordEpicPlaytimes(({ message }) => {
      messages.push(message);
    });

    expect(messages).toStrictEqual([
      "fetched playtime for 1 games",
      "recorded playtime for 1 games, 0 unknown",
    ]);
  });

  it("records playtime for each game from the bulk response", async () => {
    const user = await createEpicUser();
    const first = createEpicGame({ appName: "AppOne" });
    const second = createEpicGame({ appName: "AppTwo" });
    vi.mocked(getEpicPlaytimes).mockResolvedValue([
      generateFakeEpicPlaytime({ artifactId: "AppOne", totalTime: 120 }),
      generateFakeEpicPlaytime({ artifactId: "AppTwo", totalTime: 600 }),
    ]);

    await recordEpicPlaytimes();

    expect(getEpicPlaytimes).toHaveBeenCalledWith(
      user.accountId,
      user.accessToken,
    );
    expect(
      firstOrThrow(await getEpicPlaytimeRecords(first.epicId)).playtimeMinutes,
    ).toBe(2);
    expect(
      firstOrThrow(await getEpicPlaytimeRecords(second.epicId)).playtimeMinutes,
    ).toBe(10);
  });

  it("records zero minutes for games absent from the bulk response", async () => {
    await createEpicUser();
    const playedGame = createEpicGame({ appName: "AppThree" });
    vi.mocked(getEpicPlaytimes).mockResolvedValue([]);

    await recordEpicPlaytimes();

    const record = firstOrThrow(
      await getEpicPlaytimeRecords(playedGame.epicId),
    );
    expect(record.playtimeMinutes).toBe(0);
    expect(record.lastPlayedAt).toBeNull();
  });

  it("logs and records nothing when the bulk request fails", async () => {
    await createEpicUser();
    const playedGame = createEpicGame();
    vi.mocked(getEpicPlaytimes).mockRejectedValue(new Error("nope"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await recordEpicPlaytimes();

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch Epic playtimes"),
    );
    expect(await getEpicPlaytimeRecords(playedGame.epicId)).toHaveLength(0);
    consoleError.mockRestore();
  });
});
