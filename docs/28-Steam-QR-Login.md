---
type: task
status: open
---

# Steam QR login

Written 2026-09-02 from two live spikes against the author's account (593 games). Replaces the Steam Web API key. Prerequisite for Steam DLC ownership in [27](27-DLC.md).

## Problem

- The Web API key grants games and playtime but not licences: `GetOwnedGames` never returns DLC apps (verified with `appids_filter`, `include_free_sub`, `skip_unvetted_apps=false`). `CheckAppOwnership` is publisher-key only. Owned DLC needs a logged-in session.
- So a session is coming regardless. Once it exists the key is redundant for everything grate actually calls: `GetOwnedGames` accepts a session access token, and the only key-only calls left (`GetPlayerSummaries`, `ResolveVanityURL`) are replaceable or unnecessary.
- Dropping the key removes the worst bit of onboarding — "go to steamcommunity.com/dev/apikey, paste a secret, then paste your profile URL, and get the vanity/id parsing right" — and one long-lived secret from the DB.
- No users exist beyond the author's dev instance, so there is no compatibility path to keep. The key column and the legacy relink code go.

## Spike results (2026-09-02, dev account)

Full raw output in `tmp/steam-qr/FINDINGS.md`. No token strings recorded anywhere.

### First spike — is a session usable at all

- `steam-session` (already a transitive dependency of `steam-user`; pin it directly, 1.9.4) `LoginSession(...).startWithQR()` returns `qrChallengeUrl` (`https://s.team/q/1/…`). Scanned with the Steam mobile app → `authenticated` event, `steamID` populated. A WebBrowser session does not kick the desktop client; not observed for MobileApp either.
- `GET https://store.steampowered.com/dynamicstore/userdata/?_=<ts>` with session cookies and `Referer: https://store.steampowered.com/` → `rgOwnedApps` (1367 ids; by PICS type 619 game, 663 DLC, 20 Config, 16 Music, 44 unknown/delisted), `rgOwnedPackages` (701), plus `rgWishlist`, `rgIgnoredApps`, `rgFollowedApps`. 1367 vs 593 from `GetOwnedGames` — this is the DLC ownership source for doc 27.
- `IStoreBrowseService/GetItems/v1` returned bulk store metadata with the API key; whether it accepts `access_token=` or nothing is untested (doc 27 needs this).

### Second spike — WebBrowser vs MobileApp, and can the key go

| | WebBrowser | MobileApp |
| --- | --- | --- |
| refresh token `aud` | `web`, `renew`, `derive` | `web`, `renew`, `derive`, `mobile` |
| refresh token life | ~211 days (exp 2027-04-01) | ~210 days (exp 2027-03-31) |
| `refreshAccessToken()` | **AccessDenied** | OK, access token ~24 h |
| `renewRefreshToken()` | **AccessDenied** | OK, but returned `false` twice |
| `getWebCookies()` | OK — 16 cookies across store/community/checkout/help/steam.tv | OK — **2 cookies, no Domain attribute** (`steamLoginSecure`, `sessionid`) |
| `GetOwnedGames?access_token=` | 200, 593 games | 200, 593 games |
| `dynamicstore/userdata` | 200 | 200, identical counts |

- Platform is baked into the token: setting a web refresh token on a MobileApp session is rejected client-side (`required audience "mobile" but got "web,renew,derive"`). A web login cannot be upgraded later.
- `GetOwnedGames` accepts `access_token=` as a **query parameter only** — `Authorization: Bearer` → 401, `key=<access token>` → 401.
- With `include_extended_appinfo` the token call returns every field the current code reads: `appid, name, playtime_forever, playtime_{windows,mac,linux,deck}_forever, playtime_disconnected, rtime_last_played, img_icon_url, capsule_filename, sort_as, has_workshop, has_market, has_dlc, content_descriptorids`.
- `ISteamUser/GetPlayerSummaries` and `ISteamUser/ResolveVanityURL` with `access_token=` → 400 "Required parameter 'key' is missing". No access-token path exists; they are key-only.
- MobileApp `getWebCookies()`'s `steamLoginSecure` token **equals** the `refreshAccessToken()` token, so one access token serves both the Web API and the store cookie jar.
- `renewRefreshToken()` returning `false` minutes after login is expected: the `steam-user` README states a new refresh token is issued on renewal only when "your provided token is nearly expired". The access token is still refreshed on every call. The width of the renewal window is undocumented.

### QR challenge rotation (the "Failed to load QR info" red herring)

