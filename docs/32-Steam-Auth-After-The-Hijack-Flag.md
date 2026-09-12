---
type: task
status: open
---

# Steam auth after the hijack flag

Written 2026-09-12. Supersedes the auth model in [28](28-Steam-QR-Login.md); that doc stays as the record of the spikes and the incident. Unblocks the Steam half of [27](27-DLC.md).

## What happened

- Doc 28 shipped: Web API key deleted, QR login on `EAuthTokenPlatformType.MobileApp`, server refreshes/renews the token unattended, `device_friendly_name` patched via steam-session's private `_handler`.
- 2026-09-03 Steam flagged the dev account as hijacked and restricted it. Support has since lifted the restrictions but forced a password reset (every refresh token revoked) and would only say the activity "violated the Steam Subscriber Agreement".
- Relevant SSA clauses (read 2026-09-12): **4.C** — "You may not use any form of scripts, bots, macros, or other non-human-controlled systems ('Automation') to interact with Content and Services on Steam"; **2.G** — you may not "emulate or redirect the communication protocols used by Valve". A Linux server presenting as a "Galaxy S25" and calling `refreshAccessToken`/`renewRefreshToken` on a schedule is both.
- The Web API key sits under separate terms (steamcommunity.com/dev/apiterms): personal-use applications explicitly permitted, 100,000 calls/day, keep the key confidential. It is the only Valve-sanctioned mechanism for an unattended poller.

## Decisions (agreed 2026-09-12)

- **Web API key is required again** and carries everything the poller does: `GetOwnedGames` (games + playtime), profile via community XML. Reverses doc 28's "drop the key entirely".
- **MobileApp platform is dead.** Never again: no client-platform emulation, no `_handler` patch, no `refreshAccessToken`/`renewRefreshToken`.
- **QR login stays, on `EAuthTokenPlatformType.WebBrowser`, optional, for rich data only.** Rich data = anything the key cannot reach: owned DLC via `dynamicstore/userdata` ([27](27-DLC.md)) first; later candidates wishlist, ignored/followed apps, achievement and stats pages, store pages that need a logged-in user. Low frequency by design: cookies minted at most once a day, a handful of requests per sync, never the games/playtime poll. No session → rich-data steps are skipped, library and playtime are unaffected. This is the same thing a browser does with "remember me"; still Automation in the strict 4.C reading, so it is opt-in with the risk stated in the UI.
- Not "session primary, key fallback": the hot path must sit on the sanctioned channel, and a fallback means both secrets are required anyway. Key required + session optional is simpler and fails softer.
- **Onboarding is two steps: identify, then key.** Step 1 yields a SteamID64 either by scanning a QR (recommended; also links the web session for rich data) or by pasting a profile URL / vanity / SteamID64 (parser restored from `f150c63`). Step 2 asks for the API key, addressed to the persona found in step 1. Nothing is written until the key is validated. Vanity resolution goes through community XML (`/id/<vanity>/?xml=1` returns `steamID64`), so `ResolveVanityURL` and `GetPlayerSummaries` stay deleted and the key is used for `GetOwnedGames` alone.
- Not "QR then key, both mandatory": that makes the web session a prerequisite for every user, and a web token cannot be renewed, so the "both present" invariant only holds at setup anyway. The session stays optional; QR is merely the nicer way to do step 1.
- Keep the QR endpoint/registry/modal code; retarget rather than rebuild.

## Verification in the app, not spikes (2026-09-12)

No more PoC logins: every extra authentication is another anomaly signal on the account. The WebBrowser session is verified by the shipped code on the dev instance, one scan only:

1. Link once via the app (no platform-data patch, WebBrowser). Note what the Authorised Devices page shows.
2. The rich-data path records `lastWebSessionUseAt` / `lastWebSessionError` in memory and shows them on the Steam provider page; a daily `dynamicstore/userdata` call exercises `getWebCookies()` from the stored refresh token at +24 h, +48 h, ….
3. Watch the inbox for an Account Alert for a week. Any flag → remove the web session in the app and treat the session feature as dead: strip it (Sequencing step 3) and mark doc 27 Steam ownership unachievable.
4. Record the outcome here under "Web session results".

