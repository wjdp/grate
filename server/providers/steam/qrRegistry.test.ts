import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelQrLogin,
  getQrLogin,
  resetQrRegistry,
  startQrLogin,
  takeHeldQrLogin,
} from "~~/server/providers/steam/qrRegistry";

const STEAM_ID = "76561198000000001";
const PERSONA_NAME = "Fixture Persona";
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
  getSteamUser: vi.fn(),
  attachSteamWebSession: vi.fn(),
  removeSteamWebSession: vi.fn(),
}));

const api = vi.hoisted(() => ({
  getCommunityProfile: vi.fn(),
}));

vi.mock("steam-session", () => ({
  LoginSession: steamSession.FakeLoginSession,
  EAuthTokenPlatformType: { MobileApp: 2, WebBrowser: 4 },
}));

vi.mock("~~/server/providers/steam/service", () => service);

vi.mock("~~/server/providers/steam/api", () => api);

const { FakeLoginSession } = steamSession;

function session() {
  const latest = FakeLoginSession.latest;
  if (!latest) throw new Error("no session was created");
  return latest;
}

beforeEach(() => {
  resetQrRegistry();
  FakeLoginSession.latest = null;
  service.getSteamUser.mockReset();
  service.getSteamUser.mockResolvedValue(null);
  service.attachSteamWebSession.mockReset();
  service.attachSteamWebSession.mockResolvedValue(undefined);
  api.getCommunityProfile.mockReset();
  api.getCommunityProfile.mockResolvedValue({ steamID: PERSONA_NAME });
});

function scan(
  expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 86400000),
) {
  const refreshToken = jwt(expiresAt);
  session().steamID = { getSteamID64: () => STEAM_ID };
  session().refreshToken = refreshToken;
  session().emit("authenticated");
  return { refreshToken, refreshTokenExpiresAt: expiresAt };
}

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
  it("attaches the web session to an existing account", async () => {
    service.getSteamUser.mockResolvedValue({ steamId: STEAM_ID });
    const { id } = await startQrLogin();
    const { refreshToken, refreshTokenExpiresAt } = scan();

    await vi.waitFor(() =>
      expect(service.attachSteamWebSession).toHaveBeenCalledWith({
        steamId: STEAM_ID,
        refreshToken,
        refreshTokenExpiresAt,
      }),
    );

    expect(getQrLogin(id)).toEqual({
      state: "authenticated",
      qrChallengeUrl: CHALLENGE_URL,
      steamId: STEAM_ID,
      personaName: PERSONA_NAME,
    });
    expect(takeHeldQrLogin(id)).toBeNull();
  });

  it("holds the token when no account exists yet", async () => {
    const { id } = await startQrLogin();
    const { refreshToken, refreshTokenExpiresAt } = scan();

    await vi.waitFor(() => expect(getQrLogin(id)?.state).toBe("authenticated"));

    expect(service.attachSteamWebSession).not.toHaveBeenCalled();
    expect(api.getCommunityProfile).toHaveBeenCalledWith({
      steamId: STEAM_ID,
    });
    const status = getQrLogin(id);
    expect(status).toEqual({
      state: "authenticated",
      qrChallengeUrl: CHALLENGE_URL,
      steamId: STEAM_ID,
      personaName: PERSONA_NAME,
    });
    expect(getQrLogin(id)).not.toBeNull();

    expect(takeHeldQrLogin(id)).toEqual({
      steamId: STEAM_ID,
      refreshToken,
      refreshTokenExpiresAt,
    });
    expect(getQrLogin(id)).toBeNull();
  });

  it("has nothing to take for an unknown or unscanned login", async () => {
    const { id } = await startQrLogin();
    expect(takeHeldQrLogin(id)).toBeNull();
    expect(takeHeldQrLogin("nope")).toBeNull();
  });

  it("surfaces the single-account guard as an error state", async () => {
    service.getSteamUser.mockResolvedValue({ steamId: "76561198000000002" });
    service.attachSteamWebSession.mockRejectedValue(
      new Error("grate only supports a single Steam account"),
    );
    const { id } = await startQrLogin();
    scan();

    await vi.waitFor(() =>
      expect(getQrLogin(id)).toEqual({
        state: "error",
        qrChallengeUrl: CHALLENGE_URL,
        message: "grate only supports a single Steam account",
        steamId: STEAM_ID,
        personaName: PERSONA_NAME,
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

  it("keeps a held token for fifteen minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00Z"));
    const { id } = await startQrLogin();
    scan(new Date("2027-04-01T00:00:00Z"));
    await vi.waitFor(() => expect(getQrLogin(id)?.state).toBe("authenticated"));

    vi.setSystemTime(new Date("2026-09-02T12:14:00Z"));
    expect(getQrLogin(id)?.state).toBe("authenticated");

    vi.setSystemTime(new Date("2026-09-02T12:15:01Z"));
    expect(getQrLogin(id)).toBeNull();
    expect(takeHeldQrLogin(id)).toBeNull();
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
