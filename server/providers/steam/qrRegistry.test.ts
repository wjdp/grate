import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelQrLogin,
  getQrLogin,
  resetQrRegistry,
  startQrLogin,
} from "~~/server/providers/steam/qrRegistry";

const STEAM_ID = "76561198000000001";
const CHALLENGE_URL = "https://s.team/q/1/first";
const ROTATED_URL = "https://s.team/q/1/second";
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function jwt(expiresAt: Date): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(expiresAt.getTime() / 1000) }),
    "utf8",
  ).toString("base64url");
  return `header.${payload}.signature`;
}

const steamSession = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class FakeLoginSession {
    static latest: FakeLoginSession | null = null;
    _handler = {
      _getPlatformData: () => ({
        deviceDetails: { device_friendly_name: "Galaxy S25" },
      }),
    };
    loginTimeout = 0;
    accessToken = "";
    refreshToken = "";
    steamID = { getSteamID64: () => "" };
    cancelCalls = 0;
    private listeners = new Map<string, Listener[]>();

    constructor() {
      FakeLoginSession.latest = this;
    }

    on(event: string, listener: Listener) {
      const existing = this.listeners.get(event) ?? [];
      this.listeners.set(event, [...existing, listener]);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
    }

    async startWithQR() {
      return { actionRequired: false, qrChallengeUrl: CHALLENGE_URL };
    }

    cancelLoginAttempt() {
      this.cancelCalls += 1;
      return true;
    }
  }

  return { FakeLoginSession };
});

const service = vi.hoisted(() => ({
  linkSteamAccount: vi.fn(),
}));

vi.mock("steam-session", () => ({
  LoginSession: steamSession.FakeLoginSession,
  EAuthTokenPlatformType: { MobileApp: 2 },
}));

vi.mock("~~/server/providers/steam/service", () => ({
  linkSteamAccount: service.linkSteamAccount,
}));

const { FakeLoginSession } = steamSession;

function session() {
  const latest = FakeLoginSession.latest;
  if (!latest) throw new Error("no session was created");
  return latest;
}

beforeEach(() => {
  resetQrRegistry();
  FakeLoginSession.latest = null;
  service.linkSteamAccount.mockReset();
  service.linkSteamAccount.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startQrLogin", () => {
  it("returns the challenge url and a pending state", async () => {
    const { id, qrChallengeUrl } = await startQrLogin();

    expect(qrChallengeUrl).toBe(CHALLENGE_URL);
    expect(session().loginTimeout).toBe(LOGIN_TIMEOUT_MS);
    expect(getQrLogin(id)).toEqual({
      state: "pending",
      qrChallengeUrl: CHALLENGE_URL,
    });
  });

  it("follows the rotated challenge url from the poll response", async () => {
    const { id } = await startQrLogin();

    session().emit("debug", "poll response", { newChallengeUrl: ROTATED_URL });

    expect(getQrLogin(id)?.qrChallengeUrl).toBe(ROTATED_URL);
  });

  it("ignores debug events that carry no new challenge url", async () => {
    const { id } = await startQrLogin();

    session().emit("debug", "poll response", { newClientId: "1" });
    session().emit("debug", "other", { newChallengeUrl: ROTATED_URL });

    expect(getQrLogin(id)?.qrChallengeUrl).toBe(CHALLENGE_URL);
  });
});

describe("authentication", () => {
  it("links the scanned account and reports it once", async () => {
    const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 86400000);
    const refreshToken = jwt(expiresAt);
    const { id } = await startQrLogin();
    session().steamID = { getSteamID64: () => STEAM_ID };
    session().refreshToken = refreshToken;

    session().emit("authenticated");
    await vi.waitFor(() =>
      expect(service.linkSteamAccount).toHaveBeenCalledTimes(1),
    );

    expect(service.linkSteamAccount).toHaveBeenCalledWith({
      steamId: STEAM_ID,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    });
    expect(getQrLogin(id)).toEqual({
      state: "authenticated",
      qrChallengeUrl: CHALLENGE_URL,
    });
    expect(getQrLogin(id)).toBeNull();
  });

  it("surfaces the single-account guard as an error state", async () => {
    service.linkSteamAccount.mockRejectedValue(
      new Error("grate only supports a single Steam account"),
    );
    const { id } = await startQrLogin();
    session().steamID = { getSteamID64: () => STEAM_ID };
    session().refreshToken = jwt(new Date(Date.now() + 86400000));

    session().emit("authenticated");
    await vi.waitFor(() =>
      expect(getQrLogin(id)).toEqual({
        state: "error",
        qrChallengeUrl: CHALLENGE_URL,
        message: "grate only supports a single Steam account",
      }),
    );
  });
});

describe("terminal states", () => {
  it("reports a timeout as expired", async () => {
    const { id } = await startQrLogin();

    session().emit("timeout");

    expect(getQrLogin(id)?.state).toBe("expired");
    expect(getQrLogin(id)).toBeNull();
  });

  it("reports a session error with its message", async () => {
    const { id } = await startQrLogin();

    session().emit("error", new Error("Steam went away"));

    expect(getQrLogin(id)).toEqual({
      state: "error",
      qrChallengeUrl: CHALLENGE_URL,
      message: "Steam went away",
    });
  });
});

describe("cancelQrLogin", () => {
  it("cancels a pending attempt and forgets it", async () => {
    const { id } = await startQrLogin();

    cancelQrLogin(id);

    expect(session().cancelCalls).toBe(1);
    expect(getQrLogin(id)).toBeNull();
  });

  it("does nothing for an unknown id", () => {
    expect(() => cancelQrLogin("nope")).not.toThrow();
  });
});

describe("sweeping", () => {
  it("cancels and drops attempts past the login timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00Z"));
    const { id } = await startQrLogin();

    vi.setSystemTime(new Date("2026-09-02T12:05:31Z"));

    expect(getQrLogin(id)).toBeNull();
    expect(session().cancelCalls).toBe(1);
  });

  it("keeps attempts inside the login timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00Z"));
    const { id } = await startQrLogin();

    vi.setSystemTime(new Date("2026-09-02T12:05:00Z"));

    expect(getQrLogin(id)?.state).toBe("pending");
    expect(session().cancelCalls).toBe(0);
  });
});