## Design

### Storage

Migration `0011_steam_api_key_returns.sql` (the untracked `0012_playtime_timeline_projection.sql` belongs to other work and is ignored):

```sql
ALTER TABLE SteamUser ADD apiKey text;
UPDATE SteamUser SET refreshToken = NULL, refreshTokenExpiresAt = NULL;
```

- `apiKey` nullable text (nullable so the migration applies over the existing row; service rejects a row without one). `refreshToken`/`refreshTokenExpiresAt` stay, now meaning "optional web session". `lastLogoff`/`avatarHash` stay dropped — the XML profile does not carry them and nothing renders them.
- Migration test: count bump, no new datetime column.

### `server/providers/steam/api.ts`

- `SteamCredentials` → `{ apiKey: string; steamId: string }`. `getUserGames` sends `key=` again (restore from `39ed473~1`), same other parameters. Verify `include_extended_appinfo` fields are identical to the token call before trusting the fixture — doc 28 recorded them from the token path only.
- `getCommunityProfile(idOrVanity)` gains a vanity path: `GET /id/<vanity>/?xml=1`; same schema, `steamID64` is the resolved id. Keep the existing `/profiles/<id>/?xml=1` path.
- `resolveVanityUrl`, `getUserInfo`, `userInfoSchema` stay deleted.

### `server/providers/steam/service.ts`

- `steamCredentials()` reads `apiKey` from the row; throws `SteamServiceError("Steam account not connected")` when null. No `getAccessToken` call.
- `linkSteamAccount(...)` splits:
  - `identifySteamAccount(profile: SteamProfileInput)` — pure lookup, no write: resolve via community XML (restore `shared/steam-profile.ts` + test from `a085e56~1`), return `{ steamId, personaName, avatar }`. Used by the paste path of step 1.
  - `connectSteamAccount({ steamId, apiKey, webSession? })` — validates the key with one `GetOwnedGames` call for that SteamID (wrong key or private-to-key profile → error, no write); single-account guard as now; upserts key + profile fields and, when `webSession` (`{ refreshToken, refreshTokenExpiresAt }`) is present, the two token columns in the same transaction.
  - `attachSteamWebSession({ steamId, refreshToken, refreshTokenExpiresAt })` — the post-setup "Link web session" path; **requires an existing row with the same SteamID**, otherwise rejects ("scanned account differs"). Never creates the row.
- `unlinkSteamAccount()` → clears everything. New `removeSteamWebSession()` clears only the two token columns.
- `updateUser()` drops the `tryRenewRefreshToken()` call. `updateGames`/`recordPlaytimes` likewise.

### `server/providers/steam/webSession.ts`

Shrinks to the rich-data session helper:

- `createSession()` → `new LoginSession(EAuthTokenPlatformType.WebBrowser)` with steam-session's default user agent (a custom one is an open item); **delete** the `_handler` patch, `PlatformDataHandler`, `deviceFriendlyName`.
- Delete `getAccessToken`, `tryRenewRefreshToken`, `getSessionRenewal`, the access-token cache, `RENEW_ATTEMPT_INTERVAL_MS`. `decodeJwtExpiry` stays.
- `getWebCookies()` → cache cookies in memory until the `steamLoginSecure` JWT `exp` minus a minute, so a session hits `finalizelogin` at most once per ~24 h. Filter to the `store.steampowered.com` cookies (WebBrowser returns 16 across five domains — the doc 28 "no filtering" note was MobileApp-specific).
- `hasSteamWebSession()` — the row check used by rich-data steps and the status endpoint. `getWebSessionActivity()` → `{ lastUsedAt, lastError }` kept in memory by `getOwnedAppIds()`; exposed on the status endpoint for in-app verification.
- `getOwnedAppIds()` unchanged in shape; dead-token handling (`AccessDenied`, expired) clears the two columns via `removeSteamWebSession()` so the UI shows "session removed" rather than looping.
- `package.json` comment about the `_handler` patch goes; the exact pin on `steam-session` stays for the `debug`-event QR rotation hook.

