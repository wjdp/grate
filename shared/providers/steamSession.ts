export const STEAM_SESSION_EXPIRY_WARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SteamSessionState =
  | "connected"
  | "expiring"
  | "expired"
  | "removed";

// Classifies a Steam row's session, given no row is missing entirely (that
// case — no row at all — is "disconnected" and is decided by the caller).
export function steamSessionState(
  sessionExpiresAt: string | null,
  now = new Date(),
): SteamSessionState {
  if (sessionExpiresAt === null) return "removed";
  const expiresAt = new Date(sessionExpiresAt);
  if (expiresAt <= now) return "expired";
  if (
    expiresAt.getTime() - now.getTime() <
    STEAM_SESSION_EXPIRY_WARNING_DAYS * DAY_MS
  ) {
    return "expiring";
  }
  return "connected";
}
