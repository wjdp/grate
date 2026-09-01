process.env.TZ = "UTC";

import { describe, expect, it } from "vitest";
import type { PlaytimeSessionJson } from "#shared/types/PlaytimeSession";
import {
  formatObservationWindow,
  formatSessionDay,
  formatSessionDuration,
  formatSessionWindow,
  isLowConfidence,
} from "./formatSessionWindow";

const now = new Date("2026-09-01T12:00:00.000Z");

const makeSession = (
  overrides: Partial<PlaytimeSessionJson> = {},
): PlaytimeSessionJson => ({
  provider: "gog",
  providerId: 1423049311,
  providerName: "Cyberpunk 2077",
  minutes: 70,
  endedAfter: "2026-08-31T20:39:20.000Z",
  endedBefore: "2026-08-31T20:43:46.000Z",
  estimatedStart: "2026-08-31T19:33:46.000Z",
  estimatedEnd: "2026-08-31T20:43:46.000Z",
  uncertaintyMinutes: 70,
  anchored: false,
  playDay: "2026-08-31",
  ...overrides,
});

describe("formatSessionDuration", () => {
  it("marks an unanchored duration as approximate", () => {
    expect(formatSessionDuration(makeSession())).toBe("~1h 10m");
  });

  it("states an anchored duration exactly", () => {
    expect(formatSessionDuration(makeSession({ anchored: true }))).toBe(
      "1h 10m",
    );
  });
});

describe("formatSessionWindow", () => {
  it("gives an anchored session as a same-day time range", () => {
    expect(
      formatSessionWindow(
        makeSession({
          anchored: true,
          provider: "steam",
          estimatedStart: "2026-07-11T18:53:00.000Z",
          estimatedEnd: "2026-07-11T20:11:00.000Z",
        }),
        now,
      ),
    ).toBe("11 Jul 18:53 – 20:11");
  });

  it("dates both ends of an anchored session crossing midnight", () => {
    expect(
      formatSessionWindow(
        makeSession({
          anchored: true,
          provider: "steam",
          estimatedStart: "2026-07-11T23:20:00.000Z",
          estimatedEnd: "2026-07-12T01:05:00.000Z",
        }),
        now,
      ),
    ).toBe("11 Jul 23:20 – 12 Jul 01:05");
  });

  it("rounds a near-exact window to its midpoint", () => {
    expect(formatSessionWindow(makeSession(), now)).toBe(
      "ended around 31 Aug 20:41",
    );
  });

  it("gives both bounds for a same-day window under a day", () => {
    expect(
      formatSessionWindow(
        makeSession({
          endedAfter: "2026-08-31T19:39:00.000Z",
          endedBefore: "2026-08-31T20:44:00.000Z",
        }),
        now,
      ),
    ).toBe("ended between 19:39 and 20:44 on 31 Aug");
  });

  it("dates both bounds when a sub-day window crosses midnight", () => {
    expect(
      formatSessionWindow(
        makeSession({
          endedAfter: "2026-08-30T23:50:00.000Z",
          endedBefore: "2026-08-31T00:50:00.000Z",
        }),
        now,
      ),
    ).toBe("ended between 30 Aug 23:50 and 31 Aug 00:50");
  });

  it("degrades to a date range for a window wider than a day", () => {
    expect(
      formatSessionWindow(
        makeSession({
          endedAfter: "2026-08-30T10:00:00.000Z",
          endedBefore: "2026-09-02T10:00:00.000Z",
        }),
        now,
      ),
    ).toBe("sometime between 30 Aug and 2 Sept");
  });

  it("adds the year outside the current one", () => {
    expect(
      formatSessionWindow(
        makeSession({
          anchored: true,
          estimatedStart: "2024-08-31T20:39:00.000Z",
          estimatedEnd: "2024-08-31T21:49:00.000Z",
        }),
        now,
      ),
    ).toBe("31 Aug 2024 20:39 – 21:49");
  });
});

describe("isLowConfidence", () => {
  it("trusts an anchored session", () => {
    expect(isLowConfidence(makeSession({ anchored: true }))).toBe(false);
  });

  it("trusts a tight window around a comparable delta", () => {
    expect(isLowConfidence(makeSession())).toBe(false);
  });

  it("distrusts an uncertainty far wider than the session", () => {
    expect(
      isLowConfidence(makeSession({ minutes: 10, uncertaintyMinutes: 70 })),
    ).toBe(true);
  });

  it("distrusts a window wider than a day", () => {
    expect(
      isLowConfidence(
        makeSession({
          minutes: 4000,
          uncertaintyMinutes: 4320,
          endedAfter: "2026-08-29T10:00:00.000Z",
          endedBefore: "2026-09-01T10:00:00.000Z",
        }),
      ),
    ).toBe(true);
  });
});

describe("formatObservationWindow", () => {
  it("explains the observation window", () => {
    expect(formatObservationWindow(makeSession(), now)).toBe(
      "Observed between 31 Aug 20:39 and 31 Aug 20:43; the store only reports totals, so the exact time is unknown.",
    );
  });
});

describe("formatSessionDay", () => {
  it("names the play day", () => {
    expect(formatSessionDay("2026-08-31", now)).toBe("Monday 31 August");
  });

  it("adds the year outside the current one", () => {
    expect(formatSessionDay("2024-08-31", now)).toBe(
      "Saturday, 31 August 2024",
    );
  });
});