### `server/providers/jobs.ts`

- `isActive()` → `!!user?.apiKey`. `warnSteamSessionExpiredOnce` goes (a missing session is no longer a fault). Update [19](19-Provider-Job-Normalisation.md) line 46.
- Each rich-data step (Steam DLC import in doc 27 first) checks `hasSteamWebSession()` (`refreshToken && refreshTokenExpiresAt > now`) itself and logs one skip line when absent.

### API routes

- `POST /api/providers/steam/identify` — body `{ profile: string }`, returns `{ steamId, personaName, avatar }`. No write.
- `POST /api/providers/steam/auth` (restore the shape from `a085e56~1`) — body `{ apiKey, steamId, qrLoginId? }` via `steamAuthBodySchema` in `shared/schemas/providers.ts`. When `qrLoginId` is given the server takes the refresh token from the QR registry entry (which must be `authenticated` for the same SteamID) and passes it to `connectSteamAccount` as `webSession`; the entry is deleted on success. Returns `{ steamId, personaName }`.
- QR registry: on `authenticated`, when no `SteamUser` row exists the entry **holds** the token (`state: authenticated`, `steamId`, `personaName` from the community XML) instead of writing — TTL extended to 15 min so the user has time to fetch a key. When a row exists, behaviour as now via `attachSteamWebSession`. `GET qr/:id` returns `steamId`/`personaName` alongside `state` so the client can move to step 2.
- `GET /api/providers/steam` → `{ steamId, personaName, hasApiKey, webSessionExpiresAt, webSessionLastUsedAt, webSessionLastError }`; `lastRenewAttemptAt`/`lastRenewedAt` go.
- `unlink.post.ts` stays (full disconnect); add `web-session.delete.ts` for session-only removal.

### `shared/providers/steamSession.ts`

- Keep `steamSessionState` but rename the concept in copy from "session" to "web session"; `expiring` threshold stays 14 days. No banner escalation for `expired` any more — see below.

### UI — `app/pages/providers/steam/index.vue`

Not connected: a two-step setup (`USStepper` or two stacked cards, second disabled until the first completes).

1. **Identify** — two options side by side: "Scan QR with the Steam app" (recommended; opens `SteamQrLoginModal`, which on `authenticated` closes and reports `steamId`/`personaName`/`qrLoginId`) *or* "Paste profile URL, vanity name or SteamID64" → `identify`. Either way step 1 ends with a persona badge ("Setting up for <persona>") and a change-account link that resets the flow (and cancels the QR entry). The QR option carries the web-session warning copy (below) since scanning links the session.
2. **API key** — "Create a key for <persona> at `steamcommunity.com/dev/apikey`" (any domain name works), one input, Connect → `auth`. Error from key validation stays on this step. Copy states the key is stored in the DB and is revoked on the same page it was created.

Connected: two cards.

