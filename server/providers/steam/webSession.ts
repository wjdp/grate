import { EAuthTokenPlatformType, LoginSession } from "steam-session";
import { z } from "zod";
import { db } from "~~/server/database/client";
import { removeSteamWebSession } from "./service";

const COOKIE_EXPIRY_BUFFER_MS = 60 * 1000;
const USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";
const STORE_URL = "https://store.steampowered.com/";
const STORE_DOMAIN = "store.steampowered.com";

/**
 * A browser login session, as "remember me" in a browser would create. It
 * backs the optional rich-data requests the Web API key cannot serve; the
 * games and playtime poll never touches it.
 */
export function createSession(): LoginSession {
  return new LoginSession(EAuthTokenPlatformType.WebBrowser);
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

// Keyed on the refresh token so a removed or re-scanned session invalidates it
// without any explicit clearing.
let cookieCache: {
  refreshToken: string;
  cookies: string[];
  expiresAt: Date;
} | null = null;
let lastUsedAt: Date | null = null;
let lastError: string | null = null;

async function storedSession(): Promise<StoredSession | null> {
  const row = await db.query.steamUser.findFirst();
  if (!row?.refreshToken || !row.refreshTokenExpiresAt) return null;
  if (row.refreshTokenExpiresAt.getTime() <= Date.now()) return null;
  return { steamId: row.steamId, refreshToken: row.refreshToken };
}

export async function hasSteamWebSession(): Promise<boolean> {
  return (await storedSession()) !== null;
}

export function resetWebSessionState() {
  cookieCache = null;
  lastUsedAt = null;
  lastError = null;
}

export function getWebSessionActivity(): {
  lastUsedAt: Date | null;
  lastError: string | null;
} {
  return { lastUsedAt, lastError };
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

function splitCookie(cookie: string): { pair: string; domain?: string } {
  const [pair, ...attributes] = cookie.split(";").map((part) => part.trim());
  const domain = attributes
    .map((attribute) => /^domain=(.+)$/i.exec(attribute)?.[1])
    .find((value) => value !== undefined);
  return domain === undefined ? { pair } : { pair, domain };
}

// A WebBrowser session mints cookies for several Steam domains; only the store
// ones are ever sent, and only as name=value.
function storeCookiePairs(cookies: string[]): string[] {
  return cookies
    .map(splitCookie)
    .filter(
      ({ domain }) =>
        domain === undefined || domain.replace(/^\./, "") === STORE_DOMAIN,
    )
    .map(({ pair }) => pair);
}

function cookiePairValue(pairs: string[], name: string): string | null {
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator > 0 && pair.slice(0, separator) === name) {
      return pair.slice(separator + 1);
    }
  }
  return null;
}

// steamLoginSecure is `<steamid>||<jwt>`, url-encoded; its JWT expiry is how
// long the cookie jar is good for.
function cookieExpiry(pairs: string[]): Date {
  const value = cookiePairValue(pairs, "steamLoginSecure");
  const token = value ? decodeURIComponent(value).split("||")[1] : undefined;
  if (!token) {
    throw new Error("Steam web cookies carry no steamLoginSecure token");
  }
  return new Date(decodeJwtExpiry(token).getTime() - COOKIE_EXPIRY_BUFFER_MS);
}

export async function getWebCookies(): Promise<string[] | null> {
  const stored = await storedSession();
  if (!stored) return null;
  if (
    cookieCache &&
    cookieCache.refreshToken === stored.refreshToken &&
    cookieCache.expiresAt > new Date()
  ) {
    return cookieCache.cookies;
  }
  const session = createSession();
  session.refreshToken = stored.refreshToken;
  const cookies = storeCookiePairs(await session.getWebCookies());
  cookieCache = {
    refreshToken: stored.refreshToken,
    cookies,
    expiresAt: cookieExpiry(cookies),
  };
  return cookies;
}

const userDataSchema = z.object({ rgOwnedApps: z.array(z.number()) });

export async function getOwnedAppIds(): Promise<Set<number> | null> {
  try {
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
    const ownedAppIds = new Set(
      userDataSchema.parse(await response.json()).rgOwnedApps,
    );
    lastUsedAt = new Date();
    lastError = null;
    return ownedAppIds;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    if (isDeadTokenError(error)) {
      cookieCache = null;
      await removeSteamWebSession();
    }
    throw error;
  }
}
