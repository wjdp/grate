---
type: task
status: in-progress
---

# Epic Games Store

Investigation 2026-08-30. Goal: Epic as a third provider alongside Steam and GOG — owned games, playtime, last played, art, launch/store links, scheduled sync.

Implementation landed 2026-08-30 (see "Implementation" below). This doc records the API surface, what is verified against source, and the schema/service shape.

## Verification key

- **Verified** — read directly in `derrod/legendary` (`legendary/api/egs.py`, `legendary/core.py`, `legendary/cli.py`, `legendary/models/game.py`, master), `lutris/lutris` (`lutris/services/egs.py`), `Heroic-Games-Launcher` (`src/backend/storeManagers/legendary/{library,games}.ts`), or `MixV2/EpicResearch` / `LeleDerGrasshalmi/FortniteEndpointsDocumentation` (community reverse-engineering docs with captured request/response examples).
- **Inferred** — consistent with the above but not stated anywhere; must be checked against a real account.

Live testing against a real account started 2026-08-30; findings are marked "Verified live 2026-08-30" inline and summarised in that section below.

## Auth flow

Epic has no public third-party API. Every open-source launcher borrows the Epic Games Launcher's own OAuth client, exactly as we borrow GOG Galaxy's.

Client (verified, `egs.py` `_user_basic`/`_pw_basic`, cross-checked against EpicResearch `auth_clients.md` as `launcherAppClient2`):

- client id `34a02cf8f4414e29b15921876da36f9a`
- client secret `daafbccc737745039dffe53d94fc76cf`

Its user permissions include `library:public:items READ`, `library:public:{accountId}:playtime:all READ`, `catalog:shared:* READ` and `account:public:account:* READ` — i.e. everything we need (verified, EpicResearch permissions dump for that client).

Flow, mapping one-for-one onto the existing GOG path:

1. **Login URI** — `https://www.epicgames.com/id/login?redirectUrl=` + urlencoded `https://www.epicgames.com/id/api/redirect?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code` (verified, `EPCAPI.get_auth_url`). Legendary's CLI sends users to the short link `https://legendary.gl/epiclogin`, which redirects to the same thing. The redirect target renders a JSON body `{"redirectUrl": ..., "authorizationCode": "...", "sid": null, "exchangeCode": null, "warning": "Do not share this code with any 3rd party service..."}`; the user copies `authorizationCode` (verified, `cli.py auth`). Unlike GOG the code is _not_ in the query string — it is in the page body, so our connect page must tell the user to paste the code rather than the whole URL. (GOG's flow accepts a pasted URL; here we can accept either the raw code or the whole JSON blob, as legendary does.)

   **Verified live 2026-08-30**: the redirect URL only returns a code once per Epic web login session — refreshing it afterwards gives `"authorizationCode": null`. A fresh code needs re-authentication (log out, or a private window, then hit the redirect URL again). Design consequence: the connect page must link to the `/id/login?redirectUrl=<encoded redirect>` form, not the bare redirect URL, so the user always lands on a fresh login rather than a stale/expired redirect page.

2. **Token exchange** — `POST https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token`, HTTP Basic with the client id/secret, `Content-Type: application/x-www-form-urlencoded`, body `grant_type=authorization_code&code=<code>&token_type=eg1` (verified, `EPCAPI.start_session`). `account-public-service-prod.ol.epicgames.com` is the same service and is what the community docs use; legendary uses `prod03`.
3. **Refresh** — same endpoint, `grant_type=refresh_token&refresh_token=<token>&token_type=eg1` (verified).
4. **Verify** — `GET .../account/api/oauth/verify` with `Authorization: bearer <access_token>`; returns `account_id`, `display_name`, `client_id`, `expires_at`, and `perms` when `?includePerms=true`. Legendary calls this to resume a session and treats an `errorMessage` in the body as invalid credentials (verified).

Token response fields (verified from a captured `exchange_code` response in the Lele docs; the `authorization_code` grant returns the same shape): `access_token`, `expires_in`, `expires_at` (ISO), `token_type` (`bearer`), `refresh_token`, `refresh_expires`, `refresh_expires_at`, `account_id`, `client_id`, `displayName`, `in_app_id`, `app`. **`account_id` comes back in the token response**, so unlike GOG we do not need a separate call to learn who we are.