1. **Account**: persona badge, SteamID, sync button, Disconnect (clears everything, cancels nothing on Steam's side).
2. **Web session** (optional), described as "Rich data: owned DLC, and later achievements, wishlist and other things the Web API key cannot see". Not linked: "Link web session" → existing `SteamQrLoginModal`, retargeted. Modal warning copy changes: this is a browser-style login used at most once a day for data the key cannot reach; Steam's terms forbid automated access and grate's earlier mobile-style login got an account restricted, so opt in knowingly; the token grants full account access; revoke from Authorised Devices. Linked: "Valid until <date>. Steam does not let grate extend it — re-scan after that date to keep rich data syncing." plus Remove. `expiring` → inline warning only; `expired` → inline "expired, re-scan" only. **Not** routed through the doc 29 global banner: the poller is unaffected and the instance is not broken.

### Tests

- `service.test.ts`: `linkSteamAccount` block → `identifySteamAccount` (steamId / profile URL / vanity via XML, no write), `connectSteamAccount` (key validated by `GetOwnedGames` before any write, single-account guard, with and without `webSession`), `attachSteamWebSession` (rejects without a row, rejects a different SteamID, writes only the two columns). "calls the steam api with a session access token" → "with the api key".
- `webSession.test.ts`: cookie cache reuse and expiry, store-domain filtering, dead-token clears the columns; delete the renewal and `_getPlatformData` patch tests.
- `qrRegistry.test.ts`: holds the token when no row exists and exposes `steamId`/`personaName`; attaches when a row exists; held entry consumed by `auth` and gone afterwards; held entry expires and is swept.
- `test/fixtures/game.ts` `createSteamUser`: generate `apiKey`; tokens default null.
- `shared/steam-profile.test.ts` restored.

### Docs to update

- ✅ `README.md` line ~68 → scan QR or paste profile URL, then API key; web session optional, rich data (DLC and later achievements, wishlist).
- ✅ `docs/21-Providers.md` Steam Auth bullet; ✅ `docs/04-App-structure.md` secrets line; ✅ `docs/19-Provider-Job-Normalisation.md` line 46; ✅ `docs/27-DLC.md` Steam ownership rows (session optional, WebBrowser, daily); ✅ `docs/29-Provider-Fault-Banners.md` (Steam fault = missing key, not session); `docs/28-Steam-QR-Login.md` → `status: superseded` with a one-line pointer here.
- `bruno/.env.example`: `STEAM_API_KEY` back, `STEAM_ACCESS_TOKEN` out; `get-games.bru` to `key=`.

## Codebase change list

Restore from history: `shared/steam-profile.ts` + test, `steamAuthBodySchema`, `server/api/providers/steam/auth.post.ts` (`a085e56~1`); `key=` branch of `getUserGames` (`39ed473~1`).

Add: migration 0011 + schema + snapshot/journal; `identify.post.ts`, `web-session.delete.ts`; two-step setup UI.

Change: `api.ts`, `service.ts`, `webSession.ts` (shrink), `qrRegistry.ts` (hold-or-attach, `steamId`/`personaName` in status), `jobs.ts`, `index.get.ts`, `qr.post.ts`, `index.vue`, `SteamQrLoginModal.vue` copy, fixtures, tests, docs above.

Delete: `_handler` patch and everything renewal-related in `webSession.ts`; `warnSteamSessionExpiredOnce`; `getSessionRenewal`.

## Sequencing

1. Implement all of the above on branch `steam-auth-key`. Order: migration → api/service → routes → UI → docs.
2. Deploy, link once, observe for a week (above).
3. If it fails or Steam flags again: same branch minus the web-session card, the QR option in step 1, `webSession.ts`, `qrRegistry.ts`, QR routes and `steam-session`/`qrcode` dependencies; doc 27 Steam ownership marked unachievable. The paste path is the only step-1 option, which is why it exists.
4. Deployed instance still holds a revoked MobileApp token. Migration 0011 also nulls `refreshToken`/`refreshTokenExpiresAt` so no code path ever presents a mobile-platform token to a WebBrowser session (steam-session rejects the audience mismatch client-side anyway). User enters the key, then optionally re-scans.

## Open items

- Does a WebBrowser `getWebCookies()` keep working from a stored refresh token for the token's whole ~210-day life, or does Steam bind it to the first `finalizelogin`? Observed in production via the status endpoint.
- Custom `userAgent` for the WebBrowser session: honest (`grate/x.y`) may itself look anomalous; the default Chrome UA is a lie. Decide after seeing the Authorised Devices entry for the first in-app link.
- Key validation in `connectSteamAccount` is a full `GetOwnedGames` fetch; fine for one call at setup, but if it turns out slow for large libraries, `GetOwnedGames` with `include_appinfo=0` or `IPlayerService/GetRecentlyPlayedGames` is a cheaper probe.
- Is `apiKey` nullable long-term, or does a follow-up make it `NOT NULL` once the dev row is populated? Cheap either way.
- Family Sharing / free-weekend grants in `rgOwnedApps` (carried from doc 28).
- The two `31-` docs collide (`31-Library-Navigation-And-Surfaces.md`, `31-Playtime-Corrections.md`); numbers are never reused, so this doc is 32 and the collision stands.
