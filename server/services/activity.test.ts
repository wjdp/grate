import { beforeEach, describe, expect, it } from "vitest";
import type { PlayDaySettings } from "#shared/playDay";
import { db } from "~~/server/database/client";
import {
  epicGamePlaytime as epicGamePlaytimeTable,
  gogGamePlaytime as gogGamePlaytimeTable,
  steamGamePlaytime as steamGamePlaytimeTable,
  user,
} from "~~/server/database/schema";
import { getDailyPlaytime } from "~~/server/services/activity";
import { flushDb } from "~~/test/db";
import {
  createEpicGame,
  createGame,
  createGogGame,
  createPlaytimeCorrection,
  createSteamGame,
} from "~~/test/fixtures/game";

async function playDays(year: number, settings?: PlayDaySettings) {
  return (await getDailyPlaytime(year, settings)).days;
}

async function imprecise(year: number) {
  return (await getDailyPlaytime(year)).imprecise;
}

function recordSteam(appId: number, timestampEnd: string, minutes: number) {
  db.insert(steamGamePlaytimeTable)
    .values({
      steamAppId: appId,
      timestampEnd: new Date(timestampEnd),
      playtimeForever: minutes,
    })
    .run();
}

function recordAnchoredSteam(
  appId: number,
  timestampEnd: string,
  minutes: number,
  lastPlayed: string,
) {
  db.insert(steamGamePlaytimeTable)
    .values({
      steamAppId: appId,
      timestampEnd: new Date(timestampEnd),
      playtimeForever: minutes,
      rTimeLastPlayed: Math.floor(new Date(lastPlayed).getTime() / 1000),
      playtimeDisconnected: 0,
    })
    .run();
}

