import { hostname } from "node:os";
import { eq } from "drizzle-orm";
import { EAuthTokenPlatformType, LoginSession } from "steam-session";
import { z } from "zod";
import { db } from "~~/server/database/client";
import { steamUser } from "~~/server/database/schema";

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;
const RENEW_ATTEMPT_INTERVAL_MS = 20 * 60 * 60 * 1000;
const USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";
const STORE_URL = "https://store.steampowered.com/";

// steam-session hardcodes device_friendly_name per platform ("Galaxy S25" for
// MobileApp) with no public option, so the private handler is patched to make
// the session recognisable on Steam's authorised devices page. Version-pinned
// against steam-session 1.9.4.
interface PlatformDataHandler {
  _getPlatformData(): { deviceDetails: { device_friendly_name: string } };
}

function deviceFriendlyName(): string {
  const host = hostname();
  return host ? `grate on ${host}` : "grate";
}

/**
 * A MobileApp login session whose device name identifies grate. The QR login
 * endpoints share it; the private `_handler` patch is version-pinned.
 */
export function createSession(): LoginSession {
  const session = new LoginSession(EAuthTokenPlatformType.MobileApp);
  const handler = (session as unknown as { _handler: PlatformDataHandler })
    ._handler;
  const getPlatformData = handler._getPlatformData.bind(handler);
  handler._getPlatformData = () => {
    const platformData = getPlatformData();
    platformData.deviceDetails.device_friendly_name = deviceFriendlyName();
    return platformData;
  };
  return session;
}

export function decodeJwtExpiry(token: string): Date {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Steam token is not a JWT");
  }
  const { exp } = z
    .object({ exp: z.number() })
    .parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  return new Date(exp * 1000);
}

interface StoredSession {
  steamId: string;
  refreshToken: string;
}

let accessTokenCache: { token: string; expiresAt: Date } | null = null;
let lastRenewAttemptAt: Date | null = null;
let lastRenewedAt: Date | null = null;

async function storedSession(): Promise<StoredSession | null> {
  const row = await db.query.steamUser.findFirst();
  if (!row?.refreshToken || !row.refreshTokenExpiresAt) return null;
  if (row.refreshTokenExpiresAt.getTime() <= Date.now()) return null;
  return { steamId: row.steamId, refreshToken: row.refreshToken };
}

function cacheAccessToken(token: string): string {
  accessTokenCache = {
    token,
    expiresAt: new Date(
      decodeJwtExpiry(token).getTime() - ACCESS_TOKEN_EXPIRY_BUFFER_MS,
    ),
  };
  return token;
}

export function clearAccessTokenCache() {
  accessTokenCache = null;
}

export function resetWebSessionState() {
  accessTokenCache = null;
  lastRenewAttemptAt = null;
  lastRenewedAt = null;
}

export function getSessionRenewal(): {
  lastRenewAttemptAt: Date | null;
  lastRenewedAt: Date | null;
} {
  return { lastRenewAttemptAt, lastRenewedAt };
}

function sessionWithStoredToken(stored: StoredSession): LoginSession {
  const session = createSession();
  session.refreshToken = stored.refreshToken;
  return session;
}

export async function getAccessToken(): Promise<string | null> {
  if (accessTokenCache && accessTokenCache.expiresAt > new Date()) {
    return accessTokenCache.token;
  }
  const stored = await storedSession();
  if (!stored) return null;
  const session = sessionWithStoredToken(stored);
  try {
    await session.refreshAccessToken();
  } catch (error) {
    if (isDeadTokenError(error)) {
      clearStoredSession(stored.steamId);
    }
    throw error;
  }
  return cacheAccessToken(session.accessToken);
}

// Steam reports a dead refresh token as an EResult; these mean re-scanning is
// the only way back, so the stored token is discarded rather than retried.
const DEAD_TOKEN_ERESULTS = new Set([15, 26, 27]);
const DEAD_TOKEN_MESSAGES = new Set([
  "AccessDenied",
  "Expired",
  "InvalidToken",
  "Revoked",
]);

function isDeadTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const eresult = (error as Error & { eresult?: number }).eresult;
  return (
    (eresult !== undefined && DEAD_TOKEN_ERESULTS.has(eresult)) ||
    DEAD_TOKEN_MESSAGES.has(error.message)
  );
}

function clearStoredSession(steamId: string) {
  db.update(steamUser)
    .set({ refreshToken: null, refreshTokenExpiresAt: null })
    .where(eq(steamUser.steamId, steamId))
    .run();
  clearAccessTokenCache();
}

export async function tryRenewRefreshToken(): Promise<boolean> {
  if (
    lastRenewAttemptAt &&
    Date.now() - lastRenewAttemptAt.getTime() < RENEW_ATTEMPT_INTERVAL_MS
  ) {
    return false;
  }
  const stored = await storedSession();
  if (!stored) return false;
  lastRenewAttemptAt = new Date();
  try {
    const session = sessionWithStoredToken(stored);
    const renewed = await session.renewRefreshToken();
    if (session.accessToken) {
      cacheAccessToken(session.accessToken);
    }
    if (!renewed) return false;
    db.update(steamUser)
      .set({
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: decodeJwtExpiry(session.refreshToken),
      })
      .where(eq(steamUser.steamId, stored.steamId))
      .run();
    lastRenewedAt = new Date();
    return true;
  } catch (error) {
    console.error("Steam refresh token renewal failed", error);
    if (isDeadTokenError(error)) {
      clearStoredSession(stored.steamId);
    }
    return false;
  }
}

export async function getWebCookies(): Promise<string[] | null> {
  const stored = await storedSession();
  if (!stored) return null;
  const session = sessionWithStoredToken(stored);
  return session.getWebCookies();
}

const userDataSchema = z.object({ rgOwnedApps: z.array(z.number()) });

export async function getOwnedAppIds(): Promise<Set<number> | null> {
  const cookies = await getWebCookies();
  if (!cookies) return null;
  const response = await fetch(`${USERDATA_URL}?_=${Date.now()}`, {
    headers: { Cookie: cookies.join("; "), Referer: STORE_URL },
  });
  if (!response.ok) {
    throw new Error(
      `Steam store userdata request failed: ${response.status} ${response.statusText}`,
    );
  }
  return new Set(userDataSchema.parse(await response.json()).rgOwnedApps);
}
