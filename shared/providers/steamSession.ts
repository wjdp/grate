export const STEAM_SESSION_EXPIRY_WARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SteamSessionState =
  | "connected"
  | "expiring"
  | "expired"
  | "removed";

// Classifies the optional Steam web session behind rich data. "removed" means
// no session; the API key, which the poller needs, is tracked separately.
export function steamSessionState(
  webSessionExpiresAt: string | null,
  now = new Date(),
): SteamSessionState {
  if (webSessionExpiresAt === null) return "removed";
  const expiresAt = new Date(webSessionExpiresAt);
  if (expiresAt <= now) return "expired";
  if (
    expiresAt.getTime() - now.getTime() <
    STEAM_SESSION_EXPIRY_WARNING_DAYS * DAY_MS
  ) {
    return "expiring";
  }
  return "connected";
}
