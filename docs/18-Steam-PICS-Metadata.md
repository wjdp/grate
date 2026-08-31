---
type: task
status: done
---

# Steam PICS metadata and library assets

Written 2026-08-31 against `04a038d`. Follow-up to [14](14-Art-Caching.md)/[15](15-Art-Misses-And-Fallbacks.md).

## Problem

`getSteamArtUrls` builds legacy fixed-name CDN URLs (`steamcdn-a.akamaihd.net/steam/apps/<appId>/library_600x900_2x.jpg` etc). Newer apps don't publish assets at those paths: app 2950790 (_IRON NEST_, 2026 release) serves only `library_hero.jpg` there — logo, header, capsule all 404, so grate shows a hero and nothing else while the Steam client shows the full set. This will cover a growing share of the library.

The real assets live at per-asset content-hashed paths:

```
https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appId>/<path>
e.g. 2950790/91a172cd…4d75/library_capsule.jpg
```

The paths come from appinfo (`common.library_assets_full`), distributed over Steam's PICS system — not exposed by any plain web API. Verified (2026-08-31): anonymous PICS logon returns `library_assets_full` for both new (2950790) and old (220, 400, 620, 1245620) apps, and every returned path resolves on the CDN. Old apps return legacy-style paths through the same field (`ac2f074d…0082/library_600x900.jpg`, bare `logo.png`), so one code path covers the whole library. **Paths are opaque — store verbatim, never construct.**

The same `appinfo.common` response also carries per-app metadata grate lacks or currently scrapes from the rate-limited appdetails endpoint — review summary, Deck compatibility, tags, franchise, release date — so this task stores that too.

## Dependency: `steam-user`, not our own PICS client

Implementing PICS ourselves means a full Steam CM session: CM server discovery, protobuf message framing, channel encryption/session negotiation, heartbeats, and binary VDF appinfo parsing — thousands of lines tracking an unversioned Valve protocol. `steam-user` (DoctorMcKay, MIT, maintained ~10 years, the de-facto Node Steam client) does exactly this; anonymous logon needs no credentials or API key. Measured: logon ~850ms, 5-app `getProductInfo` ~250ms; it auto-chunks large batches. ~54 transitive packages, server-only. Decision: **take the dependency**, isolate it behind one module so nothing else imports it.

Docker: outbound CM connections (TCP 27017–27050, WebSocket 443 fallback) — fine from a container, no Steam install needed. Anonymous sessions persist no machine auth state.

## Design

### 1. PICS wrapper — `lib/steam/pics.ts`

Only file importing `steam-user`. One function:

```ts
getPicsMetadata(appIds: number[]): Promise<Map<number, SteamPicsMetadata>>
```

Logs on anonymously, one `getProductInfo` batch, logs off. Maps `appinfo.common`:

**Library assets** (`library_assets_full`, english variants only):

- `library_capsule.image` / `.image2x` → capsule paths (same for hero, hero_blur, logo, header).
- `library_logo.logo_position` → json (pinned_position, width_pct, height_pct) for future logo-over-hero rendering.
- `common.icon` → icon hash.

**Metadata:**

- `review_score` (summary enum, 9 = Overwhelmingly Positive), `review_percentage` (0–100).
- `steam_deck_compatibility.category` (0 unknown / 1 unsupported / 2 playable / 3 verified), plus `steamos_compatibility` and `steam_machine_compatibility` from the same block. Test detail not stored.
- `store_tags` → ordered array of tag ids.
- `associations` → ordered array of `{ type, name }` (developer/publisher/franchise; franchise is new to grate).
- `steam_release_date` (epoch; firmer than the appdetails display-string parse), `original_release_date` when present.
- `name_localized`, `supported_languages` → json as-is.
- `oslist`, `controller_support` → text.
- PICS `changenumber` → stored for future incremental refresh; unused for now.

Missing app / missing field → nulls, not errors. Timeout + `error` event → thrown `SteamServiceError`.

### 2. Storage — new tables

