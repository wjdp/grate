import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { $fetch, fetch, setup } from "@nuxt/test-utils/e2e";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "~~/server/database/client";
import { runMigrations } from "~~/server/database/migrate";
import { game, gogGame } from "~~/server/database/schema";
import {
  createTestDatabaseFile,
  createTestDataDir,
  startNuxtServer,
} from "./devServer";

const databaseFile = createTestDatabaseFile();
const { sqlite, db } = createDb(databaseFile);
runMigrations(sqlite, db);

const seededGame = db
  .insert(game)
  .values({ name: "Seeded Game" })
  .returning()
  .get();

// Every art URL column is null, so the route has nothing to fetch.
const artlessGogGame = db
  .insert(gogGame)
  .values({
    gameId: seededGame.id,
    name: "Seeded Game",
    tags: [],
    properties: {},
  })
  .returning()
  .get();

const dataDir = createTestDataDir();

const server = await startNuxtServer(databaseFile, dataDir);
afterAll(() => server.stop());

await setup({ host: server.host });

describe("GET /health", () => {
  it("returns ok with the database check", async () => {
    const body = await $fetch("/health");
    expect(body).toMatchObject({ ok: true, checks: { database: true } });
  });
});

// These tests only exercise paths that either serve a seeded file or 404
// before any CDN fetch; nothing here touches the network.
describe("GET /art/:provider/:id/:type", () => {
  it("400s for a non-numeric id", async () => {
    const response = await fetch("/art/steam/not-a-number/header");
    expect(response.status).toBe(400);
  });

  it("400s for an unknown provider", async () => {
    const response = await fetch("/art/nintendo/123/header");
    expect(response.status).toBe(400);
  });

  it("400s for an unknown type", async () => {
    const response = await fetch("/art/steam/123/not-a-type");
    expect(response.status).toBe(400);
  });

  it("400s for a type belonging to another provider", async () => {
    const response = await fetch("/art/gog/123/backgroundV6B");
    expect(response.status).toBe(400);
  });

  it("404s for a steam icon with no game row", async () => {
    const response = await fetch("/art/steam/999999/icon");
    expect(response.status).toBe(404);
  });

  it("404s for an unknown gog id", async () => {
    const response = await fetch("/art/gog/999999/poster");
    expect(response.status).toBe(404);
  });

  it("400s for a numeric epic id, which is no longer the art key", async () => {
    const response = await fetch("/art/epic/999999/poster");
    expect(response.status).toBe(400);
  });

  it("400s for a traversal-shaped epic id", async () => {
    const response = await fetch("/art/epic/..%2F..%2Fetc%2Fpasswd/poster");
    expect(response.status).toBe(400);
  });

  it("404s for an unknown epic catalogue item id", async () => {
    const response = await fetch(
      "/art/epic/0123456789abcdef0123456789abcdef/poster",
    );
    expect(response.status).toBe(404);
  });

  it("404s for a gog game with no art url", async () => {
    const response = await fetch(`/art/gog/${artlessGogGame.gogId}/poster`);
    expect(response.status).toBe(404);
  });

  it("lets browsers briefly cache a 404 so misses are not re-requested per render", async () => {
    const response = await fetch(`/art/gog/${artlessGogGame.gogId}/hero`);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("200s with the file bytes when a file is cached", async () => {
    const appId = 42;
    const artDir = join(dataDir, "art", "steam", String(appId));
    mkdirSync(artDir, { recursive: true });
    const dummyJpg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    writeFileSync(join(artDir, "header.jpg"), dummyJpg);

    const response = await fetch(`/art/steam/${appId}/header`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(dummyJpg)).toBe(true);
  });

  it("400s for a width outside the variant whitelist", async () => {
    const response = await fetch("/art/steam/42/header?w=123");
    expect(response.status).toBe(400);
  });

  it("304s when the client sends back the etag", async () => {
    const appId = 43;
    const artDir = join(dataDir, "art", "steam", String(appId));
    mkdirSync(artDir, { recursive: true });
    writeFileSync(join(artDir, "header.jpg"), Buffer.from([0xff, 0xd8]));

    const first = await fetch(`/art/steam/${appId}/header`);
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();

    const second = await fetch(`/art/steam/${appId}/header`, {
      headers: { "if-none-match": etag as string },
    });
    expect(second.status).toBe(304);
  });

  it("serves a resized webp variant of a cached original", async () => {
    const appId = 44;
    const artDir = join(dataDir, "art", "steam", String(appId));
    mkdirSync(artDir, { recursive: true });
    writeFileSync(
      join(artDir, "header.jpg"),
      await sharp({
        create: {
          width: 600,
          height: 800,
          channels: 3,
          background: { r: 1, g: 2, b: 3 },
        },
      })
        .jpeg()
        .toBuffer(),
    );

    const response = await fetch(`/art/steam/${appId}/header?w=240`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    const metadata = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(240);
  });
});