- Steam rotates the QR challenge ~20 s after `startWithQR()`: the poll response carries `newClientId` + `newChallengeUrl`. A QR older than that shows "Failed to load QR info" in the app — it was never a platform problem.
- `steam-session` updates its `clientId` internally but **does not emit the new URL**. The only hook is the `debug` event: `session.on('debug', (type, data) => ...)` with `type === 'poll response'` and `data.newChallengeUrl` (camelCase, decoded protobuf). The spike script rendered from that and both platforms then scanned first time.
- Consequence for us: the UI must re-render the QR on every rotation, and we depend on a debug event to do it. Worth an upstream issue/PR adding a proper event (open item).

### Device name on Steam's authorised devices page

- Steam lists the session by the `device_friendly_name` sent at `startWithQR()`. steam-session hardcodes it per platform: WebBrowser sends the user agent (shows as "Web browser — Chrome on Windows"), MobileApp sends `Galaxy S25`. No public option for MobileApp.
- Verified 2026-09-02: overriding `session._handler._getPlatformData` to set `device_friendly_name: 'grate'` for MobileApp works — Steam shows **Mobile device — "grate"**, the name verbatim. Private API; pin the version and cover with a test that asserts the patched payload.
- Use it: the user must be able to recognise grate on that page to revoke it. Include the instance hostname if cheap ("grate on <host>").

## Decisions (agreed)

- **Drop the Steam Web API key entirely.** No compatibility path, no optional key, no fallback.
- **QR login only**, `EAuthTokenPlatformType.MobileApp` — the only platform that can refresh or renew from a stored refresh token. No password/Guard-code login, no SteamClient tokens.
- **SteamID comes from the session**, so profile-URL/vanity input and `ResolveVanityURL` are deleted outright.
- **Profile from the community XML endpoint**, keyless. Drop the fields it does not carry.
- **Renew on every sync; a running instance should never need a re-scan.** `renewRefreshToken()` refreshes the access token each call and issues a new refresh token once inside Steam's near-expiry window; persist it immediately. Re-scan is the recovery path only for an instance that was offline through the whole window.
- **Expiry must not be silent.** The instance may run unattended for months: surface a missing/expired session app-wide via the provider fault banners in [29](29-Provider-Fault-Banners.md), not just on the providers page or in logs.
- Single account per instance, as today: a scan for a different SteamID is rejected.

## Design

### Storage

Migration (`db/migrations/`; latest applied is `0009_game_hidden.sql`, and doc 27 plans `0010_dlc.sql` — whichever lands first takes `0010`, the other `0011`; do not clash):

```sql
ALTER TABLE SteamUser DROP COLUMN apiKey;
ALTER TABLE SteamUser DROP COLUMN lastLogoff;
ALTER TABLE SteamUser DROP COLUMN avatarHash;
ALTER TABLE SteamUser ADD refreshToken text;
ALTER TABLE SteamUser ADD refreshTokenExpiresAt integer;
```

- `refreshToken` nullable text; `refreshTokenExpiresAt` a `datetime()` column parsed from the JWT `exp` at store time (decode the payload, no verification — we are not the audience).
- `lastLogoff`/`avatarHash` go because the XML endpoint has no equivalent. Nothing reads them; the only Steam profile field the app renders is `personaName` (`app/pages/providers/index.vue`, `app/pages/providers/steam/index.vue`). Avatars are stored but unused — keep the three avatar columns, they are in the XML.
- `profileUrl` is derived, not fetched: `https://steamcommunity.com/id/<customURL>` when the XML has one, else `https://steamcommunity.com/profiles/<steamId>`.
- Threat model: a refresh token is **full account access including checkout**, strictly more than the API key it replaces. Same class as the GOG/Epic tokens already in the DB, but say so plainly in the UI.

### Login flow

- `POST /api/providers/steam/qr` — creates a `LoginSession(EAuthTokenPlatformType.MobileApp)`, `startWithQR()`, stores it in an in-memory registry keyed by a random id, returns `{ id, qrChallengeUrl }`.
- `GET /api/providers/steam/qr/:id` — returns `{ state, qrChallengeUrl }` where `state` is `pending | authenticated | expired | error`. `qrChallengeUrl` is the **current** one, updated by the `debug` `poll response` handler; the client re-renders whenever it changes. Client polls ~2 s.
- On `authenticated`: read `session.refreshToken` and `session.steamID`, fetch the profile, upsert `SteamUser`, drop the session object. The poll endpoint reports `authenticated` once and the client refreshes the page status.
- Registry: `Map<string, QrSession>`, TTL 5 min (`loginTimeout`), swept on access; entries deleted on success, cancellation or timeout. In-memory only — a server restart mid-scan loses the attempt and the user re-scans. Acceptable, no persistence.
- Single-account guard: if a `SteamUser` row exists and the scanned SteamID differs, reject with the existing message shape ("grate only supports a single Steam account"), discard the token, do not write.
- `DELETE /api/providers/steam/qr/:id` cancels (`cancelLoginAttempt()`), used when the modal closes.

