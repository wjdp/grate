---
type: task
status: in-progress
---

# Epic Games Store

Investigation 2026-08-30. Goal: Epic as a third provider alongside Steam and GOG — owned games, playtime, last played, art, launch/store links, scheduled sync.

No implementation yet. This doc records the API surface, what is verified against source, and the proposed shape.

## Verification key

- **Verified** — read directly in `derrod/legendary` (`legendary/api/egs.py`, `legendary/core.py`, `legendary/cli.py`, `legendary/models/game.py`, master), `lutris/lutris` (`lutris/services/egs.py`), `Heroic-Games-Launcher` (`src/backend/storeManagers/legendary/{library,games}.ts`), or `MixV2/EpicResearch` / `LeleDerGrasshalmi/FortniteEndpointsDocumentation` (community reverse-engineering docs with captured request/response examples).
- **Inferred** — consistent with the above but not stated anywhere; must be checked against a real account.

Nothing below has been run against a live Epic account.

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

Lifetimes: the captured example (Fortnite client) shows 2h access / 8h refresh. The launcher client is commonly reported as 8h access / ~24h refresh — _inferred_, verify on first connect and store `expires_at` verbatim rather than assuming. `expires_at` is returned, so `handleRefreshToken` can key on it exactly as the GOG one does.

Gotchas (verified in source unless noted):

- Tokens are bound to the client id they were issued for; a refresh token from another client will not work here.
- `token_type=eg1` yields a signed JWT (`eg1~...`) instead of a 16-byte session id. Legendary always requests `eg1`. Either works; `eg1` is what EGL sends.
- Send the launcher `User-Agent`: `UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit` (verified, `EPCAPI._user_agent`; legendary updates the version string from its own update feed). The store GraphQL host wants `EpicGamesLauncher/<version>` instead.
- Sessions can be revoked server-side (`errors.com.epicgames.oauth.corrective_action_required` requires the user to visit a `continuationUrl`) — surface that message rather than a generic failure.
- Single-account constraint mirrors GOG: one `EpicUser` row, reject a second `account_id`.

## Endpoints

| Purpose          | Method + URL                                                                                                                                                                                            | Notes                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Login page       | `GET https://www.epicgames.com/id/login?redirectUrl=<encoded redirect>`                                                                                                                                 | Redirect target is `https://www.epicgames.com/id/api/redirect?clientId=…&responseType=code` |
| Token / refresh  | `POST https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token`                                                                                                                   | Basic auth, form-encoded                                                                    |
| Verify session   | `GET https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/verify?includePerms=true`                                                                                                 | Returns `account_id`, `display_name`, `expires_at`                                          |
| Account info     | `GET https://account-public-service-prod03.ol.epicgames.com/account/api/public/account/{accountId}`                                                                                                     | `id`, `displayName`, `country`, `preferredLanguage`, `email`, `lastLogin`                   |
| Kill session     | `DELETE .../account/api/oauth/sessions/kill/{accessToken}`                                                                                                                                              | Unused by legendary; for a "disconnect" button                                              |
| Library items    | `GET https://library-service.live.use1a.on.epicgames.com/library/api/public/items?includeMetadata=true[&cursor=…]`                                                                                      | Everything owned, incl. non-installable/third-party titles                                  |
| Launcher assets  | `GET https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/Windows?label=Live`                                                                                             | Legacy; installable Windows builds only                                                     |
| Catalog metadata | `GET https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace/{ns}/bulk/items?id={catalogItemId}&includeDLCDetails=true&includeMainGameDetails=true&country=GB&locale=en-GB` | One namespace per call; response keyed by `catalogItemId`                                   |
| Playtime, all    | `GET https://library-service.live.use1a.on.epicgames.com/library/api/public/playtime/account/{accountId}/all`                                                                                           | `[{accountId, artifactId, totalTime}]`                                                      |
| Playtime, one    | `GET https://library-service.live.use1a.on.epicgames.com/library/api/public/playtime/account/{accountId}/artifact/{artifactId}`                                                                         | Same shape, single object                                                                   |
| Store slug       | `POST https://launcher.store.epicgames.com/graphql` — `Catalog.catalogNs(namespace).mappings(pageType:"productHome"){pageSlug}`                                                                         | Heroic's method for deriving a store URL                                                    |

All authenticated calls use `Authorization: bearer <access_token>`.

### Library listing

`records[]` entries (verified example): `namespace`, `catalogItemId`, `appName`, `productId`, `sandboxName`, `sandboxType`, `recordType`, `acquisitionDate`, `dependencies`. Pagination: `responseMetadata.nextCursor`, looped until absent (verified, `EPCAPI.get_library_items`); the cursor is base64 `{"offset":N}`, and `limit`, `platform`, `includeNs`/`excludeNs` are also accepted (community docs).

Library items alone are not enough — they carry no title. Titles, art and developer come from the catalog call, one request per `(namespace, catalogItemId)`.

Filtering, all verified in launcher source:

