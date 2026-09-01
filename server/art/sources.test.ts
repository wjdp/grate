import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { steamAppInfo, steamGame, steamPicsMetadata } from "~~/db/schema";
import { db } from "~~/lib/db";
import { createSteamGame } from "~~/lib/fixtures/game";
import { flushDb } from "~~/test/db";
import { resolveArtSources } from "./sources";

const PICS_BASE_URL =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

function createPicsMetadata(
  appId: number,
  overrides: Partial<typeof steamPicsMetadata.$inferInsert> = {},
) {
  // steamPicsMetadata.appId references SteamGame, FK-enforced.
  createSteamGame({ appId });
  return db
    .insert(steamPicsMetadata)
    .values({ appId, fetchedAt: new Date(), ...overrides })
    .returning()
    .get();
}

function createAppInfo(appId: number, backgroundRaw: string) {
  // steamAppInfo.appId references SteamGame, FK-enforced; a PICS fixture may
  // already have created the parent row.
  const existing = db
    .select()
    .from(steamGame)
    .where(eq(steamGame.appId, appId))
    .get();
  if (!existing) {
    createSteamGame({ appId });
  }
  return db
    .insert(steamAppInfo)
    .values({
      appId,
      fetchedAt: new Date(),
      type: "game",
      name: "Test Game",
      isFree: false,
      detailedDescription: "detailed",
      aboutTheGame: "about",
      shortDescription: "short",
      headerImage: "header.jpg",
      capsuleImage: "capsule.jpg",
      capsuleImagev5: "capsulev5.jpg",
      developers: [],
      publishers: [],
      platformWindows: true,
      platformMac: false,
      platformLinux: false,
      categories: [],
      genres: [],
      screenshots: [],
      background: "background.jpg",
      backgroundRaw,
    })
    .returning()
    .get();
}

