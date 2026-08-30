// OAuth client that all the open-source launcher apps use; the id and redirect
// are public, so they live here where the browser can reach them. The matching
// client secret stays in `lib/gog/api.ts`.
export const GOG_CLIENT_ID = "46899977096215655";
export const GOG_REDIRECT_URI =
  "https://embed.gog.com/on_login_success?origin=client";

export function getGogLoginUri(): string {
  return `https://login.gog.com/auth?client_id=${GOG_CLIENT_ID}&redirect_uri=${GOG_REDIRECT_URI}&response_type=code&layout=client2`;
}