### Token use — `lib/steam/webSession.ts`

New module, the only place `steam-session` is imported:

- `getAccessToken(): Promise<string | null>` — module-level cache `{ token, expiresAt }`; on miss builds a `LoginSession(MobileApp)`, sets `refreshToken` from the DB, calls `refreshAccessToken()`, caches until `exp` minus a minute. Null when there is no token or it is expired.
- `tryRenewRefreshToken()` — called once per games sync (and at least daily regardless, so a long gap between syncs cannot miss the window) instead of `refreshAccessToken()`: `renewRefreshToken()` returns true → persist the new token and its new `exp` in the same tick (the old one is invalidated immediately); false → carry on. Errors are logged and treated as a failed refresh, not a fatal sync error. Record `lastRenewAttemptAt`/`lastRenewedAt` in memory or a settings row so the providers page can show renewal is actually happening.
- `getWebCookies(): Promise<string[] | null>` — MobileApp returns two domain-less cookies, so **no filtering** (the earlier WebBrowser note about filtering to `store.steampowered.com` no longer applies).
- `getOwnedAppIds(): Promise<Set<number> | null>` — cookies + `dynamicstore/userdata?_=<ts>` with the store `Referer`; returns `rgOwnedApps`. Null when no session. Consumed by doc 27's Steam DLC import; once per games sync is plenty.
- Rejected/invalid token (Steam says the refresh token is dead before its `exp`): clear `refreshToken`/`refreshTokenExpiresAt` so the UI shows disconnected rather than looping.

### `lib/steam/api.ts`

- `SteamCredentials` becomes `{ accessToken: string; steamId: string }`.
- `getUserGames` sends `access_token` instead of `key`, same other parameters. Query parameter only.
- Delete `resolveVanityUrl` and `userInfoSchema`/`getUserInfo` (the `GetPlayerSummaries` shape).
- New `getCommunityProfile(steamId)` → `GET https://steamcommunity.com/profiles/<steamid64>/?xml=1` (verified 200, no auth). Fields used: `steamID64`, `steamID` (persona name), `avatarIcon`, `avatarMedium`, `avatarFull`, `realname`, `customURL`. Also present but unused: `memberSince`, `onlineState`, `privacyState`.
- XML parsing: add `fast-xml-parser` (small, no native deps, already a common transitive) and validate the parsed object with zod as elsewhere. A regex over five fields would avoid the dependency but breaks on CDATA (`steamID` and `realname` are wrapped) — not worth the cleverness.
- `getServerInfo` and `getTagList` are unaffected (keyless already).

### `lib/steam/service.ts`

- `steamCredentialsOf` → `steamCredentials()`: reads the row, gets an access token from `webSession`, throws `SteamServiceError("Steam account not connected")` when null.
- Delete `resolveSteamId`, `SteamProfileCredentials`, `relinkLegacySteamUser` (the pre-text-steamId migration path — dead, and the column it keyed on is going).
- `createOrUpdateSteamUser` → `linkSteamAccount({ steamId, refreshToken, refreshTokenExpiresAt })`, called from the QR completion path: fetch the community profile, insert-or-update, single-account guard as above.
- `updateUser` re-fetches the community profile; no token needed.
- `unlinkSteamAccount()` nulls `refreshToken`/`refreshTokenExpiresAt`.

### `lib/providerJobs.ts`

- `isActive()` → `!!user?.refreshToken && user.refreshTokenExpiresAt > now`. Doc 19's line ("`steamUser` row with non-null `apiKey`") needs updating.

### UI — `app/pages/providers/steam/index.vue`

- Remove both inputs and the save button.
- Not connected: "Connect Steam account" button → Nuxt UI modal with the QR (SVG via the `qrcode` package, rendered client-side, no external image), the instruction "Scan with the Steam mobile app → Steam Guard → scan QR", a spinner while polling, and a warning that this grants grate full account access (including purchases) — the same token the Steam mobile app holds.
- The QR re-renders whenever the poll returns a changed `qrChallengeUrl`; no visible flicker, no user action.
- Connected: persona name badge as now, plus "Session valid until <date>, renews automatically" and the sync button. If the token is within 14 days of expiry and renewal has not succeeded, show a warning alert "Re-scan to keep Steam syncing" here and via the global banner ([29](29-Provider-Fault-Banners.md)); once expired, the banner escalates to an error until re-scanned. A sync skipped for a missing/expired token logs once.
- Disconnect button clears the columns. `steam-session` exposes no revoke; the copy points at Steam's Authorized Devices page under account security (exact location still to verify).

