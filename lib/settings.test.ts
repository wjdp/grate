import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_BOUNDARY_HOUR,
  getPlayDaySettings,
  getSettings,
  serverTimezone,
  updateSettings,
} from "~~/lib/settings";
import { db } from "~~/server/database/client";
import { user } from "~~/server/database/schema";
import { flushDb } from "~~/test/db";

const originalTz = process.env.TZ;

describe("settings", () => {
  beforeEach(() => {
    flushDb();
    process.env.TZ = "Europe/London";
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("falls back to UTC when TZ is unset", () => {
    delete process.env.TZ;
    expect(serverTimezone()).toBe("UTC");
  });

  it("falls back to UTC when TZ is not a zone name", () => {
    process.env.TZ = "Nowhere/Fictional";
    expect(serverTimezone()).toBe("UTC");
  });

  it("uses the server timezone when there is no user", async () => {
    expect(await getPlayDaySettings()).toStrictEqual({
      timezone: "Europe/London",
      dayBoundaryHour: DEFAULT_DAY_BOUNDARY_HOUR,
    });
  });

  it("prefers the user override over the server timezone", async () => {
    db.insert(user)
      .values({ timezone: "Asia/Tokyo", dayBoundaryHour: 4 })
      .run();
    expect(await getPlayDaySettings()).toStrictEqual({
      timezone: "Asia/Tokyo",
      dayBoundaryHour: 4,
    });
  });

  it("reports both the override and the effective timezone", async () => {
    db.insert(user).values({}).run();
    expect(await getSettings()).toStrictEqual({
      timezone: null,
      dayBoundaryHour: DEFAULT_DAY_BOUNDARY_HOUR,
      serverTimezone: "Europe/London",
      effectiveTimezone: "Europe/London",
    });
  });

  it("creates a user row when updating without one", async () => {
    const settings = await updateSettings({
      timezone: "Asia/Tokyo",
      dayBoundaryHour: 3,
    });
    expect(settings).toStrictEqual({
      timezone: "Asia/Tokyo",
      dayBoundaryHour: 3,
      serverTimezone: "Europe/London",
      effectiveTimezone: "Asia/Tokyo",
    });
    expect(db.select().from(user).all()).toHaveLength(1);
  });

  it("leaves omitted fields untouched", async () => {
    await updateSettings({ timezone: "Asia/Tokyo", dayBoundaryHour: 3 });
    expect(await updateSettings({ dayBoundaryHour: 7 })).toMatchObject({
      timezone: "Asia/Tokyo",
      dayBoundaryHour: 7,
    });
  });

  it("clears the override when timezone is null", async () => {
    await updateSettings({ timezone: "Asia/Tokyo" });
    expect(await updateSettings({ timezone: null })).toMatchObject({
      timezone: null,
      effectiveTimezone: "Europe/London",
    });
  });

  it("rejects an unknown timezone", async () => {
    await expect(
      updateSettings({ timezone: "Nowhere/Fictional" }),
    ).rejects.toThrow(/Unknown timezone/);
  });
});
