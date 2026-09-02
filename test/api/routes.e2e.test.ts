import { $fetch, fetch, setup } from "@nuxt/test-utils/e2e";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "~~/server/database/client";
import { runMigrations } from "~~/server/database/migrate";
import { game } from "~~/server/database/schema";
import { createTestDatabaseFile, startNuxtServer } from "./devServer";

const databaseFile = createTestDatabaseFile();
const { sqlite, db } = createDb(databaseFile);
runMigrations(sqlite, db);
const seededGame = db
  .insert(game)
  .values({ name: "Seeded Game" })
  .returning()
  .get();

const server = await startNuxtServer(databaseFile);
afterAll(() => server.stop());

await setup({ host: server.host });

describe("GET /api/games", () => {
  it("lists games with their provider rows", async () => {
    const { games } = await $fetch("/api/games");
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      id: seededGame.id,
      name: "Seeded Game",
      steamGames: [],
      gogGames: [],
      epicGames: [],
    });
  });
});

describe("GET /api/games/:id", () => {
  it("returns the game", async () => {
    const { game } = await $fetch(`/api/games/${seededGame.id}`);
    expect(game).toMatchObject({ id: seededGame.id, name: "Seeded Game" });
  });

  it("404s for an unknown game", async () => {
    const response = await fetch("/api/games/999999");
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/games/:id/state", () => {
  it("sets the state", async () => {
    const { game } = await $fetch(`/api/games/${seededGame.id}/state`, {
      method: "PATCH",
      body: { state: "PLAYING" },
    });
    expect(game.state).toBe("PLAYING");
  });

  it("400s for a state outside the enum", async () => {
    const response = await fetch(`/api/games/${seededGame.id}/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "NOPE" }),
    });
    expect(response.status).toBe(400);
  });
});

describe("GET /api/tasks", () => {
  it("returns the task list", async () => {
    const tasks = await $fetch("/api/tasks");
    expect(Array.isArray(tasks)).toBe(true);
  });
});

describe("POST /api/tasks", () => {
  it("queues a known task", async () => {
    const task = await $fetch("/api/tasks", {
      method: "POST",
      body: { taskName: "sleep" },
    });
    expect(task).toMatchObject({ name: "sleep", state: "pending" });
  });

  it("stores the payload on the queued task", async () => {
    const task = await $fetch("/api/tasks", {
      method: "POST",
      body: { taskName: "sleep", payload: { provider: "gog" } },
    });
    expect(task).toMatchObject({
      name: "sleep",
      payload: { provider: "gog" },
    });
  });

  it("400s for an unknown task", async () => {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskName: "nope" }),
    });
    expect(response.status).toBe(400);
  });
});
