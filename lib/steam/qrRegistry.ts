import { randomUUID } from "node:crypto";
import type { LoginSession } from "steam-session";
import { linkSteamAccount } from "~~/lib/steam/service";
import { createSession, decodeJwtExpiry } from "~~/lib/steam/webSession";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const SWEEP_GRACE_MS = 30 * 1000;

export type QrLoginState = "pending" | "authenticated" | "expired" | "error";

export interface QrLoginStatus {
  state: QrLoginState;
  qrChallengeUrl: string;
  message?: string;
}

interface QrLogin extends QrLoginStatus {
  session: LoginSession;
  createdAt: number;
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
    linkSteamAccount({
      steamId: session.steamID.getSteamID64(),
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: decodeJwtExpiry(session.refreshToken),
    })
      .then(() => {
        login.state = "authenticated";
      })
      .catch((error: Error) => {
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

function sweep() {
  const cutoff = Date.now() - LOGIN_TIMEOUT_MS - SWEEP_GRACE_MS;
  for (const [id, login] of logins) {
    if (login.createdAt > cutoff) continue;
    if (login.state === "pending") login.session.cancelLoginAttempt();
    logins.delete(id);
  }
}

export function getQrLogin(id: string): QrLoginStatus | null {
  sweep();
  const login = logins.get(id);
  if (!login) return null;
  const { state, qrChallengeUrl, message } = login;
  // A terminal state is only useful to the client once; holding it would keep
  // a finished attempt alive until the sweep.
  if (state !== "pending") logins.delete(id);
  return message === undefined
    ? { state, qrChallengeUrl }
    : { state, qrChallengeUrl, message };
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
