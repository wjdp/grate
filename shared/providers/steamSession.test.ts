import { describe, expect, it } from "vitest";
import { steamSessionState } from "./steamSession";

const now = new Date("2026-09-02T12:00:00Z");

describe("steamSessionState", () => {
  it("is removed when there is no session", () => {
    expect(steamSessionState(null, now)).toBe("removed");
  });

  it("is expired when the session has already passed", () => {
    expect(steamSessionState("2026-09-01T12:00:00Z", now)).toBe("expired");
  });

  it("is expiring when within the 14-day warning window", () => {
    expect(steamSessionState("2026-09-10T12:00:00Z", now)).toBe("expiring");
  });

  it("is connected when well beyond the warning window", () => {
    expect(steamSessionState("2026-10-01T12:00:00Z", now)).toBe("connected");
  });
});
