import { describe, it, expect, beforeEach } from "vitest";
import {
  epicGamePlaytime as epicGamePlaytimeTable,
  gogGamePlaytime as gogGamePlaytimeTable,
  steamGamePlaytime as steamGamePlaytimeTable,
} from "~~/db/schema";
import { db } from "~~/lib/db";
import { getDailyPlaytime } from "~~/lib/activity";
import {
  createEpicGame,
  createGogGame,
  createSteamGame,
} from "~~/lib/fixtures/game";
import { flushDb } from "~~/test/db";

function recordSteam(appId: number, timestampEnd: string, minutes: number) {
  db.insert(steamGamePlaytimeTable)
    .values({
      steamAppId: appId,
      timestampEnd: new Date(timestampEnd),
      playtimeForever: minutes,
    })
    .run();
}

function recordGog(gogId: number, timestampEnd: string, minutes: number) {
  db.insert(gogGamePlaytimeTable)
    .values({
      gogId,
      timestampEnd: new Date(timestampEnd),
      playtimeMinutes: minutes,
    })
    .run();
}

function recordEpic(epicId: number, timestampEnd: string, minutes: number) {
  db.insert(epicGamePlaytimeTable)
    .values({
      epicId,
      timestampEnd: new Date(timestampEnd),
      playtimeMinutes: minutes,
    })
    .run();
}

describe("getDailyPlaytime", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("returns an empty list when there are no snapshots", async () => {
    expect(await getDailyPlaytime(2025)).toStrictEqual([]);
  });

  it("attributes the delta between two snapshots to the later day", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2025-03-01T12:00:00.000Z", 100);
    recordSteam(steamGame.appId, "2025-03-02T12:00:00.000Z", 160);
    expect(await getDailyPlaytime(2025)).toStrictEqual([
      { date: "2025-03-02", minutes: 60 },
    ]);
  });

  it("ignores the first snapshot of a row", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2025-03-01T12:00:00.000Z", 500);
    expect(await getDailyPlaytime(2025)).toStrictEqual([]);
  });

  it("sums deltas from different providers on the same day", async () => {
    const gogGame = createGogGame();
    const epicGame = createEpicGame();
    recordGog(gogGame.gogId, "2025-04-09T12:00:00.000Z", 10);
    recordGog(gogGame.gogId, "2025-04-10T12:00:00.000Z", 40);
    recordEpic(epicGame.epicId, "2025-04-09T12:00:00.000Z", 0);
    recordEpic(epicGame.epicId, "2025-04-10T12:00:00.000Z", 25);
    expect(await getDailyPlaytime(2025)).toStrictEqual([
      { date: "2025-04-10", minutes: 55 },
    ]);
  });

  it("ignores negative deltas", async () => {
    const gogGame = createGogGame();
    recordGog(gogGame.gogId, "2025-05-01T12:00:00.000Z", 200);
    recordGog(gogGame.gogId, "2025-05-02T12:00:00.000Z", 50);
    recordGog(gogGame.gogId, "2025-05-03T12:00:00.000Z", 80);
    expect(await getDailyPlaytime(2025)).toStrictEqual([
      { date: "2025-05-03", minutes: 30 },
    ]);
  });

  it("filters to the requested year", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2024-12-30T12:00:00.000Z", 0);
    recordSteam(steamGame.appId, "2024-12-31T12:00:00.000Z", 15);
    recordSteam(steamGame.appId, "2025-01-02T12:00:00.000Z", 45);
    expect(await getDailyPlaytime(2024)).toStrictEqual([
      { date: "2024-12-31", minutes: 15 },
    ]);
    expect(await getDailyPlaytime(2025)).toStrictEqual([
      { date: "2025-01-02", minutes: 30 },
    ]);
  });
});