describe("resolveArtSources for steam", () => {
  beforeEach(async () => {
    await flushDb();
  });

  describe("without a PICS row", () => {
    it("falls back from 2x library art to 1x to the header capsule for poster", async () => {
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "poster",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900_2x.jpg",
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900.jpg",
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/header.jpg",
      ]);
    });

    it("offers a single candidate for other convention-derived types", async () => {
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "hero",
      });
      expect(candidates).toEqual([
        {
          url: "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_hero.jpg",
        },
      ]);
    });

    it("resolves background types from the legacy URL only", async () => {
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "background",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/page_bg_generated.jpg",
      ]);
    });

    it("falls back to nothing for icon when the SteamGame row is missing", async () => {
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "icon",
      });
      expect(candidates).toEqual([]);
    });
  });

  describe("with a PICS row", () => {
    it("orders poster candidates: capsule2x, capsule, then the legacy chain", async () => {
      createPicsMetadata(201870, {
        capsulePath: "abc123/library_capsule.jpg",
        capsule2xPath: "abc123/library_capsule_2x.jpg",
      });
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "poster",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        `${PICS_BASE_URL}/201870/abc123/library_capsule_2x.jpg`,
        `${PICS_BASE_URL}/201870/abc123/library_capsule.jpg`,
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900_2x.jpg",
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900.jpg",
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/header.jpg",
      ]);
    });

    it("skips null PICS paths and falls through to the legacy chain", async () => {
      createPicsMetadata(201870);
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "poster",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900_2x.jpg",
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900.jpg",
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/header.jpg",
      ]);
    });

    it("orders posterSmall candidates: capsule, then legacy posterSmall", async () => {
      createPicsMetadata(201870, { capsulePath: "abc123/library_capsule.jpg" });
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "posterSmall",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        `${PICS_BASE_URL}/201870/abc123/library_capsule.jpg`,
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900.jpg",
      ]);
    });

    it("orders hero candidates: hero2x, hero, then legacy hero", async () => {
      createPicsMetadata(201870, {
        heroPath: "abc123/library_hero.jpg",
        hero2xPath: "abc123/library_hero_2x.jpg",
      });
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "hero",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        `${PICS_BASE_URL}/201870/abc123/library_hero_2x.jpg`,
        `${PICS_BASE_URL}/201870/abc123/library_hero.jpg`,
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_hero.jpg",
      ]);
    });

    it("orders logo candidates: logo2x, logo, then legacy logo", async () => {
      createPicsMetadata(201870, {
        logoPath: "abc123/logo.png",
        logo2xPath: "abc123/logo_2x.png",
      });
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "logo",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        `${PICS_BASE_URL}/201870/abc123/logo_2x.png`,
        `${PICS_BASE_URL}/201870/abc123/logo.png`,
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/logo.png",
      ]);
    });

    it("orders header candidates: headerPath, then legacy header", async () => {
      createPicsMetadata(201870, { headerPath: "abc123/header.jpg" });
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "header",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        `${PICS_BASE_URL}/201870/abc123/header.jpg`,
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/header.jpg",
      ]);
    });

    it("appends stored paths verbatim without altering them", async () => {
      createPicsMetadata(201870, {
        headerPath: "9f/e2../weird path with spaces?.jpg",
      });
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "header",
      });
      expect(candidates[0]?.url).toBe(
        `${PICS_BASE_URL}/201870/9f/e2../weird path with spaces?.jpg`,
      );
    });

    it("does not affect background types, which have no PICS equivalent", async () => {
      createPicsMetadata(201870, { headerPath: "abc123/header.jpg" });
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "background",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        "https://steamcdn-a.akamaihd.net/steam/apps/201870/page_bg_generated.jpg",
      ]);
    });

    it("dedupes icon candidates when imgIconUrl and iconHash match", async () => {
      const steam = createSteamGame({ appId: 201870, imgIconUrl: "samehash" });
      db.insert(steamPicsMetadata)
        .values({
          appId: steam.appId,
          fetchedAt: new Date(),
          iconHash: "samehash",
        })
        .run();
      const candidates = await resolveArtSources({
        provider: "steam",
        id: steam.appId,
        type: "icon",
      });
      expect(candidates).toEqual([
        {
          url: "http://media.steampowered.com/steamcommunity/public/images/apps/201870/samehash.jpg",
        },
      ]);
    });

    it("falls back to iconHash when imgIconUrl is empty", async () => {
      const steam = createSteamGame({ appId: 201870, imgIconUrl: "" });
      db.insert(steamPicsMetadata)
        .values({
          appId: steam.appId,
          fetchedAt: new Date(),
          iconHash: "fallbackhash",
        })
        .run();
      const candidates = await resolveArtSources({
        provider: "steam",
        id: steam.appId,
        type: "icon",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        "http://media.steampowered.com/steamcommunity/public/images/apps/201870/fallbackhash.jpg",
      ]);
    });

    it("keeps imgIconUrl primary ahead of a differing iconHash", async () => {
      const steam = createSteamGame({ appId: 201870, imgIconUrl: "primary" });
      db.insert(steamPicsMetadata)
        .values({
          appId: steam.appId,
          fetchedAt: new Date(),
          iconHash: "secondary",
        })
        .run();
      const candidates = await resolveArtSources({
        provider: "steam",
        id: steam.appId,
        type: "icon",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        "http://media.steampowered.com/steamcommunity/public/images/apps/201870/primary.jpg",
        "http://media.steampowered.com/steamcommunity/public/images/apps/201870/secondary.jpg",
      ]);
    });
  });
  describe("backdrop", () => {
    const LEGACY_HERO =
      "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_hero.jpg";
    const LEGACY_BACKGROUND =
      "https://steamcdn-a.akamaihd.net/steam/apps/201870/page_bg_generated.jpg";
    const LEGACY_BACKGROUND_V6B =
      "https://steamcdn-a.akamaihd.net/steam/apps/201870/page_bg_generated_v6b.jpg";
    const BACKGROUND_RAW =
      "https://steamcdn-a.akamaihd.net/steam/apps/201870/page.bg.raw.jpg";

    it("orders candidates: pics hero, legacy hero, backgroundRaw, then the page backgrounds", async () => {
      createPicsMetadata(201870, { heroPath: "abc123/library_hero.jpg" });
      createAppInfo(201870, BACKGROUND_RAW);
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "backdrop",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        `${PICS_BASE_URL}/201870/abc123/library_hero.jpg`,
        LEGACY_HERO,
        BACKGROUND_RAW,
        LEGACY_BACKGROUND,
        LEGACY_BACKGROUND_V6B,
      ]);
    });

    it("falls back to the legacy chain without a PICS row or app info", async () => {
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "backdrop",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        LEGACY_HERO,
        LEGACY_BACKGROUND,
        LEGACY_BACKGROUND_V6B,
      ]);
    });

    it("omits an empty backgroundRaw", async () => {
      createAppInfo(201870, "");
      const candidates = await resolveArtSources({
        provider: "steam",
        id: 201870,
        type: "backdrop",
      });
      expect(candidates.map((candidate) => candidate.url)).toEqual([
        LEGACY_HERO,
        LEGACY_BACKGROUND,
        LEGACY_BACKGROUND_V6B,
      ]);
    });
  });
});
