import { describe, it, expect, beforeEach } from "vitest";
import {
  createSteamGame,
  type FakeUserGameOverrides,
  generateFakeUserGame,
} from "~/lib/steam/fixtures/fake";
import { getPlaytimeRecords, recordPlaytime } from "~/lib/steam/service";

import { DateTime } from "luxon";
import { flushDb } from "~/test/db";

const NO_PLAYTIME: FakeUserGameOverrides = {
  playtime_forever: 0,
  playtime_2weeks: 0,
  playtime_windows_forever: 0,
  playtime_mac_forever: 0,
  playtime_linux_forever: 0,
  playtime_deck_forever: 0,
  playtime_disconnected: 0,
};

describe("recordPlaytime", () => {
  beforeEach(() => {
    flushDb();
  });
  it("should record playtime", async () => {
    const steamGame = await createSteamGame();
    const userGame = generateFakeUserGame(steamGame);
    const now = new Date();
    const record = await recordPlaytime(userGame, now);
    expect(record).toBeDefined();
    expect(record.timestampStart).toBeNull();
    expect(record.timestampEnd).toStrictEqual(now);
    expect(record.playtimeForever).toBe(userGame.playtime_forever);
  });
  it("should record and extend zero playtime in single record", async () => {
    const steamGame = await createSteamGame();
    const userGame = generateFakeUserGame(steamGame, NO_PLAYTIME);
    const nowFirst = DateTime.now();
    const nowSecond = nowFirst.plus({ hours: 1 });
    await recordPlaytime(userGame, nowFirst.toJSDate());
    await recordPlaytime(userGame, nowSecond.toJSDate());
    const records = await getPlaytimeRecords(steamGame.appId);
    expect(records).toHaveLength(2);
    const firstRecord = records[0];
    expect(firstRecord.timestampStart).toBeNull();
    expect(firstRecord.timestampEnd).toStrictEqual(nowFirst.toJSDate());
    expect(firstRecord.playtimeForever).toBe(userGame.playtime_forever);
    const secondRecord = records[1];
    expect(secondRecord.timestampStart).toStrictEqual(nowFirst.toJSDate());
    expect(secondRecord.timestampEnd).toStrictEqual(nowSecond.toJSDate());
    expect(secondRecord.playtimeForever).toBe(userGame.playtime_forever);
  });
  it("should record and extend playtime in multiple records", async () => {
    // This test simulates an initial import, followed by two play sessions
    // with a break in between.
    const steamGame = await createSteamGame();
    const userGame1 = generateFakeUserGame(steamGame, { playtime_forever: 10 });
    const nowFirst = DateTime.now();
    await recordPlaytime(userGame1, nowFirst.toJSDate());
    const userGame2 = generateFakeUserGame(steamGame, { playtime_forever: 20 });
    const nowSecond = nowFirst.plus({ hours: 1 });
    await recordPlaytime(userGame2, nowSecond.toJSDate());
    const userGame3 = generateFakeUserGame(steamGame, { playtime_forever: 20 });
    const nowThird = nowSecond.plus({ hours: 1 });
    await recordPlaytime(userGame3, nowThird.toJSDate());
    const userGame4 = generateFakeUserGame(steamGame, { playtime_forever: 30 });
    const nowFourth = nowThird.plus({ hours: 1 });
    await recordPlaytime(userGame4, nowFourth.toJSDate());
    const userGame5 = generateFakeUserGame(steamGame, { playtime_forever: 30 });
    const nowFifth = nowFourth.plus({ hours: 1 });
    await recordPlaytime(userGame5, nowFifth.toJSDate());
    const userGame6 = generateFakeUserGame(steamGame, { playtime_forever: 30 });
    const nowSixth = nowFifth.plus({ hours: 1 });
    await recordPlaytime(userGame6, nowSixth.toJSDate());

    const records = await getPlaytimeRecords(steamGame.appId);
    expect(records).toHaveLength(5);
    const dates = records.map((r) => [r.timestampStart, r.timestampEnd]);
    expect(dates).toStrictEqual([
      [null, nowFirst.toJSDate()],
      [nowFirst.toJSDate(), nowSecond.toJSDate()],
      [nowSecond.toJSDate(), nowThird.toJSDate()],
      [nowThird.toJSDate(), nowFourth.toJSDate()],
      [nowFourth.toJSDate(), nowSixth.toJSDate()],
    ]);
    const playtimes = records.map((r) => r.playtimeForever);
    expect(playtimes).toStrictEqual([10, 20, 20, 30, 30]);
  });
});
