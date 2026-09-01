import { describe, expect, it } from "vitest";
import { playDayOf } from "./playDay";

const utcSixAm = { timezone: "UTC", dayBoundaryHour: 6 };

describe("playDayOf", () => {
  it("attributes the small hours to the previous day", () => {
    expect(playDayOf(new Date("2026-03-02T01:00:00Z"), utcSixAm)).toBe(
      "2026-03-01",
    );
  });

  it("starts the new day on the boundary hour", () => {
    expect(playDayOf(new Date("2026-03-02T06:00:00Z"), utcSixAm)).toBe(
      "2026-03-02",
    );
  });

  it("keeps the minute before the boundary on the previous day", () => {
    expect(playDayOf(new Date("2026-03-02T05:59:00Z"), utcSixAm)).toBe(
      "2026-03-01",
    );
  });

  it("falls back to the calendar day with a boundary of midnight", () => {
    const settings = { timezone: "UTC", dayBoundaryHour: 0 };
    expect(playDayOf(new Date("2026-03-02T00:00:00Z"), settings)).toBe(
      "2026-03-02",
    );
    expect(playDayOf(new Date("2026-03-02T23:59:00Z"), settings)).toBe(
      "2026-03-02",
    );
  });

  it("buckets in the configured zone, not UTC", () => {
    // 23:30Z in summer is 00:30 the next day in London.
    const instant = new Date("2026-07-01T23:30:00Z");
    expect(
      playDayOf(instant, { timezone: "Europe/London", dayBoundaryHour: 0 }),
    ).toBe("2026-07-02");
    expect(
      playDayOf(instant, { timezone: "Europe/London", dayBoundaryHour: 6 }),
    ).toBe("2026-07-01");
  });

  it("handles the spring-forward transition", () => {
    // Clocks go forward 01:00 -> 02:00 BST on 2026-03-29.
    expect(
      playDayOf(new Date("2026-03-29T05:30:00Z"), {
        timezone: "Europe/London",
        dayBoundaryHour: 6,
      }),
    ).toBe("2026-03-29");
    expect(
      playDayOf(new Date("2026-03-29T04:30:00Z"), {
        timezone: "Europe/London",
        dayBoundaryHour: 6,
      }),
    ).toBe("2026-03-28");
  });

  it("handles the autumn-back transition", () => {
    // Clocks go back 02:00 -> 01:00 GMT on 2026-10-25.
    expect(
      playDayOf(new Date("2026-10-25T06:00:00Z"), {
        timezone: "Europe/London",
        dayBoundaryHour: 6,
      }),
    ).toBe("2026-10-25");
    expect(
      playDayOf(new Date("2026-10-25T05:30:00Z"), {
        timezone: "Europe/London",
        dayBoundaryHour: 6,
      }),
    ).toBe("2026-10-24");
  });
});
