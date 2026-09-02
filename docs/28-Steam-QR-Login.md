---
type: task
status: open
---

# Steam QR login (web session)

Skeleton written 2026-09-02 from a live spike; needs fleshing out before implementation. Prerequisite for Steam DLC ownership in [27](27-DLC.md).

## Problem

The Steam Web API key grants read access to games and playtime but not licences: `IPlayerService/GetOwnedGames` never returns DLC apps (verified with `appids_filter`, `include_free_sub`, `skip_unvetted_apps=false`). `ISteamUser/CheckAppOwnership` is publisher-key only. The only route to owned DLC is a logged-in session.

## Spike results (2026-09-02, dev account)

- `steam-session` (already a transitive dependency of `steam-user`, pin it directly) `LoginSession(EAuthTokenPlatformType.WebBrowser).startWithQR()` returns `qrChallengeUrl` (`https://s.team/q/1/…`). Scanned with the Steam mobile app → `authenticated` event, `steamID` populated. A web-platform session does **not** kick the desktop client.
- Refresh token JWT: `iat` 2026-09-02, `exp` 2027-04-01 (~7 months), `aud [web, renew, derive]`. `renewRefreshToken()` → `AccessDenied` for WebBrowser (README says the same). Plan on re-scan roughly twice a year.
- `getWebCookies()` returns cookies for several domains (login/store/community/help/checkout/steam.tv). Must filter to `Domain=store.steampowered.com` and dedupe by name before use; sending the mixed jar returns an empty result silently. Needed: `steamLoginSecure`, `sessionid`.
- `GET https://store.steampowered.com/dynamicstore/userdata/?_=<ts>` with those cookies and a `Referer: https://store.steampowered.com/` → `rgOwnedApps` (1367 ids; by PICS type: 619 game, 663 DLC, 20 Config, 16 Music, 44 unknown/delisted), `rgOwnedPackages` (701), plus `rgWishlist`, `rgIgnoredApps`, `rgFollowedApps`. Cached briefly server-side; the `_` cache-buster is what the store client sends.
- Access token from the session is **not** accepted by `api.steampowered.com` in place of `key=` (401), so the API key stays.
- `IStoreBrowseService/GetItems/v1` works with the API key (no session) and returns price, reviews, tags, release, assets in bulk — no session needed for metadata, only for ownership.

## Design (to flesh out)

- **Storage**: `SteamUser.webRefreshToken` (text, nullable), `webRefreshTokenExpiresAt` (from the JWT `exp`), `webSessionSteamId` to assert it matches the linked profile. Same threat model as GOG/Epic tokens already in the DB; a web refresh token is full store/community access, say so in the UI.
- **Flow**: providers/steam page → "Connect Steam account" → server starts a `LoginSession`, returns `qrChallengeUrl` + a poll id; client renders the QR (SVG, small dependency or `qrcode` package, no external images) and polls `GET /api/providers/steam/qr/:id` until `authenticated`/`timeout`. Server keeps sessions in memory with a TTL; `loginTimeout` ~5 min; steam-session polls Steam itself. On success store the token, discard the session object.
- **Use**: `lib/steam/webSession.ts` — `getOwnedAppIds(): Promise<Set<number> | null>` builds a `LoginSession` from the stored refresh token, `getWebCookies()`, filters store cookies, fetches `userdata`, returns `rgOwnedApps`. Null when no token or token expired/rejected; callers (doc 27 Steam DLC import) skip. No persistent CM connection; nothing to keep alive.
- **Expiry UX**: providers page shows "Steam account: connected, re-scan by <date>"; warn from 30 days out; sync logs once when skipped for a missing/expired token. Tasks page: nothing new.
- **Disconnect**: clear the columns. `steam-session` has no revoke; tell the user the session can be removed from Steam's "Authorized Devices" page under account security (verify the exact location).
- **Not in scope**: password/Guard-code login (agreed QR only); SteamClient-platform tokens (renewable via `steam-user`, but a CM session and different kick semantics); using the session for anything but ownership in this task (wishlist/ignored lists are visible in `userdata` and are obvious follow-ups).

## Open items for whoever fleshes this out

- Confirm `dynamicstore/userdata` includes apps owned via Family Sharing or free-weekend grants, and whether `rgOwnedApps` includes packages' sub-apps consistently (Season Pass 404090 and its member DLC were all present in the spike).
- Where in-progress QR sessions live if the server restarts mid-scan (in-memory is fine; user retries).
- QR rendering choice (server-side SVG vs client lib), Nuxt UI modal or inline on the providers page.
- Rate/etiquette: `userdata` once per games sync is plenty.
- Test strategy: mock `steam-session` at the `webSession.ts` boundary like PICS mocks `steam-user`; fixture of a trimmed `userdata` response.