function recordGog(gogId: number, timestampEnd: string, minutes: number) {
  return db
    .insert(gogGamePlaytimeTable)
    .values({
      gogId,
      timestampEnd: new Date(timestampEnd),
      playtimeMinutes: minutes,
    })
    .returning()
    .get();
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
    expect(await playDays(2025)).toStrictEqual([]);
  });

  it("attributes the delta between two snapshots to the later day", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2025-03-01T12:00:00.000Z", 100);
    recordSteam(steamGame.appId, "2025-03-02T12:00:00.000Z", 160);
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-03-02", minutes: 60 },
    ]);
  });

  it("ignores the first snapshot of a row", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2025-03-01T12:00:00.000Z", 500);
    expect(await playDays(2025)).toStrictEqual([]);
  });

  it("sums deltas from different providers on the same day", async () => {
    const gogGame = createGogGame();
    const epicGame = createEpicGame();
    recordGog(gogGame.gogId, "2025-04-09T12:00:00.000Z", 10);
    recordGog(gogGame.gogId, "2025-04-10T12:00:00.000Z", 40);
    recordEpic(epicGame.epicId, "2025-04-09T12:00:00.000Z", 0);
    recordEpic(epicGame.epicId, "2025-04-10T12:00:00.000Z", 25);
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-04-10", minutes: 55 },
    ]);
  });

  it("ignores negative deltas", async () => {
    const gogGame = createGogGame();
    recordGog(gogGame.gogId, "2025-05-01T12:00:00.000Z", 200);
    recordGog(gogGame.gogId, "2025-05-02T12:00:00.000Z", 50);
    recordGog(gogGame.gogId, "2025-05-03T12:00:00.000Z", 80);
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-05-03", minutes: 30 },
    ]);
  });

  it("attributes an early-hours session to the previous play day", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2025-03-01T22:00:00.000Z", 100);
    recordSteam(steamGame.appId, "2025-03-02T01:00:00.000Z", 190);
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-03-01", minutes: 90 },
    ]);
  });

  it("respects a supplied day boundary and zone", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2025-03-01T22:00:00.000Z", 100);
    recordSteam(steamGame.appId, "2025-03-02T01:00:00.000Z", 190);
    expect(
      await playDays(2025, { timezone: "UTC", dayBoundaryHour: 0 }),
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
    expect(await playDays(2025)).toStrictEqual([
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
    expect(await playDays(2025)).toStrictEqual([]);
  });

  it("filters to the requested year", async () => {
    const steamGame = createSteamGame();
    recordSteam(steamGame.appId, "2024-12-30T12:00:00.000Z", 0);
    recordSteam(steamGame.appId, "2024-12-31T12:00:00.000Z", 15);
    recordSteam(steamGame.appId, "2025-01-02T12:00:00.000Z", 45);
    expect(await playDays(2024)).toStrictEqual([
      { date: "2024-12-31", minutes: 15 },
    ]);
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-01-02", minutes: 30 },
    ]);
  });

  it("merges a contiguous run of anchored steam deltas onto its play day", async () => {
    const steamGame = createSteamGame();
    recordAnchoredSteam(
      steamGame.appId,
      "2025-08-01T10:00:00.000Z",
      0,
      "2025-07-20T10:00:00.000Z",
    );
    recordAnchoredSteam(
      steamGame.appId,
      "2025-08-01T11:00:00.000Z",
      60,
      "2025-08-01T11:00:00.000Z",
    );
    recordAnchoredSteam(
      steamGame.appId,
      "2025-08-01T12:00:00.000Z",
      120,
      "2025-08-01T12:00:00.000Z",
    );
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-08-01", minutes: 120 },
    ]);
  });

  it("moves an exactly corrected delta from the observation day to the play day", async () => {
    const gogGame = createGogGame();
    recordGog(gogGame.gogId, "2025-04-01T12:00:00.000Z", 10);
    const observed = recordGog(gogGame.gogId, "2025-04-10T12:00:00.000Z", 100);
    createPlaytimeCorrection({
      provider: "gog",
      providerId: gogGame.gogId,
      snapshotId: observed.id,
      minutes: 90,
      playedFrom: "2025-04-05T20:00",
      playedTo: "2025-04-05T22:00",
    });
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-04-05", minutes: 90 },
    ]);
  });

  it("splits a corrected delta into its corrections and their residual", async () => {
    const gogGame = createGogGame();
    recordGog(gogGame.gogId, "2025-04-01T12:00:00.000Z", 10);
    const observed = recordGog(gogGame.gogId, "2025-04-10T12:00:00.000Z", 100);
    createPlaytimeCorrection({
      provider: "gog",
      providerId: gogGame.gogId,
      snapshotId: observed.id,
      minutes: 50,
      playedFrom: "2025-04-05T20:00",
      playedTo: "2025-04-05T22:00",
    });
    createPlaytimeCorrection({
      provider: "gog",
      providerId: gogGame.gogId,
      snapshotId: observed.id,
      minutes: 20,
      playedFrom: "2025-04-06T20:00",
      playedTo: "2025-04-06T20:20",
    });
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-04-05", minutes: 50 },
      { date: "2025-04-06", minutes: 20 },
      { date: "2025-04-10", minutes: 20 },
    ]);
  });

  it("buckets a month-precision baseline correction to the month, never a day", async () => {
    const gogGame = createGogGame({ name: "Quantum Break" });
    const baseline = recordGog(gogGame.gogId, "2020-10-30T12:00:00.000Z", 1053);
    createPlaytimeCorrection({
      provider: "gog",
      providerId: gogGame.gogId,
      snapshotId: baseline.id,
      minutes: 600,
      playedFrom: "2020-10",
      playedTo: "2020-10",
    });
    expect(await playDays(2020)).toStrictEqual([]);
    expect(await imprecise(2020)).toStrictEqual({
      months: [{ month: "2020-10", minutes: 600 }],
      yearOnly: 0,
    });
  });

  it("buckets a baseline correction spanning months to the year", async () => {
    const gogGame = createGogGame({ name: "Quantum Break" });
    const baseline = recordGog(gogGame.gogId, "2020-12-30T12:00:00.000Z", 1053);
    createPlaytimeCorrection({
      provider: "gog",
      providerId: gogGame.gogId,
      snapshotId: baseline.id,
      minutes: 400,
      playedFrom: "2020-09",
      playedTo: "2020-11",
    });
    expect(await playDays(2020)).toStrictEqual([]);
    expect(await imprecise(2020)).toStrictEqual({ months: [], yearOnly: 400 });
  });

  it("counts a manual session the store never reported", async () => {
    const gogGame = createGogGame({ name: "Cyberpunk 2077" });
    createPlaytimeCorrection({
      provider: "gog",
      providerId: gogGame.gogId,
      snapshotId: null,
      minutes: 75,
      playedFrom: "2025-09-02T19:00",
      playedTo: "2025-09-02T20:15",
    });
    expect(await playDays(2025)).toStrictEqual([
      { date: "2025-09-02", minutes: 75 },
    ]);
  });

  it("excludes corrections belonging to hidden games", async () => {
    const hidden = createGame({ name: "Wallpaper Engine", hidden: true });
    const hiddenGogGame = createGogGame({ gameId: hidden.id });
    createPlaytimeCorrection({
      provider: "gog",
      providerId: hiddenGogGame.gogId,
      snapshotId: null,
      minutes: 75,
      playedFrom: "2025-09-02T19:00",
      playedTo: "2025-09-02T20:15",
    });
    createPlaytimeCorrection({
      provider: "gog",
      providerId: hiddenGogGame.gogId,
      snapshotId: null,
      minutes: 30,
      playedFrom: "2025-10",
      playedTo: "2025-10",
    });
    expect(await playDays(2025)).toStrictEqual([]);
    expect(await imprecise(2025)).toStrictEqual({ months: [], yearOnly: 0 });
  });
});