```ts
export const steamPicsMetadata = sqliteTable("SteamPicsMetadata", {
  appId: integer()
    .primaryKey()
    .references(() => steamGame.appId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  fetchedAt: datetime().notNull(),
  changenumber: integer(),
  // library assets — opaque relative paths
  capsulePath: text(),
  capsule2xPath: text(),
  heroPath: text(),
  hero2xPath: text(),
  heroBlurPath: text(),
  logoPath: text(),
  logo2xPath: text(),
  headerPath: text(),
  header2xPath: text(),
  logoPosition: json().$type<SteamLogoPosition | null>(),
  iconHash: text(),
  // metadata
  reviewScore: integer(),
  reviewPercentage: integer(),
  deckCompatibility: integer(),
  steamosCompatibility: integer(),
  steamMachineCompatibility: integer(),
  storeTags: json().$type<number[] | null>(),
  associations: json().$type<SteamAssociation[] | null>(),
  steamReleaseDate: datetime(),
  originalReleaseDate: datetime(),
  nameLocalized: json().$type<Record<string, string> | null>(),
  supportedLanguages: json().$type<Record<string, unknown> | null>(),
  osList: text(),
  controllerSupport: text(),
});
```

Named `SteamPicsMetadata` rather than `SteamGameMetadata`: source-scoped like the existing `SteamAppInfo` (store appdetails scrape), so the two metadata tables read as siblings by origin and neither claims to be _the_ metadata table. One table for assets + metadata — same source, same fetch, same lifecycle; splitting buys nothing. Not columns on `SteamGame`: different lifecycle (refetched wholesale), all nullable, keeps the sync diff small.

Tag ids need names. `IStoreService/GetTagList` works keyless (verified) and returns the full id→name map in one call:

```ts
export const steamTag = sqliteTable("SteamTag", {
  tagId: integer().primaryKey(),
  name: text().notNull(),
});
```

Refreshed by the same task (one HTTP GET, upsert all).

### 3. Fetch task — `queueable/updateSteamPicsMetadata`

- Fetches all `SteamGame` appIds in one PICS session, upserts rows, `fetchedAt = now`; refreshes `SteamTag` from GetTagList.
- Queued automatically at the end of `updateSteamGames` (new games need art immediately); also a tasks-page button for manual refresh; plus a scheduled monthly run (`scheduled/update-steam-pics-metadata.ts`) to pick up revisions on existing games.
- When an upsert changes any asset path for an app, delete that app's cached art files and `.missing` markers (`data/art/steam/<appId>/`) so [15]'s negative cache doesn't pin the old 404s for 7 days.

### 4. Art resolution — `resolveSteamArtSources`

Stored path → `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appId>/<path>`, prepended to the existing legacy candidates (chain semantics from [15] unchanged; no new art types):

| Art type                      | Candidates (in order)                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `poster`                      | `capsule2xPath`, `capsulePath`, legacy `library_600x900_2x`, `library_600x900`, `header.jpg` |
| `posterSmall`                 | `capsulePath`, legacy `library_600x900`                                                      |
| `hero`                        | `hero2xPath`, `heroPath`, legacy `library_hero`                                              |
| `logo`                        | `logo2xPath`, `logoPath`, legacy `logo.png`                                                  |
| `header`                      | `headerPath`, legacy `header.jpg`                                                            |
| `icon`                        | `imgIconUrl` (unchanged, primary), `iconHash` fallback                                       |
| `background`, `backgroundV6B` | unchanged legacy (no PICS equivalent)                                                        |

No row / all-null row → legacy chain as today, so behaviour without a fetch run is identical to current.

### 5. Debug page

`debug/steam-art.vue` additionally lists the stored PICS paths for the entered appId (small server endpoint or reuse of art health data), so legacy vs PICS coverage is visible per app.

### Out of scope: surfacing metadata in the UI

This task stores the metadata; sorting/filtering by review score, Deck badge on game pages, tag chips etc. are follow-up UI work once the data exists.

## Testing

- `pics.ts` mapping: unit test against a fixture of the raw `appinfo.common` shape captured from 2950790 + 220 (hashed, legacy-relative, and bare-filename paths; missing fields; metadata fields incl. absent review scores on unreleased apps).
- `sources.ts`: candidate ordering with/without a `SteamPicsMetadata` row.
- No live CM connection in tests; `steam-user` mocked at the `pics.ts` boundary.

## Decisions

1. Refresh: post-sync queue + manual button + scheduled monthly. (PICS `changenumber` change detection deferred; column stored ready for it.)
2. All image columns kept, including `heroBlurPath` and `logoPosition` — likely future use (logo-over-hero UI).
3. Icon: `imgIconUrl` (GetOwnedGames) stays primary — PICS `icon` is the same community hash (verified on 2950790), so switching buys nothing; all 615 dev rows have it. `iconHash` stored anyway as a free fallback for any future row where GetOwnedGames returns an empty hash (delisted apps).
4. Metadata stored now in the same table/fetch (review summary, Deck compatibility, tags + keyless GetTagList name map, associations, release dates, localised names, languages, oslist, controller support, changenumber); UI surfacing is follow-up.