Lifetimes: **verified live 2026-08-30** — a fresh `authorization_code` exchange gave `expires_in: 129483` (~36h) for `launcherAppClient2`/`eg1`; `expires_at` was returned alongside it. Refresh was not exercised, so `refresh_expires` is still unmeasured — do not assume GOG's ~30 day figure. Store `expires_at` verbatim; `handleRefreshToken` can key on it exactly as the GOG one does.

Gotchas (verified in source unless noted):

- Tokens are bound to the client id they were issued for; a refresh token from another client will not work here.
- `token_type=eg1` yields a signed JWT (`eg1~...`) instead of a 16-byte session id. Legendary always requests `eg1`. Either works; `eg1` is what EGL sends.
- Send the launcher `User-Agent`: `UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit` (verified, `EPCAPI._user_agent`; legendary updates the version string from its own update feed). The store GraphQL host wants `EpicGamesLauncher/<version>` instead.
- Sessions can be revoked server-side (`errors.com.epicgames.oauth.corrective_action_required` requires the user to visit a `continuationUrl`) — surface that message rather than a generic failure.
- Single-account constraint mirrors GOG: one `EpicUser` row, reject a second `account_id`.

## Endpoints

| Purpose          | Method + URL                                                                                                                                                                                            | Notes                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Login page       | `GET https://www.epicgames.com/id/login?redirectUrl=<encoded redirect>`                                                                                                                                 | Redirect target is `https://www.epicgames.com/id/api/redirect?clientId=…&responseType=code`                                  |
| Token / refresh  | `POST https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token`                                                                                                                   | Basic auth, form-encoded                                                                                                     |
| Verify session   | `GET https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/verify?includePerms=true`                                                                                                 | Returns `account_id`, `display_name`, `expires_at`                                                                           |
| Account info     | `GET https://account-public-service-prod03.ol.epicgames.com/account/api/public/account/{accountId}`                                                                                                     | Verified live: also returns `email`, `lastName`, `name`, `lastLogin`, `tfaEnabled` — PII, store only `displayName`/`country` |
| Kill session     | `DELETE .../account/api/oauth/sessions/kill/{accessToken}`                                                                                                                                              | Unused by legendary; for a "disconnect" button                                                                               |
| Library items    | `GET https://library-service.live.use1a.on.epicgames.com/library/api/public/items?includeMetadata=true[&cursor=…]`                                                                                      | Everything owned, incl. non-installable/third-party titles                                                                   |
| Launcher assets  | `GET https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/Windows?label=Live`                                                                                             | Legacy; installable Windows builds only                                                                                      |
| Catalog metadata | `GET https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace/{ns}/bulk/items?id={catalogItemId}&includeDLCDetails=true&includeMainGameDetails=true&country=GB&locale=en-GB` | One namespace per call; response keyed by `catalogItemId`                                                                    |
| Playtime, all    | `GET https://library-service.live.use1a.on.epicgames.com/library/api/public/playtime/account/{accountId}/all`                                                                                           | `[{accountId, artifactId, totalTime}]`                                                                                       |
| Playtime, one    | `GET https://library-service.live.use1a.on.epicgames.com/library/api/public/playtime/account/{accountId}/artifact/{artifactId}`                                                                         | Same shape, single object                                                                                                    |
| Store slug       | `POST https://launcher.store.epicgames.com/graphql` — `Catalog.catalogNs(namespace).mappings(pageType:"productHome"){pageSlug}`                                                                         | Heroic's method for deriving a store URL                                                                                     |
| Store metadata   | `GET https://store-content.ak.epicgames.com/api/en-GB/content/products/{slug}`                                                                                                                          | Unauthenticated; best source for `releaseDate`, `developer[]`, `publisher[]`, `shortDescription`                             |

All authenticated calls use `Authorization: bearer <access_token>`.

### Library listing