- `namespace === "ue"` → Unreal Marketplace asset, skip (legendary `skip_ue`).
- `sandboxType === "PRIVATE"` → skip (legendary).
- missing `appName` → skip (legendary).
- catalog `mainGameItem` present → it is DLC; legendary buckets it under `mainGameItem.id`, Heroic sets `is_dlc` from the same field.
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

There is no `releaseDate` on the catalog item. `creationDate` and `releaseInfo[].dateAdded` are the closest things; Heroic instead fetches `https://store-content.ak.epicgames.com/api/{lang}/content/products/{slug}` and reads `pages[type=productHome].data.meta.releaseDate`. Treat release date as best-effort and nullable, as GOG already is.

### Playtime

`GET .../playtime/account/{accountId}/all` returns a flat array of `{accountId, artifactId, totalTime}` (verified from a captured response in the Lele docs; the matching permission `library:public:{accountId}:playtime:all READ` is on our client).

- `totalTime` is **seconds** — _inferred_ from the write endpoint, which posts `startTime`/`endTime` ISO pairs, and from the magnitudes in the example (Fortnite 68363 ≈ 19h). Must be confirmed against a real account before we store it. `GogGame.playtimeMinutes` is minutes, so an Epic column should either be `playtimeSeconds` or convert on read.
- `artifactId` is the **`appName`** of the release, i.e. `releaseInfo[].appId` on the catalog item — _not_ the catalogItemId (verified, Lele "obtaining the artifact id"). So playtime joins to the library on `appName`.
- **There is no `lastPlayedTime` in either playtime response.** Both documented shapes are `{accountId, artifactId, totalTime}` only, and no other endpoint in the community docs exposes a last-played timestamp. This contradicts the common assumption that Epic hands us last played; treat it as _not available_ until a live account proves otherwise. Consequence: Epic behaves like GOG, not Steam — `lastPlayedAt` has to be derived from observed playtime changes, exactly as `recordGogPlaytime` already does.
- No session history and no per-date breakdown. Only a running total. Same shape of problem as GOG, so the same `…GamePlaytime` snapshot table works.
- Only games with playtime appear — _inferred_; the GOG bulk endpoint behaves this way and the example lists only played artifacts. Missing artifact = zero, as in `recordGogPlaytimes`.
- The launcher _writes_ playtime via `PUT .../playtime/account/{accountId}` and `/bulk`. We must never call these.

### Launch and store links

Launch URI: `com.epicgames.launcher://apps/{namespace}%3A{catalogItemId}%3A{appName}?action=launch&silent=true` (verified, Lutris `get_launch_arguments` builds `com.epicgames.launcher://apps/{ns}%3A{id}%3A{app}?action=launch`; `silent=true` is what EGL itself appends — _inferred_). Falls back to `com.epicgames.launcher://apps/{appName}?action=launch` when namespace/catalogItemId are unknown. Equivalent to the existing `goggalaxy://openGameView/{id}` link.

Store URL: `https://www.epicgames.com/store/p/{slug}` (`/store/product/{slug}` also resolves). The slug is not in the catalog item; Heroic queries `launcher.store.epicgames.com/graphql` for `Catalog.catalogNs(namespace: $ns).mappings(pageType: "productHome").pageSlug` and falls back to a slugified title. There is also `GET https://egs-platform-service.store.epicgames.com/api/v1/egs/mappings/{slug}?country=GB&locale=en` for the reverse direction (slug → sandbox/product), unauthenticated.

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

| Column                   | Source                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `id` (pk, autoincrement) | —                                                                                                     |
| `gameId` → `Game.id`     | link                                                                                                  |
| `appName` (unique)       | library `appName` = catalog `releaseInfo[].appId` = playtime `artifactId`                             |
| `namespace`              | library `namespace`                                                                                   |
| `catalogItemId`          | library `catalogItemId`                                                                               |
| `name`                   | catalog `title`                                                                                       |
| `description`            | catalog `description`                                                                                 |
| `developer`              | catalog `developer`                                                                                   |
| `publisher`              | _not provided_; leave null or reuse `developer`                                                       |
| `releaseDate`            | catalog `creationDate` / `releaseInfo[].dateAdded`, nullable                                          |
| `acquisitionDate`        | library `acquisitionDate` (nice-to-have; neither other provider has it)                               |
| `categories` (json)      | catalog `categories`                                                                                  |
| `boxArtTallUrl`          | keyImage `DieselGameBoxTall` → `OfferImageTall` → `DieselStoreFrontTall`                              |
| `boxArtWideUrl`          | keyImage `DieselGameBox` → `OfferImageWide`                                                           |
| `logoUrl`                | keyImage `DieselGameBoxLogo`                                                                          |
| `storeSlug`              | GraphQL `pageSlug`, nullable                                                                          |
| `thirdPartyStore`        | `customAttributes.ThirdPartyManagedApp`/`…Provider` (Ubisoft/EA titles that EGL cannot launch itself) |
| `playtimeSeconds`        | playtime `totalTime`                                                                                  |
| `lastPlayedAt`           | derived, not provided                                                                                 |

