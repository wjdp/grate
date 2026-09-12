import { randomUUID } from "node:crypto";
import type { LoginSession } from "steam-session";
import { getCommunityProfile } from "~~/server/providers/steam/api";
import {
  attachSteamWebSession,
  getSteamUser,
  type SteamWebSession,
} from "~~/server/providers/steam/service";
import {
  createSession,
  decodeJwtExpiry,
} from "~~/server/providers/steam/webSession";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const SWEEP_GRACE_MS = 30 * 1000;
// A scan before the account exists holds its token while the user fetches an
// API key, so setup does not need a second scan.
const HELD_TTL_MS = 15 * 60 * 1000;

export type QrLoginState = "pending" | "authenticated" | "expired" | "error";

export interface QrLoginStatus {
  state: QrLoginState;
  qrChallengeUrl: string;
  message?: string;
  steamId?: string;
  personaName?: string;
}

interface QrLogin extends QrLoginStatus {
  session: LoginSession;
  createdAt: number;
  held?: SteamWebSession;
}

export interface HeldQrLogin extends SteamWebSession {
  steamId: string;
}

const logins = new Map<string, QrLogin>();

function isPollResponseWithNewChallenge(
  type: string,
  data: unknown,
): data is { newChallengeUrl: string } {
  return (
    type === "poll response" &&
    typeof (data as { newChallengeUrl?: unknown } | null)?.newChallengeUrl ===
      "string"
  );
}

export async function startQrLogin(): Promise<{
  id: string;
  qrChallengeUrl: string;
}> {
  const session = createSession();
  session.loginTimeout = LOGIN_TIMEOUT_MS;
  const id = randomUUID();
  const login: QrLogin = {
    session,
    state: "pending",
    qrChallengeUrl: "",
    createdAt: Date.now(),
  };
  logins.set(id, login);

  session.on("debug", (type: string, data: unknown) => {
    if (!isPollResponseWithNewChallenge(type, data)) return;
    if (login.state === "pending") {
      login.qrChallengeUrl = data.newChallengeUrl;
    }
  });

  session.on("authenticated", () => {
    holdOrAttach(login, session).catch((error: Error) => {
      login.state = "error";
      login.message = error.message;
    });
  });

  session.on("timeout", () => {
    login.state = "expired";
  });

  session.on("error", (error: Error) => {
    login.state = "error";
    login.message = error.message;
  });

  try {
    const { qrChallengeUrl } = await session.startWithQR();
    if (!qrChallengeUrl) {
      logins.delete(id);
      throw new Error("Steam did not return a QR challenge URL");
    }
    if (!login.qrChallengeUrl) login.qrChallengeUrl = qrChallengeUrl;
    return { id, qrChallengeUrl: login.qrChallengeUrl };
  } catch (error) {
    logins.delete(id);
    throw error;
  }
}

async function holdOrAttach(login: QrLogin, session: LoginSession) {
  const steamId = session.steamID.getSteamID64();
  const webSession: SteamWebSession = {
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: decodeJwtExpiry(session.refreshToken),
  };
  const profile = await getCommunityProfile({ steamId });
  login.steamId = steamId;
  login.personaName = profile.steamID;
  if (await getSteamUser()) {
    await attachSteamWebSession({ steamId, ...webSession });
  } else {
    login.held = webSession;
  }
  login.state = "authenticated";
}

function sweep() {
  const now = Date.now();
  for (const [id, login] of logins) {
    const ttl = login.held ? HELD_TTL_MS : LOGIN_TIMEOUT_MS + SWEEP_GRACE_MS;
    if (now - login.createdAt < ttl) continue;
    if (login.state === "pending") login.session.cancelLoginAttempt();
    logins.delete(id);
  }
}

export function getQrLogin(id: string): QrLoginStatus | null {
  sweep();
  const login = logins.get(id);
  if (!login) return null;
  const { state, qrChallengeUrl, message, steamId, personaName } = login;
  // A failed attempt is only useful to the client once; holding it would keep
  // it alive until the sweep. An authenticated entry survives so setup can
  // still claim its token.
  if (state === "expired" || state === "error") logins.delete(id);
  const status: QrLoginStatus = { state, qrChallengeUrl };
  if (message !== undefined) status.message = message;
  if (steamId !== undefined) status.steamId = steamId;
  if (personaName !== undefined) status.personaName = personaName;
  return status;
}

export function takeHeldQrLogin(id: string): HeldQrLogin | null {
  sweep();
  const login = logins.get(id);
  if (!login?.held || !login.steamId) return null;
  logins.delete(id);
  return { steamId: login.steamId, ...login.held };
}

export function cancelQrLogin(id: string) {
  const login = logins.get(id);
  if (!login) return;
  if (login.state === "pending") login.session.cancelLoginAttempt();
  logins.delete(id);
}

export function resetQrRegistry() {
  logins.clear();
}
