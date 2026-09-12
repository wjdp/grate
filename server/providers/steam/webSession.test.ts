import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";
import { db } from "~~/server/database/client";
import { steamUser } from "~~/server/database/schema";
import userData from "~~/server/providers/steam/fixtures/userdata.json";
import {
  createSession,
  decodeJwtExpiry,
  getOwnedAppIds,
  getWebCookies,
  getWebSessionActivity,
  hasSteamWebSession,
  resetWebSessionState,
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
const STEAM_ID = "76561198000000001";

function loginSecureCookie(expiresAt: Date, domain = "store.steampowered.com") {
  const value = encodeURIComponent(`${STEAM_ID}||${jwt(expiresAt)}`);
  return `steamLoginSecure=${value}; Path=/; Domain=${domain}; Secure; HttpOnly`;
}

function webCookies(expiresAt: Date) {
  return [
    loginSecureCookie(expiresAt),
    "sessionid=store-session; Path=/; Domain=store.steampowered.com",
    "browserid=1; Path=/; Domain=steamcommunity.com",
    `steamLoginSecure=${STEAM_ID}%7C%7Cother; Path=/; Domain=help.steampowered.com`,
    "timezoneOffset=0,0; Path=/",
  ];
}

const steamSession = vi.hoisted(() => {
  const state: {
    cookies: string[];
    cookiesError: Error | null;
    getWebCookiesCalls: number;
    platformTypes: number[];
    refreshTokens: string[];
  } = {
    cookies: [],
    cookiesError: null,
    getWebCookiesCalls: 0,
    platformTypes: [],
    refreshTokens: [],
  };

  class FakeLoginSession {
    refreshToken = "";

    constructor(public platformType: number) {
      state.platformTypes.push(platformType);
    }

    async getWebCookies() {
      state.getWebCookiesCalls += 1;
      state.refreshTokens.push(this.refreshToken);
      if (state.cookiesError) throw state.cookiesError;
      return state.cookies;
    }
  }

  return { state, FakeLoginSession };
});

vi.mock("steam-session", () => ({
  LoginSession: steamSession.FakeLoginSession,
  EAuthTokenPlatformType: { MobileApp: 2, WebBrowser: 4 },
}));

const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

const { state } = steamSession;

function createSessionUser(overrides: Parameters<typeof createSteamUser>[0]) {
  return createSteamUser({
    refreshToken: jwt(new Date(Date.now() + 200 * DAY_MS)),
    refreshTokenExpiresAt: new Date(Date.now() + 200 * DAY_MS),
    ...overrides,
  });
}

beforeEach(async () => {
  await flushDb();
  resetWebSessionState();
  fetchMocker.resetMocks();
  state.cookies = webCookies(new Date(Date.now() + DAY_MS));
  state.cookiesError = null;
  state.getWebCookiesCalls = 0;
  state.platformTypes = [];
  state.refreshTokens = [];
});

afterAll(() => {
  fetchMocker.disableMocks();
});

describe("createSession", () => {
  it("logs in as a web browser", () => {
    createSession();
    expect(state.platformTypes).toEqual([4]);
  });
});

describe("decodeJwtExpiry", () => {
  it("reads the expiry from the payload", () => {
    const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + DAY_MS);
    expect(decodeJwtExpiry(jwt(expiresAt))).toStrictEqual(expiresAt);
  });
});

describe("hasSteamWebSession", () => {
  it("is false without a linked account", async () => {
    expect(await hasSteamWebSession()).toBe(false);
  });

  it("is false without a stored token", async () => {
    createSteamUser();
    expect(await hasSteamWebSession()).toBe(false);
  });

  it("is false once the stored token has expired", async () => {
    createSessionUser({
      refreshTokenExpiresAt: new Date(Date.now() - DAY_MS),
    });
    expect(await hasSteamWebSession()).toBe(false);
  });

  it("is true for an unexpired stored token", async () => {
    createSessionUser({});
    expect(await hasSteamWebSession()).toBe(true);
  });
});

