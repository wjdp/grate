import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";
import { db } from "~~/server/database/client";
import { steamUser } from "~~/server/database/schema";
import userData from "~~/server/providers/steam/fixtures/userdata.json";
import {
  createSession,
  decodeJwtExpiry,
  getAccessToken,
  getOwnedAppIds,
  getSessionRenewal,
  resetWebSessionState,
  tryRenewRefreshToken,
} from "~~/server/providers/steam/webSession";
import { flushDb } from "~~/test/db";
import { createSteamUser } from "~~/test/fixtures/game";

function jwt(expiresAt: Date): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(expiresAt.getTime() / 1000) }),
    "utf8",
  ).toString("base64url");
  return `header.${payload}.signature`;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const steamSession = vi.hoisted(() => {
  const state: {
    accessToken: string | null;
    refreshError: Error | null;
    renewedRefreshToken: string | null;
    renewResult: boolean;
    renewError: Error | null;
    cookies: string[];
    refreshAccessTokenCalls: number;
    renewCalls: number;
  } = {
    accessToken: null,
    refreshError: null,
    renewedRefreshToken: null,
    renewResult: false,
    renewError: null,
    cookies: ["steamLoginSecure=abc", "sessionid=def"],
    refreshAccessTokenCalls: 0,
    renewCalls: 0,
  };

  class FakeAuthenticationClient {
    _getPlatformData() {
      return { deviceDetails: { device_friendly_name: "Galaxy S25" } };
    }
  }

  class FakeLoginSession {
    _handler = new FakeAuthenticationClient();
    accessToken = "";
    refreshToken = "";

    constructor(public platformType: number) {}

    async refreshAccessToken() {
      state.refreshAccessTokenCalls += 1;
      if (state.refreshError) throw state.refreshError;
      this.accessToken = state.accessToken ?? "";
    }

    async renewRefreshToken() {
      state.renewCalls += 1;
      if (state.renewError) throw state.renewError;
      this.accessToken = state.accessToken ?? "";
      if (state.renewResult && state.renewedRefreshToken) {
        this.refreshToken = state.renewedRefreshToken;
      }
      return state.renewResult;
    }

    async getWebCookies() {
      return state.cookies;
    }
  }

  return { state, FakeLoginSession };
});

vi.mock("steam-session", () => ({
  LoginSession: steamSession.FakeLoginSession,
  EAuthTokenPlatformType: { MobileApp: 2 },
}));

const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

const { state } = steamSession;

beforeEach(async () => {
  await flushDb();
  resetWebSessionState();
  fetchMocker.resetMocks();
  state.accessToken = jwt(new Date(Date.now() + HOUR_MS));
  state.refreshError = null;
  state.renewedRefreshToken = null;
  state.renewResult = false;
  state.renewError = null;
  state.cookies = ["steamLoginSecure=abc", "sessionid=def"];
  state.refreshAccessTokenCalls = 0;
  state.renewCalls = 0;
});

afterAll(() => {
  fetchMocker.disableMocks();
});

describe("createSession", () => {
  it("names the device after grate", () => {
    const session = createSession();
    const handler = (
      session as unknown as {
        _handler: {
          _getPlatformData(): {
            deviceDetails: { device_friendly_name: string };
          };
        };
      }
    )._handler;
    expect(
      handler._getPlatformData().deviceDetails.device_friendly_name,
    ).toMatch(/^grate/);
  });
});

describe("decodeJwtExpiry", () => {
  it("reads the expiry from the payload", () => {
    const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + DAY_MS);
    expect(decodeJwtExpiry(jwt(expiresAt))).toStrictEqual(expiresAt);
  });
});

