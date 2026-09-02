// OAuth client that the Epic Games Launcher itself uses, as legendary/Heroic/
// Lutris do; the id and redirect are public, so they live here where the
// browser can reach them. The matching client secret stays in `server/providers/epic/api.ts`.
export const EPIC_CLIENT_ID = "34a02cf8f4414e29b15921876da36f9a";
export const EPIC_REDIRECT_URI = `https://www.epicgames.com/id/api/redirect?clientId=${EPIC_CLIENT_ID}&responseType=code`;

export function getEpicLoginUri(): string {
  return `https://www.epicgames.com/id/login?redirectUrl=${encodeURIComponent(EPIC_REDIRECT_URI)}`;
}