describe("getWebCookies", () => {
  it("returns null without a web session", async () => {
    createSteamUser();
    expect(await getWebCookies()).toBeNull();
    expect(state.getWebCookiesCalls).toBe(0);
  });

  it("keeps only the store cookies, as name=value pairs", async () => {
    createSessionUser({});
    const expiresAt = new Date(Date.now() + DAY_MS);
    state.cookies = webCookies(expiresAt);

    expect(await getWebCookies()).toEqual([
      `steamLoginSecure=${encodeURIComponent(`${STEAM_ID}||${jwt(expiresAt)}`)}`,
      "sessionid=store-session",
      "timezoneOffset=0,0",
    ]);
  });

  it("mints the cookies from the stored refresh token once", async () => {
    const linked = createSessionUser({});

    const first = await getWebCookies();
    expect(await getWebCookies()).toEqual(first);

    expect(state.getWebCookiesCalls).toBe(1);
    expect(state.refreshTokens).toEqual([linked.refreshToken]);
  });

  it("mints again once the login cookie is within a minute of expiry", async () => {
    createSessionUser({});
    state.cookies = webCookies(new Date(Date.now() + 30 * 1000));
    await getWebCookies();
    state.cookies = webCookies(new Date(Date.now() + DAY_MS));

    await getWebCookies();

    expect(state.getWebCookiesCalls).toBe(2);
  });

  it("mints again when the stored token has been replaced", async () => {
    createSessionUser({});
    await getWebCookies();
    const rescanned = jwt(new Date(Date.now() + 201 * DAY_MS));
    db.update(steamUser).set({ refreshToken: rescanned }).run();

    await getWebCookies();

    expect(state.getWebCookiesCalls).toBe(2);
    expect(state.refreshTokens[1]).toBe(rescanned);
  });

  it("rejects a cookie jar with no login cookie", async () => {
    createSessionUser({});
    state.cookies = ["sessionid=store-session; Domain=store.steampowered.com"];
    await expect(getWebCookies()).rejects.toThrow(
      "Steam web cookies carry no steamLoginSecure token",
    );
  });
});

describe("getOwnedAppIds", () => {
  it("returns null without a web session", async () => {
    createSteamUser();
    expect(await getOwnedAppIds()).toBeNull();
    expect(fetchMocker.mock.calls).toHaveLength(0);
  });

  it("returns the owned app ids from the store userdata", async () => {
    createSessionUser({});
    fetchMocker.mockResponseOnce(JSON.stringify(userData));

    expect(await getOwnedAppIds()).toEqual(new Set(userData.rgOwnedApps));

    const [url, init] = fetchMocker.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      "https://store.steampowered.com/dynamicstore/userdata/?_=",
    );
    expect(init.headers).toEqual({
      Cookie: (await getWebCookies())?.join("; "),
      Referer: "https://store.steampowered.com/",
    });
    expect(getWebSessionActivity().lastUsedAt).toBeInstanceOf(Date);
    expect(getWebSessionActivity().lastError).toBeNull();
  });

  it("records the error from a failed request", async () => {
    createSessionUser({});
    fetchMocker.mockResponseOnce("", { status: 503 });

    await expect(getOwnedAppIds()).rejects.toThrow(
      "Steam store userdata request failed: 503",
    );

    expect(getWebSessionActivity().lastError).toContain("503");
    expect(getWebSessionActivity().lastUsedAt).toBeNull();
  });

  it("removes the web session when steam rejects the token", async () => {
    const linked = createSessionUser({});
    state.cookiesError = Object.assign(new Error("AccessDenied"), {
      eresult: 15,
    });

    await expect(getOwnedAppIds()).rejects.toThrow("AccessDenied");

    const row = await db.query.steamUser.findFirst({
      where: eq(steamUser.steamId, linked.steamId),
    });
    expect(row?.refreshToken).toBeNull();
    expect(row?.refreshTokenExpiresAt).toBeNull();
    expect(row?.apiKey).toBe(linked.apiKey);
    expect(getWebSessionActivity().lastError).toBe("AccessDenied");
  });

  it("keeps the web session for a transient failure", async () => {
    const linked = createSessionUser({});
    state.cookiesError = new Error("Network unreachable");

    await expect(getOwnedAppIds()).rejects.toThrow("Network unreachable");

    const row = await db.query.steamUser.findFirst({
      where: eq(steamUser.steamId, linked.steamId),
    });
    expect(row?.refreshToken).toBe(linked.refreshToken);
  });
});