### Tests

- Mock `steam-session` at the `webSession.ts` boundary, exactly as the PICS tests mock `steam-user`.
- Fixtures: trimmed `dynamicstore/userdata` response, a `GetOwnedGames` response, a community profile XML document.
- Cover: access-token cache reuse and expiry; `renewRefreshToken` true → persisted, false → unchanged; expired/absent token → `isActive` false and `getOwnedAppIds` null; QR registry TTL and cancellation; single-account guard rejects a different SteamID without writing.

## Codebase change list

Delete:

- `shared/steam-profile.ts` and `shared/steam-profile.test.ts`.
- `steamAuthBodySchema` in `shared/schemas/providers.ts`.
- `server/api/providers/steam/auth.post.ts`.
- `resolveVanityUrl`, `getUserInfo`, `userInfoSchema` in `lib/steam/api.ts`.
- `resolveSteamId`, `relinkLegacySteamUser`, `SteamProfileCredentials` in `lib/steam/service.ts`.
- `bruno/steam/resolve-vanity-url.bru`, `get-user-summaries.bru`, `get-user-info.bru`; `STEAM_API_KEY` and `STEAM_VANITY_URL` in `bruno/.env.example` (`get-games.bru` also needs the key → switch to `access_token`).

Add:

- `lib/steam/webSession.ts` (+ test), `lib/steam/qrRegistry.ts` (or keep the map in the endpoint module — one place either way).
- `server/api/providers/steam/qr.post.ts`, `qr/[id].get.ts`, `qr/[id].delete.ts`.
- Migration + Drizzle schema edit + snapshot/journal; migration test count bump, `refreshTokenExpiresAt` into the datetime-column checks.
- Dependencies: `steam-session` (direct pin), `qrcode`, `fast-xml-parser`.

Change:

- `lib/steam/api.ts` (`SteamCredentials`, `access_token=`, community profile fetch), `lib/steam/service.ts`, `lib/providerJobs.ts`, `server/api/providers/steam/index.get.ts` (`hasApiKey` → `expiresAt`), `app/pages/providers/steam/index.vue`.
- `lib/steam/service.test.ts` — the whole `createOrUpdateSteamUser` block (lines ~280–520) is keyed on `apiKey`; rewrite around `linkSteamAccount`.
- `lib/fixtures/game.ts` — `createSteamUser` generates a fake `apiKey` (line ~135); swap for a refresh token + expiry.

Docs to update:

- `README.md` line ~68 (API key + profile URL → scan a QR with the Steam mobile app).
- `docs/21-Providers.md` Steam **Auth** bullet.
- `docs/04-App-structure.md` secrets line ("Steam API key lives in DB settings").
- `docs/19-Provider-Job-Normalisation.md` line 46 (`isActive` definition).
- `docs/05-Test-Infrastructure.md` and `docs/13-Nuxt-4-Upgrade.md` mention `shared/steam-profile` — they are point-in-time reviews, so leave them; note the file is gone only if editing them for another reason.

## Open items

- **Confirm renewal actually fires near expiry — March 2027** (dev instance token exp 2027-03-31). Also worth asking upstream / SteamKit folk how wide the window is; if it is short (days), the daily renew attempt above is load-bearing. Until confirmed, keep the re-scan warning path in place.
- Does `dynamicstore/userdata` include Family Sharing and free-weekend grants? If so they will look like ownership to doc 27's DLC import.
- Exact location of Steam's Authorized Devices / session revocation page, for the disconnect copy.
- Keep `realName`? It is in the XML and in the schema, and nothing renders it. Cheap to keep, cheaper still to drop with the other columns.
- Upstream `steam-session`: raise an issue (and probably a PR) for a first-class event carrying `new_challenge_url`, and a `deviceFriendlyName` constructor option for MobileApp/WebBrowser. Both are currently reached through private surface (`debug` payload shape, `_handler._getPlatformData`) — a version-pinning risk until upstream.
- `userdata` also carries `rgWishlist`, `rgIgnoredApps`, `rgFollowedApps` — obvious follow-ups, out of scope here.
