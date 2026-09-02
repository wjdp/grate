---
type: task
status: open
---

# DLC

Written 2026-09-02 against `8d65e2f`. Depends on [28](28-Steam-QR-Login.md) for Steam ownership; GOG and Epic parts stand alone.

## Problem

Stores expose DLC per game. Most is junk (cosmetics, soundtracks, map packs) but some is a real reason to return to a game (Phantom Liberty, Far Harbor, Space Age). grate currently throws DLC away at import (`GogIgnoredProduct` reason `DLC`, `EpicIgnoredItem` reason `DLC`; Steam never sees it). Want: meaningful DLC listed under its game with its own play state, junk hidden, cross-provider copies merged, owning provider visible.

## API findings (verified 2026-09-02)

| | Owned list | Full list per game | Parent link | Release date | Playtime | Art / metadata |
| --- | --- | --- | --- | --- | --- | --- |
| Steam | **Not via Web API key.** `GetOwnedGames` never returns DLC apps. Web session (QR login, doc 28) → `store.steampowered.com/dynamicstore/userdata` `rgOwnedApps`: 1367 apps, 663 DLC in dev account | PICS `extended.listofdlc` — **capped at 64** (Cities: Skylines 64 vs 76 real); store `appdetails.dlc` complete but rate-limited | PICS `common.parent` on the DLC app | PICS `steam_release_date` on 60%; `IStoreBrowseService/GetItems` (works with existing API key, bulk) has it for all live items | None — folded into parent | `GetItems`: price, review count/score, tag ids, header/capsule assets. PICS: no `library_assets_full` for 90% |
| GOG | `/user/data/games` owned ids include DLC (28 in dev) | base `v2/games/{id}._links.isRequiredByGames` | DLC `v2/games/{id}._links.requiresGames` (edition-specific: 4/28 point at an unowned Witcher 3 edition, `[A]` variants) | `globalReleaseDate` | `time_sum` 0 | icon/logo/boxArt links on some; cosmetics have empty description, tags, properties |
| Epic | library records include DLC entitlements (22 in dev) | main item with `includeDLCDetails=true` → `dlcItemList` | DLC item `mainGameItem.id` | weak: `releaseInfo[].dateAdded` is date added to Epic; store pages mostly lack it | **some DLC have playtime** (Control's two expansions, identical totals → duplicated parent time, not real) | keyImages; categories `addons` vs `games` inconsistent |

Volume (dev account): Steam 317/615 games list DLC, 2614 DLC ids, PICS fetch under 2s; 680 owned DLC-type apps across 148 parents. Feature dump of owned Steam DLC saved during exploration; regenerate via a debug page (below) rather than rely on it.

## Decisions (agreed)

- **DLC are child `Game` rows** (`parentId`). Reuses state, history, hidden, merge/split, provider rows, context menu. Lists exclude children by default.
- **Import all DLC of owned games**, owned and not. Unowned collapsed under a click on the game page.
- **Hidden by default via heuristic**: triage scores each DLC on import; positive signals unhide. Heuristic is tuneable from a debug page over real data; user overrides are never re-applied over.
- **Auto-merge siblings by normalised name** across providers once their parents are merged.
- **Game page only** for v1. No DLC in library, organise, dashboard, activity, stats, palette.
- Term: **DLC** in UI and code.
- Steam ownership via QR web login (doc 28). Steam DLC import runs only when a web session exists; otherwise skipped, GOG/Epic unaffected.

## Schema

Migration `0010_dlc.sql`:

```sql
ALTER TABLE Game ADD parentId integer REFERENCES Game(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE Game ADD hiddenByUser integer DEFAULT false NOT NULL;
CREATE INDEX Game_parentId_idx ON Game(parentId);
ALTER TABLE SteamGame ADD owned integer DEFAULT true NOT NULL;
ALTER TABLE GogGame ADD owned integer DEFAULT true NOT NULL;
ALTER TABLE EpicGame ADD owned integer DEFAULT true NOT NULL;
CREATE TABLE SteamStoreItem (... see below);
DELETE FROM GogIgnoredProduct WHERE reason = 'DLC';
DELETE FROM EpicIgnoredItem WHERE reason = 'DLC';
```

- `Game.parentId` — self reference; one level only (a child cannot have children; enforce in `lib`).
- `Game.hiddenByUser` — set true whenever `setGameHidden` is called by the user (all games). Triage re-runs only touch rows where false.
- `<Provider>Game.owned` — ownership is a per-provider fact. A child is "owned" if any provider row is owned. Existing rows default true.
- `SteamStoreItem` (source-scoped like `SteamAppInfo`/`SteamPicsMetadata`): `appId` PK → `SteamGame.appId`, `fetchedAt`, `type`, `priceFinalPence` nullable, `isFree`, `reviewCount`, `reviewPercentage`, `reviewScore`, `tagIds` json, `releaseDate`, `headerPath`, `capsulePath`. Filled from `GetItems` in batches (50 ids/call observed fine). Games can use it later too.
- `SteamGame` rows for DLC: `imgIconUrl`/`capsuleFilename` `""`, playtime nulls, flags false.
- Drizzle relations: `game.parent: one(game)`, `game.dlc: many(game)`. Migration tests: bump count to 11, add `SteamStoreItem` to `TABLES`, new date/bool columns to `DATETIME_COLUMNS`/native-storage checks, snapshot + journal.

## Import

All in each provider's `updateGames`, after base games, so parents exist. Progress messages "… dlc n/m". Never create a child whose parent is not a top-level `Game`.

### GOG (`lib/gog/service.ts`)

1. Stop ignoring `productType === "DLC"`. `PACK` stays ignored.
2. For each owned id whose detail is DLC: parents = `requiresGames` ids → `GogGame` rows → their `Game`s. First match wins. Create/update child `Game` + `GogGame` (`owned: true`, `productType: "DLC"`).
3. Orphans (no owned parent): fallback match on `isIncludedInGames`, then by name after stripping a trailing `[A]`/edition suffix against existing siblings. Duplicate of an existing sibling → `gogIgnoredProduct` reason `DLC_DUPLICATE`; no match → `DLC_ORPHAN`. Both re-evaluated on the next sync (delete before sync, unlike other reasons).
4. Unowned: for each top-level `GogGame`, `isRequiredByGames` ids not owned and not already a `GogGame` → fetch detail, create child with `owned: false`. Unfetchable → `NOT_FOUND` as today. Persisted child rows are not refetched on later syncs (same as games).

### Epic (`lib/epic/service.ts`)

1. `catalogIgnoreReason` no longer returns `DLC`. Library items with `mainGameItem` → parent = `EpicGame` with `catalogItemId === mainGameItem.id` in the same namespace; create child with `owned: true`. Parent not in library → `epicIgnoredItem` `DLC_ORPHAN`.
2. Unowned: parent catalogue fetch already uses `includeDLCDetails=true`; `dlcItemList` entries not in the library → child with `owned: false`, `appName` from `releaseInfo[0].appId` (unique index on `appName` still holds).
3. Release date: min `releaseInfo[].dateAdded`, else `creationDate`. Stored in the existing `releaseDate` column; no "approximate" flag, the weakness is documented here only.
4. Playtime: `recordEpicPlaytimes` will now find rows for DLC artifacts. Record them on the child (provider truth) but children are excluded from every aggregate (below), so the duplicated Control totals never double count.

### Steam (`lib/steam/service.ts`, needs doc 28)

1. Owned DLC ids = `rgOwnedApps` ∩ apps whose PICS `type === "DLC"` (also `Music`, `Video` — import as DLC, triage hides them). Parent = PICS `parent` → `SteamGame` → `Game`. Complete regardless of the 64 cap.
2. Unowned: PICS `listofdlc` of each top-level `SteamGame`, minus owned. Accept the 64 cap for v1 (8 games affected); note in UI nothing. Follow-up: `appdetails.dlc` for capped games.
3. Metadata: new queueable `updateSteamStoreItems` fetches `GetItems` for all DLC app ids (and later games), upserts `SteamStoreItem`; queued by `providerFollowUps` after a Steam games sync alongside PICS. PICS metadata task already covers DLC app ids once they are `SteamGame` rows — it gives `parent` and release dates.
4. No Steam web session → skip both steps, log once.

### Triage (`lib/dlcTriage.ts`)

Pure function `triageDlc(input): { hidden: boolean; reasons: string[] }` over a provider-neutral input `{ name, parentName, type, priceFinalPence, reviewCount, isFree, hasDescription, tagCount, provider }`. Applied at child creation; `hidden` written, `hiddenByUser` false.

Initial rules (tune on the debug page before merging):

- Junk name regex → hidden: soundtrack|ost|skin|cosmetic|outfit|costume|wallpaper|artbook|art book|season pass|pack (when preceded by map|scenario|weapon|item|starter|booster)|bundle|deluxe|upgrade|pre-?order|bonus|emote|avatar|livery|decal|key|`(Mac)`|`Mac` suffix|demo.
- Type Music/Video → hidden.
- Steam: `reviewCount >= 300` or `priceFinalPence >= 800` → visible. Free with no reviews → hidden.
- GOG: empty description and no tags → hidden.
- Nothing positive → hidden (the agreed fallback).
- Unowned rows get the same triage; ownership is a separate axis.

Debug page `app/pages/debug/dlc-triage.vue` + `GET /api/debug/dlc-triage`: every child with its inputs, current `hidden`, `hiddenByUser`, computed verdict and reasons; filter by provider/parent; button "Apply to untouched" (POST) re-running triage where `hiddenByUser = false`. This is how the heuristic gets tested on real data.

## Reads

- `getGames()` / `GET /api/games`: `WHERE parentId IS NULL`. Children never reach the library, palette, organise, duplicates, recent, merge candidates.
- `getGame(id)`: adds `dlc: DlcSummary[]` — `{ id, name, state, hidden, owned, releaseDate, providers: { steam?: { owned }, gog?: { owned }, epic?: { owned } }, playtimeMinutes }`, ordered `releaseDate ASC NULLS LAST, name ASC`. For a child, adds `parent: { id, name }`.
- `lib/activity.ts` and `refreshAllGameAggregates`, `findDuplicatePairs`, `getRecentGames`: exclude children. `refreshGameAggregates(parent)` sums only the parent's own provider rows (unchanged code; children are separate `Game`s).
- `shared/types/Game.ts` picks the new fields up via `Serialised`.

## Mutations

- `setGameState`: unchanged; works on children.
- `setGameHidden`: also sets `hiddenByUser = true`.
- `mergeGames(target, sources)`: additionally `UPDATE Game SET parentId = target WHERE parentId IN sources`, then `mergeSiblingDlc(target)`. Merging children: allowed only when all share a parent (else reject). Merging a child into a top-level game or vice versa: reject.
- `mergeSiblingDlc(parentId)`: group children by `normaliseGameName(name minus parent name prefix and separators and a trailing "DLC")`; groups with rows from different providers merge into the row with the earliest id. Owned wins nothing special — `owned` stays per provider row. Idempotent; also exposed as a debug/manage action.
- `splitGame(provider, providerId)` on a parent: children whose provider rows are all of that provider move to the new `Game`; others stay.
- Deleting a parent is impossible today (no delete path); `ON DELETE RESTRICT` guards it anyway.
- New `PATCH /api/games/:id/parent` is **out of scope** (manual reparenting) — orphans stay ignored until a sync can place them.

## UI (`app/pages/game/[id].vue`)

- New "DLC" section between provider rows and History, only when `dlc.length > 0`.
  - Rows: name, release year (muted), provider icons — one per provider the **parent** has, owned = normal, unowned = dimmed with tooltip "Not owned on Steam", absent = not shown. `GameStateBadge` and a compact `GameStateControl`. Whole row wrapped in `GameContextMenu` (Set state, Hide/Unhide; no Play/Open). Row links to the child's page.
  - Below the list: two collapsed toggles "N hidden" and "N not owned" (a row can be in both; unowned takes precedence for placement). Expanding shows the same rows, hidden ones with the eye-off icon.
  - Order: release date, then name. Manual ordering is a follow-up.
- Child page: breadcrumb "Part of *Parent*" above the hero; no provider Play/Open buttons unless the row has a launch (Steam standalone DLC like *Ethan Carter Redux* keep theirs); no Merge dialog; Split available; Manage section shows "Merge with sibling" limited to siblings.
- Stat tiles on the parent unchanged (children excluded from the parent's playtime).
- `useSetGameState` / `useSetGameHidden`: on a child, patch the parent's `dlc` entry in the `game-:id` cache rather than the `games` list.

## Tests

- Migration: columns, defaults, `SteamStoreItem`, ignored `DLC` rows removed.
- `lib/dlcTriage.test.ts`: table-driven over real names (Far Harbor visible via reviews; "Civilization V - Explorer's Map Pack" hidden; Temerian Armor Set hidden via empty GOG description; Phantom Liberty visible).
- GOG service: DLC becomes a child of the right `GogGame`'s game; `[A]` orphan → `DLC_ORPHAN`; unowned `isRequiredByGames` created `owned: false`; PACK still ignored.
- Epic service: `mainGameItem` child creation; `dlcItemList` unowned; DLC playtime recorded on child; parent aggregate unaffected.
- Steam service: no web session → no DLC rows; with session → owned ∩ type DLC parented via PICS `parent`; store items upserted.
- `lib/games`: `getGames` hides children; `getGame` returns ordered `dlc`; `mergeGames` re-points children and merges siblings by name across providers; sibling-only merge validation; split moves single-provider children; `setGameHidden` sets `hiddenByUser`.
- `activity`/`recent`/`duplicates` exclude children.
- Game page: DLC section render, collapsed groups, provider icon owned/unowned states; child page breadcrumb.

## Steps

1. Schema + migration + relations + test fixtures (`lib/fixtures/game.ts` helper `createDlc(parent, provider)`).
2. `lib/dlcTriage.ts` + tests. Debug page + endpoint.
3. GOG import + tests. Epic import + tests. (Independent.)
4. Reads: `getGames` filter, `getGame.dlc`, aggregate/activity/recent/duplicates exclusions.
5. Mutations: merge/split/hidden changes + `mergeSiblingDlc`.
6. Game page section + child page + composable cache handling.
7. After doc 28: Steam import, `SteamStoreItem`, `updateSteamStoreItems` queueable, follow-up wiring.
8. Tune triage on the debug page against the dev DB; commit thresholds.

## Out of scope

- Manual DLC ordering (release order only).
- Manual reparenting / attaching orphans.
- DLC in library, organise, dashboard, activity, stats, palette.
- Automation edges for DLC (no playtime signal; revisit with achievements: Steam `GetPlayerAchievements` on the parent exposes DLC achievements and could infer "played").
- Bundles/season passes as containers (Steam season pass apps, GOG `PACK`, Epic passes) — imported as DLC rows and hidden by triage; not expanded into members.
- Steam `listofdlc` cap: `appdetails.dlc` backfill for the handful of games over 64.
- Prices/"buy" affordances for unowned DLC.

## Open questions

- Triage thresholds (review count, price) — decide on the debug page with real data.
- Should unowned DLC be created for parents that are themselves hidden? Proposed: no, skip hidden parents entirely to cut noise.
- Epic release dates are unreliable; accept "date added to Epic" or leave null and sort by name?
- GOG orphan `[A]` variants: ignore silently (proposed) or surface on the debug page?