`EpicGamePlaytime` — same columns as `GogGamePlaytime` (`timestampStart` nullable, `timestampEnd`, `playtimeSeconds`, `lastPlayedAt`), keyed on `appName`.

`EpicIgnoredItem` — mirrors `GogIgnoredProduct`, keyed on `appName`, `reason` one of `UE`, `DLC`, `MOD`, `MOBILE_ONLY`, `EDITOR_RESOURCE`, `PRIVATE`, `NOT_FOUND`, `MANUAL`. Worth having: Epic libraries are full of UE assets and free-giveaway DLC, and the catalog call is per-item so caching the skips saves a lot of requests.

Identity is the triple `(namespace, catalogItemId, appName)`. `appName` alone is the practical key: it is unique, stable, and is what both the playtime endpoint and the launch URI need. Store all three.

Art helpers (`shared/art.ts`) gain an Epic branch; Epic image URLs are absolute CDN links with no size formatter, so they are simpler than GOG's `{formatter}` templates.

## Differences from Steam and GOG that affect design

- **Two-step library.** Steam and GOG return titles with the owned list. Epic returns identifiers only; every game costs a catalog request. Batch by namespace where possible (`bulk/items` takes repeated `id` params for one namespace) and cache aggressively.
- **No last played.** Same as GOG, unlike Steam's `rtime_last_played`. Reuse the GOG grounding logic; do not design UI that assumes Epic gives a real last-played date.
- **Playtime in seconds, not minutes** (pending confirmation). Everything else in the schema is minutes.
- **Heavy non-game noise.** UE marketplace assets, Fab items, mods, DLC, mobile-only titles, and third-party-managed entries (Ubisoft/EA) all arrive in the same list. Filtering is a first-class concern, not an afterthought as it was for GOG's three product types.
- **Third-party-managed games** (`ThirdPartyManagedApp`) are owned via Epic but launch through another launcher. They are real games and should sync, but the launch URI is unreliable for them.
- **Short-lived codes and tokens.** The authorization code is single-use and expires quickly (same as GOG). The refresh token is short-lived by comparison to GOG's, so a daily scheduled sync may find the session dead — connect will need re-doing more often than GOG. Confirm the actual refresh lifetime before relying on a schedule.
- **No public documentation and no stable contract.** Everything here is reverse-engineered; Epic can and does change it. Errors must be non-fatal per game, as `07-Sync-Robustness.md` established.

## Open questions (verify against a real account)

1. Is `totalTime` seconds? Compare one known game against the launcher's own "You've played" figure.
2. Does the `/all` playtime response really omit last-played, or does a live account return extra fields? Also: does it include zero-playtime artifacts?
3. Actual `expires_in` / `refresh_expires` for `launcherAppClient2` with `token_type=eg1`.
4. Does the `authorization_code` grant (as opposed to `exchange_code`) return `account_id` and `displayName`? Assumed yes.
5. Do we need `X-Epic-Device-ID` on the token request? Community docs list it as a header EGL sends; legendary omits it.
6. How large is a real library's `records` array, and how many catalog calls does a full sync cost? Does the catalog endpoint rate-limit, and at what point?
7. Does `bulk/items` accept multiple `id` params in one call in practice (all launchers send one at a time)?
8. Are `keyImages` present for every owned title, or do older/free titles come back without art?
9. Is the `pageSlug` GraphQL query stable enough to depend on, or should we slugify the title?
10. Does the launcher's `assets/Windows` endpoint add anything the library endpoint misses?

## Proposed implementation steps

Deliberately mirrors the GOG waves, so each lands independently.

**Wave 1 — auth.** `lib/epic/api.ts` with `EpicApiError` (retriable/permanent, copied from `GogApiError`), `getEpicLoginUri`, `getEpicToken`, `refreshEpicToken`, `verifyEpicToken`, `getEpicAccount`. `EpicUser` table + migration. `lib/epic/service.ts` `createOrUpdateEpicUser` / `handleRefreshToken` / `updateEpicUser`, single-account guard. Connect page accepting a pasted code or the JSON blob. Characterisation tests against recorded fixtures.

**Wave 2 — library.** `getEpicLibraryItems` (cursor loop), `getEpicCatalogItems`. `EpicGame` + `EpicIgnoredItem` tables. `updateEpicGames` with the full filter list, per-item failure isolation, ignore cache. `refreshGameAggregates` after writes.

**Wave 3 — playtime.** `getEpicPlaytimes`. `EpicGamePlaytime` table. `recordEpicPlaytime`/`recordEpicPlaytimes` modelled on the GOG pair, including the grounding branch for the first record. Aggregates updated to sum a third provider.

**Wave 4 — surfacing.** Art branch in `shared/art.ts`, `GameIcon`, game page description, "Open in Epic" launch URI and store link, playtime history table, provider row in the merge UI.

**Wave 5 — schedule.** Nitro tasks alongside the Steam and GOG ones.

Do wave 1 first and stop: several open questions above can only be answered with a live token, and the answers change waves 2 and 3.