describe("getAccessToken", () => {
  it("returns null when no account is linked", async () => {
    expect(await getAccessToken()).toBeNull();
    expect(state.refreshAccessTokenCalls).toBe(0);
  });

  it("returns null when the stored token has expired", async () => {
    createSteamUser({
      refreshTokenExpiresAt: new Date(Date.now() - DAY_MS),
    });
    expect(await getAccessToken()).toBeNull();
    expect(state.refreshAccessTokenCalls).toBe(0);
  });

  it("refreshes an access token and reuses it while it is valid", async () => {
    createSteamUser();
    expect(await getAccessToken()).toBe(state.accessToken);
    expect(await getAccessToken()).toBe(state.accessToken);
    expect(state.refreshAccessTokenCalls).toBe(1);
  });

  it("refreshes again once the cached token is within a minute of expiry", async () => {
    createSteamUser();
    state.accessToken = jwt(new Date(Date.now() + 30 * 1000));
    await getAccessToken();
    state.accessToken = jwt(new Date(Date.now() + HOUR_MS));
    expect(await getAccessToken()).toBe(state.accessToken);
    expect(state.refreshAccessTokenCalls).toBe(2);
  });

  it("clears the stored session when steam rejects the token", async () => {
    const linked = createSteamUser();
    state.refreshError = Object.assign(new Error("AccessDenied"), {
      eresult: 15,
    });

    await expect(getAccessToken()).rejects.toThrow("AccessDenied");

    const row = await db.query.steamUser.findFirst({
      where: eq(steamUser.steamId, linked.steamId),
    });
    expect(row?.refreshToken).toBeNull();
    expect(row?.refreshTokenExpiresAt).toBeNull();
  });
});

async function storedRow(steamId: string) {
  return db.query.steamUser.findFirst({
    where: eq(steamUser.steamId, steamId),
  });
}

describe("tryRenewRefreshToken", () => {
  it("does nothing without a linked account", async () => {
    expect(await tryRenewRefreshToken()).toBe(false);
    expect(state.renewCalls).toBe(0);
  });

  it("stores a renewed refresh token and its expiry", async () => {
    const linked = createSteamUser();
    const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + DAY_MS);
    state.renewResult = true;
    state.renewedRefreshToken = jwt(expiresAt);

    expect(await tryRenewRefreshToken()).toBe(true);

    const row = await storedRow(linked.steamId);
    expect(row?.refreshToken).toBe(state.renewedRefreshToken);
    expect(row?.refreshTokenExpiresAt).toStrictEqual(expiresAt);
    expect(getSessionRenewal().lastRenewedAt).toBeInstanceOf(Date);
  });

  it("leaves the row alone when steam issues no new token", async () => {
    const linked = createSteamUser();
    state.renewResult = false;

    expect(await tryRenewRefreshToken()).toBe(false);

    const row = await storedRow(linked.steamId);
    expect(row?.refreshToken).toBe(linked.refreshToken);
    expect(row?.refreshTokenExpiresAt).toStrictEqual(
      linked.refreshTokenExpiresAt,
    );
    expect(getSessionRenewal().lastRenewAttemptAt).toBeInstanceOf(Date);
    expect(getSessionRenewal().lastRenewedAt).toBeNull();
  });

  it("caches the access token the renewal returns", async () => {
    createSteamUser();
    await tryRenewRefreshToken();
    expect(await getAccessToken()).toBe(state.accessToken);
    expect(state.refreshAccessTokenCalls).toBe(0);
  });

  it("skips a second attempt within twenty hours", async () => {
    createSteamUser();
    await tryRenewRefreshToken();
    expect(await tryRenewRefreshToken()).toBe(false);
    expect(state.renewCalls).toBe(1);
  });

  it("clears the stored session when steam rejects the token", async () => {
    const linked = createSteamUser();
    state.renewError = Object.assign(new Error("AccessDenied"), {
      eresult: 15,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await tryRenewRefreshToken()).toBe(false);

    const row = await storedRow(linked.steamId);
    expect(row?.refreshToken).toBeNull();
    expect(row?.refreshTokenExpiresAt).toBeNull();
    expect(await getAccessToken()).toBeNull();
    vi.mocked(console.error).mockRestore();
  });

  it("keeps the stored session for a transient failure", async () => {
    const linked = createSteamUser();
    state.renewError = new Error("Network unreachable");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await tryRenewRefreshToken()).toBe(false);

    const row = await storedRow(linked.steamId);
    expect(row?.refreshToken).toBe(linked.refreshToken);
    vi.mocked(console.error).mockRestore();
  });
});

describe("getOwnedAppIds", () => {
  it("returns null without a session", async () => {
    expect(await getOwnedAppIds()).toBeNull();
    expect(fetchMocker.mock.calls).toHaveLength(0);
  });

  it("returns the owned app ids from the store userdata", async () => {
    createSteamUser();
    fetchMocker.mockResponseOnce(JSON.stringify(userData));

    expect(await getOwnedAppIds()).toEqual(new Set(userData.rgOwnedApps));

    const [url, init] = fetchMocker.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      "https://store.steampowered.com/dynamicstore/userdata/?_=",
    );
    expect(init.headers).toEqual({
      Cookie: state.cookies.join("; "),
      Referer: "https://store.steampowered.com/",
    });
  });
});