`records[]` entries (verified example): `namespace`, `catalogItemId`, `appName`, `productId`, `sandboxName`, `sandboxType`, `recordType`, `acquisitionDate`, `dependencies`. Pagination: `responseMetadata.nextCursor`, looped until absent (verified, `EPCAPI.get_library_items`); the cursor is base64 `{"offset":N}`, and `limit`, `platform`, `includeNs`/`excludeNs` are also accepted (community docs).

**Verified live 2026-08-30**: also carries `country`, `platform[]` (e.g. `["Windows","Mac"]`) and `sandboxName`. `sandboxName` is often the title but sometimes a codename (`Radicchio`, `Lemon`, `Kinglet`), so it cannot replace the catalog call for a display title. `appName` is unique once `ue`/Fab items are filtered out — duplicates only occur among namespace `ue` and `fab-listing-live` (Fab marketplace) records, all sharing the Fab namespace `89efe5924d3d467c839449ab6ab52e7f`.

Library items alone are not enough — they carry no title. Titles, art and developer come from the catalog call, one request per `(namespace, catalogItemId)`.

Filtering, all verified in launcher source:

- `namespace === "ue"` → Unreal Marketplace asset, skip (legendary `skip_ue`).
- `sandboxType === "PRIVATE"` → skip (legendary).
- missing `appName` → skip (legendary).
- catalog `mainGameItem` present → it is DLC; legendary buckets it under `mainGameItem.id`, Heroic sets `is_dlc` from the same field. **Verified live 2026-08-30**: this is the only reliable DLC signal — `categories[].path` is not: Civ VI's Aztec DLC has path `addons`, but Control's two DLC share `games, applications` with the base game. DLC arrives as its own library record with its own `appName` (e.g. Civ VI `Kinglet` + `KingletAztec`), so it also has its own playtime entry that must not be added to the parent game's total.
- catalog `categories[].path` containing `mods` → skip (both).
- catalog `categories[].path` in `assets`, `asset-format`, `plugins`, `projects` → UE content, skip (Heroic).
- `releaseInfo` where every `platform` is `Android`/`iOS` → mobile-store-only, skip (Heroic).
- `entitlementType === "AUDIENCE"`, `type/format-item` category, `ListingIdentifier` custom attribute, or `releaseInfo[].compatibleApps` → Fab/Unreal editor resource, skip (Lutris `is_editor_resource`).

The launcher `assets/Windows?label=Live` endpoint returns `{appName, assetId, buildVersion, catalogItemId, labelName, namespace, sidecarRvn}` (verified, `GameAsset.from_egs_json`). It is the _installable_ set only, so it misses third-party-managed and non-Windows titles — legendary calls the library endpoint separately to pick those up. For grate we want the library endpoint as the primary source; assets are only useful as a cross-check. This endpoint is also the one users report as slow (_inferred_ from launcher issue reports, not from source).

### Catalog metadata

Fields we care about (all seen consumed in launcher source): `title`, `description`, `longDescription`/`shortDescription`, `developer`, `developerId`, `namespace`, `id`, `categories[].path`, `creationDate`, `lastModifiedDate`, `releaseInfo[]` (`appId`, `platform[]`, `dateAdded`), `customAttributes` (`FolderName`, `CanRunOffline`, `ThirdPartyManagedApp`/`ThirdPartyManagedProvider`, `CloudSaveFolder`), `dlcItemList[]`, `mainGameItem`, `keyImages[]`.

`keyImages[].type` values used for art (verified, Heroic + Lutris):

- `DieselGameBoxTall` — portrait box art (fall back `OfferImageTall`).
- `DieselGameBox` — landscape cover (fall back `OfferImageWide`).
- `DieselGameBoxLogo` — transparent logo.
- `DieselStoreFrontTall` — store-front portrait, Heroic's fallback for square art.
- `DieselGameBoxSmall`, `DieselGameBannerSmall` — smaller variants (Lutris).

**Verified live 2026-08-30**: a typical title carried only `DieselGameBoxTall` (860×1148) and `DieselGameBox` (2560×1440) — no logo. URLs are absolute `cdn1.epicgames.com` links. `boxArtTallUrl`/`boxArtWideUrl`/`logoUrl` must all be nullable.

