import { afterAll, describe, expect, it } from "vitest";
import { $fetch, fetch, setup } from "@nuxt/test-utils/e2e";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "~~/db/migrate";
import { createDb } from "~~/lib/db";
import { game, gogGame } from "~~/db/schema";
import {
  createTestDataDir,
  createTestDatabaseFile,
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

  it("404s for an unknown epic id", async () => {
    const response = await fetch("/art/epic/999999/poster");
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
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(dummyJpg)).toBe(true);
  });
});
