import { afterAll, describe, expect, it } from "vitest";
import { $fetch, fetch, setup } from "@nuxt/test-utils/e2e";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "~~/db/migrate";
import { createDb } from "~~/lib/db";
import {
  createTestDataDir,
  createTestDatabaseFile,
  startNuxtServer,
} from "./devServer";

const databaseFile = createTestDatabaseFile();
const { sqlite, db } = createDb(databaseFile);
runMigrations(sqlite, db);

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

describe("GET /art/steam/:appId/:type", () => {
  it("400s for a non-numeric appId", async () => {
    const response = await fetch("/art/steam/not-a-number/header");
    expect(response.status).toBe(400);
  });

  it("400s for an unknown type", async () => {
    const response = await fetch("/art/steam/123/not-a-type");
    expect(response.status).toBe(400);
  });

  it("404s when there is no cached file", async () => {
    const response = await fetch("/art/steam/999999/header");
    expect(response.status).toBe(404);
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
