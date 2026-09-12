export type SteamProfileInput = { steamId: string } | { vanityName: string };

const STEAM_ID_PATTERN = /^\d{17}$/;
const VANITY_NAME_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;
const PROFILE_URL_PATTERN =
  /^https?:\/\/(?:www\.)?steamcommunity\.com\/profiles\/(\d{17})(?:\/.*)?$/;
const VANITY_URL_PATTERN =
  /^https?:\/\/(?:www\.)?steamcommunity\.com\/id\/([^/?#]+)(?:\/.*)?$/;

export function parseSteamProfileInput(
  input: string,
): SteamProfileInput | null {
  const trimmed = input.trim();
  if (STEAM_ID_PATTERN.test(trimmed)) {
    return { steamId: trimmed };
  }
  const profileUrlMatch = PROFILE_URL_PATTERN.exec(trimmed);
  if (profileUrlMatch) {
    return { steamId: profileUrlMatch[1] };
  }
  const vanityUrlMatch = VANITY_URL_PATTERN.exec(trimmed);
  if (vanityUrlMatch) {
    return { vanityName: vanityUrlMatch[1] };
  }
  if (VANITY_NAME_PATTERN.test(trimmed)) {
    return { vanityName: trimmed };
  }
  return null;
}
