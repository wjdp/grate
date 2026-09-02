import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSteamGame as createSteamGameFixture } from "~~/lib/fixtures/game";
import { getTagList } from "~~/lib/steam/api";
import { getPicsMetadata, type PicsAppData } from "~~/lib/steam/pics";
import { updatePicsMetadata } from "~~/lib/steam/picsMetadata";
import { db } from "~~/server/database/client";
import type { NewSteamGame } from "~~/server/database/schema";
import { steamPicsMetadata, steamTag } from "~~/server/database/schema";
import { flushDb } from "~~/test/db";

vi.mock("~~/lib/steam/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~~/lib/steam/api")>()),
  getTagList: vi.fn(),
}));

vi.mock("~~/lib/steam/pics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~~/lib/steam/pics")>()),
  getPicsMetadata: vi.fn(),
}));

// The shared fixture spreads its overrides over its defaults, so an omitted
// name arrives as undefined and hits the NOT NULL Game.name column.
function createSteamGame(overrides: Partial<NewSteamGame> = {}) {
  return createSteamGameFixture({
    name: faker.commerce.productName(),
    ...overrides,
  });
}

function picsAppData(overrides: Partial<PicsAppData> = {}): PicsAppData {
  return {
    changenumber: null,
    capsulePath: null,
    capsule2xPath: null,
    heroPath: null,
    hero2xPath: null,
    heroBlurPath: null,
    logoPath: null,
    logo2xPath: null,
    headerPath: null,
    header2xPath: null,
    logoPosition: null,
    iconHash: null,
    reviewScore: null,
    reviewPercentage: null,
    deckCompatibility: null,
    steamosCompatibility: null,
    steamMachineCompatibility: null,
    storeTags: null,
    associations: null,
    steamReleaseDate: null,
    originalReleaseDate: null,
    nameLocalized: null,
    supportedLanguages: null,
    osList: null,
    controllerSupport: null,
    ...overrides,
  };
}

function storedRow(appId: number) {
  return db.query.steamPicsMetadata.findFirst({
    where: (row, { eq }) => eq(row.appId, appId),
  });
}

beforeEach(() => {
  flushDb();
  db.delete(steamPicsMetadata).run();
  db.delete(steamTag).run();
  vi.mocked(getTagList).mockResolvedValue([]);
  vi.mocked(getPicsMetadata).mockResolvedValue(new Map());
});

describe("updatePicsMetadata", () => {
  it("inserts a row for each app returned by PICS", async () => {
    const steamGameRow = createSteamGame();
    vi.mocked(getPicsMetadata).mockResolvedValue(
      new Map([
        [
          steamGameRow.appId,
          picsAppData({ capsulePath: "abc/library_capsule.jpg" }),
        ],
      ]),
    );

    const result = await updatePicsMetadata();

    expect(vi.mocked(getPicsMetadata)).toHaveBeenCalledWith([
      steamGameRow.appId,
    ]);
    const row = await storedRow(steamGameRow.appId);
    expect(row?.capsulePath).toBe("abc/library_capsule.jpg");
    expect(row?.fetchedAt).toBeInstanceOf(Date);
    expect(result.appIdsWithChangedArt).toEqual([steamGameRow.appId]);
  });

  it("does not report a first insert with no asset paths", async () => {
    const steamGameRow = createSteamGame();
    vi.mocked(getPicsMetadata).mockResolvedValue(
      new Map([[steamGameRow.appId, picsAppData({ reviewScore: 8 })]]),
    );

    const result = await updatePicsMetadata();

    expect(result.appIdsWithChangedArt).toEqual([]);
    expect((await storedRow(steamGameRow.appId))?.reviewScore).toBe(8);
  });

  it("reports an app whose asset path changed", async () => {
    const steamGameRow = createSteamGame();
    db.insert(steamPicsMetadata)
      .values({
        appId: steamGameRow.appId,
        fetchedAt: new Date(),
        capsulePath: "old/library_capsule.jpg",
      })
      .run();
    vi.mocked(getPicsMetadata).mockResolvedValue(
      new Map([
        [
          steamGameRow.appId,
          picsAppData({ capsulePath: "new/library_capsule.jpg" }),
        ],
      ]),
    );

    const result = await updatePicsMetadata();

    expect(result.appIdsWithChangedArt).toEqual([steamGameRow.appId]);
    expect((await storedRow(steamGameRow.appId))?.capsulePath).toBe(
      "new/library_capsule.jpg",
    );
  });

  it("does not report an app whose metadata alone changed", async () => {
    const steamGameRow = createSteamGame();
    db.insert(steamPicsMetadata)
      .values({
        appId: steamGameRow.appId,
        fetchedAt: new Date(),
        capsulePath: "abc/library_capsule.jpg",
        reviewScore: 7,
      })
      .run();
    vi.mocked(getPicsMetadata).mockResolvedValue(
      new Map([
        [
          steamGameRow.appId,
          picsAppData({
            capsulePath: "abc/library_capsule.jpg",
            reviewScore: 9,
          }),
        ],
      ]),
    );

    const result = await updatePicsMetadata();

    expect(result.appIdsWithChangedArt).toEqual([]);
    expect((await storedRow(steamGameRow.appId))?.reviewScore).toBe(9);
  });

  it("leaves an existing row untouched when the app is absent from PICS", async () => {
    const steamGameRow = createSteamGame();
    const fetchedAt = new Date("2020-01-01T00:00:00.000Z");
    db.insert(steamPicsMetadata)
      .values({
        appId: steamGameRow.appId,
        fetchedAt,
        capsulePath: "abc/library_capsule.jpg",
      })
      .run();
    vi.mocked(getPicsMetadata).mockResolvedValue(new Map());

    const result = await updatePicsMetadata();

    expect(result.appIdsWithChangedArt).toEqual([]);
    const row = await storedRow(steamGameRow.appId);
    expect(row?.capsulePath).toBe("abc/library_capsule.jpg");
    expect(row?.fetchedAt).toEqual(fetchedAt);
  });

  it("upserts the tag list", async () => {
    vi.mocked(getTagList).mockResolvedValue([
      { tagid: 492, name: "Indie" },
      { tagid: 19, name: "Action" },
    ]);
    db.insert(steamTag).values({ tagId: 492, name: "Stale" }).run();

    const result = await updatePicsMetadata();

    expect(result.tagCount).toBe(2);
    const tags = db.select().from(steamTag).all();
    expect(
      Object.fromEntries(tags.map((tag) => [tag.tagId, tag.name])),
    ).toEqual({ 492: "Indie", 19: "Action" });
  });
});
