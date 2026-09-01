import { beforeEach, describe, expect, it } from "vitest";
import {
  epicGamePlaytime as epicGamePlaytimeTable,
  gogGamePlaytime as gogGamePlaytimeTable,
  steamGamePlaytime as steamGamePlaytimeTable,
  user,
} from "~~/db/schema";
import { getDailyPlaytime } from "~~/lib/activity";
import { db } from "~~/lib/db";
import {
  createEpicGame,
  createGame,
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
    db.insert(user).values({ timezone: "UTC", dayBoundaryHour: 6 }).run();
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

  it("attributes an early-hours session to the previous play day", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2025-03-01T22:00:00.000Z", 100);
    recordSteam(steamGame.appId, "2025-03-02T01:00:00.000Z", 190);
    expect(await getDailyPlaytime(2025)).toStrictEqual([
      { date: "2025-03-01", minutes: 90 },
    ]);
  });

  it("respects a supplied day boundary and zone", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2025-03-01T22:00:00.000Z", 100);
    recordSteam(steamGame.appId, "2025-03-02T01:00:00.000Z", 190);
    expect(
      await getDailyPlaytime(2025, { timezone: "UTC", dayBoundaryHour: 0 }),
    ).toStrictEqual([{ date: "2025-03-02", minutes: 90 }]);
  });

  it("excludes deltas from hidden games", async () => {
    const hidden = createGame({ name: "Wallpaper Engine", hidden: true });
    const hiddenSteamGame = createSteamGame({ gameId: hidden.id });
    const visibleSteamGame = createSteamGame();
    recordSteam(hiddenSteamGame.appId, "2025-06-01T12:00:00.000Z", 100);
    recordSteam(hiddenSteamGame.appId, "2025-06-02T12:00:00.000Z", 400);
    recordSteam(visibleSteamGame.appId, "2025-06-01T12:00:00.000Z", 10);
    recordSteam(visibleSteamGame.appId, "2025-06-02T12:00:00.000Z", 30);
    expect(await getDailyPlaytime(2025)).toStrictEqual([
      { date: "2025-06-02", minutes: 20 },
    ]);
  });

  it("excludes gog and epic rows belonging to hidden games", async () => {
    const hidden = createGame({ name: "Galaxy", hidden: true });
    const hiddenGogGame = createGogGame({ gameId: hidden.id });
    const hiddenEpicGame = createEpicGame({ gameId: hidden.id });
    recordGog(hiddenGogGame.gogId, "2025-07-01T12:00:00.000Z", 10);
    recordGog(hiddenGogGame.gogId, "2025-07-02T12:00:00.000Z", 40);
    recordEpic(hiddenEpicGame.epicId, "2025-07-01T12:00:00.000Z", 0);
    recordEpic(hiddenEpicGame.epicId, "2025-07-02T12:00:00.000Z", 25);
    expect(await getDailyPlaytime(2025)).toStrictEqual([]);
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
