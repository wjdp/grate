import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "~~/db/migrate";
import { game, steamAppInfo, steamGame, steamUser, user } from "~~/db/schema";
import { createDb, type Db } from "~~/lib/db";
import type { Database } from "better-sqlite3";

const STEAM_ID = 76561198032111170n;

describe("custom column types", () => {
  let db: Db;
  let sqlite: Database;

  beforeEach(() => {
    ({ db, sqlite } = createDb(":memory:"));
    runMigrations(sqlite, db);
  });

  function insertGame(lastPlayedAt: Date | null = null) {
    return db
      .insert(game)
      .values({ name: "Fake Game", lastPlayedAt })
      .returning()
      .get();
  }

  describe("datetime", () => {
    it("reads unix milliseconds stored as an integer", () => {
      const { id } = insertGame();
      sqlite
        .prepare(
          `UPDATE "Game" SET "lastPlayedAt" = 1742778002795 WHERE id = ?`,
        )
        .run(id);
      const row = db.select().from(game).where(eq(game.id, id)).get();
      expect(row?.lastPlayedAt).toEqual(new Date(1742778002795));
    });

    it("reads ISO text as written by the gog_playtime backfill", () => {
      const { id } = insertGame();
      sqlite
        .prepare(
          `UPDATE "Game" SET "lastPlayedAt" = '2022-08-24T19:05:27.000Z' WHERE id = ?`,
        )
        .run(id);
      const row = db.select().from(game).where(eq(game.id, id)).get();
      expect(row?.lastPlayedAt?.toISOString()).toBe("2022-08-24T19:05:27.000Z");
    });

    it("reads zone-less CURRENT_TIMESTAMP text as UTC", () => {
      const { id } = insertGame();
      sqlite
        .prepare(
          `UPDATE "Game" SET "lastPlayedAt" = '2022-08-24 19:05:27' WHERE id = ?`,
        )
        .run(id);
      const row = db.select().from(game).where(eq(game.id, id)).get();
      expect(row?.lastPlayedAt?.toISOString()).toBe("2022-08-24T19:05:27.000Z");
    });

    it("writes unix milliseconds as an integer, as Prisma did", () => {
      const written = new Date("2024-01-02T03:04:05.678Z");
      const { id } = insertGame(written);
      const [storageClass, value] = sqlite
        .prepare(
          `SELECT typeof("lastPlayedAt"), "lastPlayedAt" FROM "Game" WHERE id = ?`,
        )
        .raw()
        .get(id) as [string, number | bigint];
      expect(storageClass).toBe("integer");
      expect(Number(value)).toBe(written.getTime());
      const row = db.select().from(game).where(eq(game.id, id)).get();
      expect(row?.lastPlayedAt).toEqual(written);
    });
  });

  describe("json", () => {
    it("round trips arrays and objects through JSONB text", () => {
      const linkedGame = insertGame();
      db.insert(steamGame)
        .values({
          appId: 440n,
          gameId: linkedGame.id,
          name: linkedGame.name,
          imgIconUrl: "icon",
          capsuleFilename: "capsule",
        })
        .run();
      db.insert(steamAppInfo)
        .values({
          appId: 440n,
          fetchedAt: new Date(),
          type: "game",
          name: linkedGame.name,
          isFree: true,
          detailedDescription: "",
          aboutTheGame: "",
          shortDescription: "",
          headerImage: "",
          capsuleImage: "",
          capsuleImagev5: "",
          developers: ["Fake Studio"],
          publishers: ["Fake Publisher"],
          platformWindows: true,
          platformMac: false,
          platformLinux: false,
          categories: [{ id: 1, description: "Multi-player" }],
          genres: [],
          screenshots: [],
          background: "",
          backgroundRaw: "",
        })
        .run();

      const row = db.select().from(steamAppInfo).get();
      expect(row?.developers).toEqual(["Fake Studio"]);
      expect(row?.categories).toEqual([{ id: 1, description: "Multi-player" }]);
      const stored = sqlite
        .prepare(`SELECT "developers" FROM "SteamAppInfo"`)
        .raw()
        .get() as [string];
      expect(stored[0]).toBe('["Fake Studio"]');
    });
  });

  describe("bigint", () => {
    it("round trips a Steam ID beyond Number.MAX_SAFE_INTEGER exactly", () => {
      const owner = db.insert(user).values({}).returning().get();
      const inserted = db
        .insert(steamUser)
        .values({
          steamId: STEAM_ID,
          userId: owner.id,
          personaName: "fake",
          profileUrl: "",
          avatar: "",
          avatarMedium: "",
          avatarFull: "",
          avatarHash: "",
          lastLogoff: 0,
        })
        .returning()
        .get();
      expect(inserted.steamId).toBe(STEAM_ID);

      const row = db
        .select()
        .from(steamUser)
        .where(eq(steamUser.steamId, STEAM_ID))
        .get();
      expect(row?.steamId).toBe(STEAM_ID);
      const [text] = sqlite
        .prepare(`SELECT cast("steamId" as text) FROM "SteamUser"`)
        .raw()
        .get() as [string];
      expect(text).toBe("76561198032111170");
    });
  });

  describe("plain columns", () => {
    it("returns numbers for integer columns and booleans for boolean columns", () => {
      const linkedGame = db
        .insert(game)
        .values({ name: "Fake Game", playtimeMinutes: 123 })
        .returning()
        .get();
      expect(linkedGame.id).toBeTypeOf("number");
      expect(linkedGame.playtimeMinutes).toBe(123);
      expect(linkedGame.playtimeMinutes).toBeTypeOf("number");

      const inserted = db
        .insert(steamGame)
        .values({
          appId: 620n,
          gameId: linkedGame.id,
          name: linkedGame.name,
          imgIconUrl: "icon",
          capsuleFilename: "capsule",
          hasDlc: true,
        })
        .returning()
        .get();
      expect(inserted.hasDlc).toBe(true);
      expect(inserted.hasWorkshop).toBe(false);
      expect(inserted.appInfoState).toBe("NOT_FETCHED");
      expect(inserted.gameId).toBeTypeOf("number");
    });

    it("counts rows as numbers via the raw driver", () => {
      insertGame();
      const [count] = sqlite
        .prepare(`SELECT count(*) FROM "Game"`)
        .raw()
        .get() as [number | bigint];
      expect(Number(count)).toBe(1);
      const rows = db
        .select({ total: sql<number>`count(*)` })
        .from(game)
        .get();
      expect(Number(rows?.total)).toBe(1);
    });
  });
});