There is no `releaseDate` on the catalog item; `description` can be just the title (verified live, Manifold Garden). `creationDate` and `releaseInfo[].dateAdded` are the closest catalog fields; Heroic instead fetches `https://store-content.ak.epicgames.com/api/{lang}/content/products/{slug}` and reads `pages[type=productHome].data.meta.releaseDate`. **Verified live 2026-08-30**: that endpoint also returns `developer[]`, `publisher[]` and `data.about.shortDescription`, and is the best source for all three — recommended flow is slug via the GraphQL query, then `store-content` for `releaseDate`/`publisher`/description. Treat release date as best-effort and nullable, as GOG already is.

### Playtime

`GET .../playtime/account/{accountId}/all` returns a flat array of `{accountId, artifactId, totalTime}` (verified from a captured response in the Lele docs; the matching permission `library:public:{accountId}:playtime:all READ` is on our client).

- `totalTime` is **seconds** — beyond reasonable doubt from live magnitudes (Subnautica 217450 → 60.4h; read as minutes it would be an implausible 3624h), but still pending user confirmation against the launcher's own displayed figure. `GogGame.playtimeMinutes` is minutes, so an Epic column should either be `playtimeSeconds` or convert on read.
- `artifactId` is the **`appName`** of the release, i.e. `releaseInfo[].appId` on the catalog item — _not_ the catalogItemId (verified, Lele "obtaining the artifact id"; confirmed live, every artifactId matched a library appName). So playtime joins to the library on `appName`.
- **There is no `lastPlayedTime` in either playtime response.** Confirmed live: `/all` returns exactly `{accountId, artifactId, totalTime}`, nothing else. Consequence: Epic behaves like GOG, not Steam — `lastPlayedAt` has to be derived from observed playtime changes, exactly as `recordGogPlaytime` already does.
- No session history and no per-date breakdown. Only a running total. Same shape of problem as GOG, so the same `…GamePlaytime` snapshot table works.
- Only games with playtime appear — confirmed live: 18 of ~250 non-UE library records had a playtime entry. Missing artifact = zero, as in `recordGogPlaytimes`.
- **Confirmed live: DLC and UE artifacts appear in `/all` too** (Control's two DLC entries, `UE Marketplace`, `UT Marketplace`). Playtime must be filtered through the same ignore list as the library sync before summing, and DLC playtime must not be added into the parent game's total.
- The launcher _writes_ playtime via `PUT .../playtime/account/{accountId}` and `/bulk`. We must never call these.

### Launch and store links

Launch URI: `com.epicgames.launcher://apps/{namespace}%3A{catalogItemId}%3A{appName}?action=launch&silent=true` (verified, Lutris `get_launch_arguments` builds `com.epicgames.launcher://apps/{ns}%3A{id}%3A{app}?action=launch`; `silent=true` is what EGL itself appends — _inferred_). Falls back to `com.epicgames.launcher://apps/{appName}?action=launch` when namespace/catalogItemId are unknown. Equivalent to the existing `goggalaxy://openGameView/{id}` link.

Store URL: `https://www.epicgames.com/store/p/{slug}` (`/store/product/{slug}` also resolves). The slug is not in the catalog item; Heroic queries `launcher.store.epicgames.com/graphql` for `Catalog.catalogNs(namespace: $ns).mappings(pageType: "productHome").pageSlug` and falls back to a slugified title. **Verified live 2026-08-30**: this query works with the `EpicGamesLauncher/…` user agent. The reverse-direction `egs-platform-service.../api/v1/egs/mappings/{slug}` endpoint returned non-JSON live and is dropped from this doc.

## Verified live 2026-08-30

Real account, all calls via curl with the launcher client (`token_type=eg1`). Findings folded into the sections above; summarised here.

- **Auth.** Verify on a fresh `authorization_code` token returned `expires_in: 129483` (~36h), `expires_at`, `display_name`, `client_id`, `app`, `in_app_id`. Refresh not exercised — refresh token lifetime still unknown. Account info (`account/api/public/account/{id}`) returns far more than needed — `email`, `lastName`, `name`, `lastLogin`, `tfaEnabled`, `country`, `preferredLanguage`, `displayName` — only `displayName`/`country` should be stored; the rest is PII.
- **Library.** 304 records over 3 pages (100/111/57); `nextCursor` is base64 `{"offset":N}`; a `stateToken` is also returned but unused. All records were `recordType: APPLICATION`, `sandboxType: PUBLIC`, empty `dependencies`. 36/304 were namespace `ue`. `appName` is unique once `ue`/Fab items are filtered — duplicates occur only among `ue`/`fab-listing-live` records sharing the Fab namespace. DLC show up as separate library records with their own `appName` (Civ VI `Kinglet` + `KingletAztec`; Control `Calluna` + two DLC appNames).
- **Catalog.** Multiple `id` params in one `bulk/items` call work (tested 2 and 3) — batch per namespace. `mainGameItem` is the only reliable DLC signal; `categories[].path` is not (Civ VI's Aztec DLC has `addons`, but Control's DLC share `games, applications` with the base game). Base games and UE engine items both carry `entitlementType: EXECUTABLE`; UE items are distinguished by `categories` paths `engines`/`engines/ue4`. `releaseInfo[].appId` == library `appName` == playtime `artifactId`, confirmed. `keyImages` on a typical title: just `DieselGameBoxTall` and `DieselGameBox`, no logo — art columns must be nullable. No release date; `description` can be just the title.
- **Store metadata.** GraphQL slug lookup works with the `EpicGamesLauncher/…` user agent. Unauthenticated `store-content.ak.epicgames.com/api/en-GB/content/products/{slug}` returns `releaseDate`, `developer[]`, `publisher[]` and a real `shortDescription` — best source for all three. `egs-platform-service` mapping endpoint returned non-JSON and is dropped.
- **Playtime.** `/all` returned 18 entries, exactly `{accountId, artifactId, totalTime}`, no last-played. Every artifactId matched a library `appName`, including DLC (Control's two DLC at 50637 each vs base 115755) and UE items (`UE Marketplace` 300, `UT Marketplace` 900) — must go through the ignore list before summing, and DLC must not roll up into its parent. `totalTime` is seconds beyond reasonable doubt from magnitude (Subnautica 217450 → 60.4h), still pending confirmation against the launcher's own displayed hours. Only artifacts with playtime > 0 appear (18 of ~250 non-UE records).

## Data mapping

Mirrors the GOG tables. Provider rows stay the source of truth; `Game` is the agnostic layer (see `08-Cross-Provider-Game-Linking.md` — Epic rows must be 1:N on `Game` from the start).

`EpicUser` (one row, like `GogUser`):

| Column                                                                         | Source                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `accountId` (pk, text)                                                         | token response `account_id`                                               |
| `displayName`                                                                  | token `displayName` / verify `display_name`                               |
| `country`                                                                      | account info `country`                                                    |
| `accessToken`, `accessTokenExpiresAt`, `refreshToken`, `refreshTokenExpiresAt` | token response (`expires_at`, `refresh_expires_at` are ISO — store as-is) |

No avatar: Epic's public account endpoint does not return one.

`EpicGame`:

| Column                                  | Source                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `epicId` (pk, autoincrement, surrogate) | —                                                                                                      |
| `gameId` → `Game.id`                    | link                                                                                                   |
| `appName` (unique)                      | library `appName` = catalog `releaseInfo[].appId` = playtime `artifactId`                              |
| `namespace`                             | library `namespace`                                                                                    |
| `catalogItemId`                         | library `catalogItemId`                                                                                |
| `name`                                  | catalog `title`                                                                                        |
| `description`                           | catalog `description`, null when it equals the title                                                   |
| `developer`                             | catalog `developer`                                                                                    |
| `publisher`                             | store-content `publisher[]` joined, set on create or when `storeSlug` missing                          |
| `releaseDate`                           | store-content `releaseDate`, nullable                                                                  |
| `acquisitionDate`                       | library `acquisitionDate`                                                                              |
| `categories` (json)                     | catalog `categories[].path`                                                                            |
| `boxArtTallUrl`                         | keyImage `DieselGameBoxTall` → `OfferImageTall` → `DieselStoreFrontTall`                               |
| `boxArtWideUrl`                         | keyImage `DieselGameBox` → `OfferImageWide`                                                            |
| `logoUrl`                               | keyImage `DieselGameBoxLogo`                                                                           |
| `storeSlug`                             | GraphQL `pageSlug`, nullable; enrichment (slug + store-content) fetched on create or when null         |
| `thirdPartyStore`                       | `customAttributes.ThirdPartyManagedApp.value`                                                          |
| `playtimeMinutes`                       | playtime `totalTime`, `Math.floor(totalTime / 60)`                                                     |
| `lastPlayedAt`                          | derived: set to sync time when a new snapshot's minutes exceed the previous record; null on first sync |

`EpicGamePlaytime` — same shape as `GogGamePlaytime` (`timestampStart` nullable, `timestampEnd`, `playtimeMinutes`, `lastPlayedAt`), keyed on `epicId` (the `EpicGame` surrogate pk).

`EpicIgnoredItem` — mirrors `GogIgnoredProduct`, keyed on `appName`, `reason` one of `UE`, `DLC`, `MOD`, `MOBILE_ONLY`, `EDITOR_RESOURCE`, `PRIVATE`, `NOT_FOUND`, `MANUAL`. Worth having: Epic libraries are full of UE assets and free-giveaway DLC, and the catalog call is per-item so caching the skips saves a lot of requests.

Identity is the triple `(namespace, catalogItemId, appName)`. `appName` alone is the practical key: it is unique, stable, and is what both the playtime endpoint and the launch URI need. Store all three.

Art helpers (`shared/art.ts`) gain an Epic branch; Epic image URLs are absolute CDN links with no size formatter, so they are simpler than GOG's `{formatter}` templates.

## Differences from Steam and GOG that affect design

- **Two-step library.** Steam and GOG return titles with the owned list. Epic returns identifiers only; every game costs a catalog request. Batch by namespace where possible (`bulk/items` takes repeated `id` params for one namespace) and cache aggressively.
- **No last played.** Same as GOG, unlike Steam's `rtime_last_played`. Reuse the GOG grounding logic; do not design UI that assumes Epic gives a real last-played date.
- **Playtime in seconds, not minutes.** Confirmed by magnitude live (60.4h game reads as 217450), still pending confirmation against the launcher's own displayed hours. Everything else in the schema is minutes.
- **Heavy non-game noise.** UE marketplace assets, Fab items, mods, DLC, mobile-only titles, and third-party-managed entries (Ubisoft/EA) all arrive in the same list. Filtering is a first-class concern, not an afterthought as it was for GOG's three product types. Confirmed live: the same noise reaches the playtime endpoint too (DLC and UE artifacts both had entries), so playtime sync needs the same ignore list as the library sync, applied before any per-game total is computed.
- **Third-party-managed games** (`ThirdPartyManagedApp`) are owned via Epic but launch through another launcher. They are real games and should sync, but the launch URI is unreliable for them.
- **Short-lived codes and tokens.** The authorization code is single-use and expires quickly (same as GOG). Access token lifetime is confirmed at ~36h (`expires_in: 129483`) for the launcher client; refresh token lifetime is still unmeasured — confirm it before relying on a daily schedule.
- **No public documentation and no stable contract.** Everything here is reverse-engineered; Epic can and does change it. Errors must be non-fatal per game, as `07-Sync-Robustness.md` established.

## Open questions (verify against a real account)

Answered by the 2026-08-30 live test and removed: is `totalTime` seconds (yes, by magnitude — still want the launcher's own figure as a final check, see below); does `/all` omit last-played and include only nonzero artifacts (yes to both); does `authorization_code` return `display_name`/account identity (yes); does `bulk/items` accept multiple `id` params (yes); is `categories[].path` a usable DLC signal (no — `mainGameItem` only).

1. Refresh token lifetime for `launcherAppClient2`/`eg1` — not yet exercised, `expires_in` for the access token is confirmed (~36h) but `refresh_expires` is not.
2. Do we need `X-Epic-Device-ID` on the token request? Community docs list it as a header EGL sends; legendary omits it.
3. Does the catalog endpoint rate-limit under a full-library sync (hundreds of `bulk/items` calls), and at what point?
4. Are `keyImages` present for every owned title, or do older/free titles come back without any art? Only one title checked live (two image types, no logo).
5. Is the `pageSlug` GraphQL mapping present/stable for all titles, or does it 404 for some? Only one namespace checked live.
6. Does the launcher's `assets/Windows` endpoint add anything the library endpoint misses?
7. Confirm `totalTime` magnitude against the launcher's own displayed "hours played" for at least one game — seconds is near-certain from magnitude alone but not yet cross-checked against the UI.
8. Not yet exercised against a live account: connect flow end-to-end, full library sync (~250 catalog items), refresh grant.

## Implementation

Landed 2026-08-30, mirroring the GOG waves.

### Done

- **Wave 1 — auth** (e0b481f, 03e991b). `EpicUser` table. `lib/epic/api.ts`: `EpicApiError` (retriable/permanent), `getEpicLoginUri`, `getEpicToken`, `refreshEpicToken`, `getEpicAccount`. `lib/epic/service.ts`: `createOrUpdateEpicUser`, `handleRefreshToken`, `updateEpicUser`, single-account guard. `refreshTokenExpiresAt` from `refresh_expires_at`, falling back to `refresh_expires` seconds then a 30-day default.
- **Wave 2 — library** (f09acb6, 65a53e7). `EpicGame` + `EpicIgnoredItem` tables. `getEpicLibraryItems` (cursor loop), `getEpicCatalogItems` (batched per namespace). `updateEpicGames` with the full filter list (namespace/sandboxType pre-catalog, DLC/MOD/UE/MOBILE_ONLY/EDITOR_RESOURCE/NOT_FOUND post-catalog), per-item failure isolation, ignore cache. `refreshGameAggregates` after every write. `Game` treated as 1:N from the start (f09acb6).
- **Wave 2b — store enrichment** (65a53e7). `getEpicStoreSlug` (unauthenticated GraphQL) and `getEpicStoreContent` feed `storeSlug`/`releaseDate`/`publisher`/`description`; fetched on create or when `storeSlug` is still null, so it isn't re-fetched every sync.
- **Wave 3 — playtime** (65a53e7). `EpicGamePlaytime` table. `getEpicPlaytimes`, `recordEpicPlaytime`/`recordEpicPlaytimes` modelled on the GOG pair. `lastPlayedAt` derived (c1bfaec): set to sync time when a snapshot's `playtimeMinutes` exceeds the previous record, null on the first sync.
- **Wave 4 — surfacing** (1d75ad9). Art branch in `shared/art.ts`, `GameIcon`, `GameProviderRows` (`epicLaunchUrl` helper), game/organise pages, merge dialog.
- **Wave 5 — schedule** (09d6472). Queueable tasks `updateEpicUser`/`updateEpicGames`/`recordEpicPlaytimes`; scheduled `45 * * * *` → `record-epic-playtimes`, `10-59/15 * * * *` → `update-epic-user`, offset from GOG's cron minutes.
- **Connect page** (a77e866): `pages/providers/epic/index.vue` accepts either the pasted JSON blob or the raw `authorizationCode`, validated as 32 hex chars before enabling connect.

### Decisions made during implementation (supersede earlier text above)

- Playtime stored in **minutes**, not `playtimeSeconds`: `Math.floor(totalTime / 60)` at the API→service boundary, matching Steam/GOG columns.
- `EpicGame.epicId` is an autoincrement surrogate pk (not `id`); `appName` is a separate unique, not-null column. `EpicGamePlaytime.epicId` references `EpicGame.epicId`.
- `EpicIgnoredItem` keyed on `appName` (primary key), as documented above.
- `publisher`/`releaseDate`/`description` come from store-content enrichment, not the catalog item (catalog has neither a release date nor a publisher field).
