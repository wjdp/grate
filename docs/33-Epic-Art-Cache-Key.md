---
type: task
status: done
---

# Epic art cache key

Key Epic art on the store's `catalogItemId` instead of the `EpicGame` autoincrement `epicId`, and invalidate cached Epic art when sync sees a game's art URLs change.

## Problem

Art is cached at `data/art/<provider>/<id>/<type>.<ext>` and served from `/art/<provider>/<id>/<type>`. Steam keys on `appId` and GOG on `gogId`, both store identifiers. Epic keys on `epicId`, the surrogate autoincrement primary key of `EpicGame`.

Epic's library API returns items in unstable order, so any re-import (fresh DB, deleted rows, dev DB rebuilt) assigns different `epicId`s to the same games. Files cached under the old numbering are then served for the wrong game. Observed 2026-09-12 in `dev.db`: game 650 (Grand Theft Auto V, epicId 13) showed The Alto Collection's art; `data/art/epic/13/poster.jpg` had the md5 embedded in Alto's CDN URL, and dozens of other Epic games were similarly shifted.

A second, smaller gap: Epic CDN URLs embed a content hash, so a changed `boxArtTallUrl` / `boxArtWideUrl` / `logoUrl` means new art, but sync updates the row without dropping the cache. Steam already invalidates on PICS refresh (`updateSteamPicsMetadata.ts`).

## Decisions

- Key: `catalogItemId`. 32 lowercase hex, unique across the author's 241 rows, URL-safe, and the identifier Epic's catalogue art actually belongs to. `appName` was the alternative (has the unique index) but is mixed-format.
- Old `data/art/epic/<epicId>/` directories are left orphaned. No boot-time wipe or rename. The new route rejects numeric Epic ids, so they are unreachable; `rm -rf data/art/epic` reclaims the space. Note this in `docs/30-Art-Sizing-And-Disk.md`.
- Invalidate on art URL change in the same task.
- `epicId` stays the primary key; playtime rows, provider rows UI and corrections keep using it. This task changes only the art key.

## Changes

### `shared/art/types.ts`

`ArtKey.id` becomes `number | string`. Add and export an `EPIC_ART_ID_PATTERN = /^[0-9a-f]{32}$/` next to the Epic types, with a comment that the id is the catalogue item id and doubles as path-traversal protection for the cache directory.

### `shared/art.ts`

`artUrl` / `artUrlWhenPresent` accept `number | string`. Epic branch of `getArtUrls` passes `epicGame.catalogItemId`.

### `server/routes/art/[provider]/[id]/[type].ts`

Per-provider id validation: steam and gog keep `z.coerce.number().int().positive()`; epic uses `z.string().regex(EPIC_ART_ID_PATTERN)`. Invalid still 400s.

### `server/services/art/sources.ts`

`resolveEpicArtSources(catalogItemId: string, …)` looks up `epicGame` by `catalogItemId`. Two rows sharing a catalogue item (not seen, but not prevented) share art, which is correct.

### `server/services/art/paths.ts` and friends

`artDirectory` already interpolates `id`; nothing changes beyond the type. Check `missing.ts`, `variants.ts`, `fetch.ts`, `cache.ts` compile with the widened type.

### `server/tasks/queueable/cacheArt.ts`

Epic rows map `id: row.catalogItemId`. Widen the local `id: number` types.

### Schema and migration

Add `index("EpicGame_catalogItemId_idx").on(table.catalogItemId)` to `epicGame` in `server/database/schema.ts`. Migration `server/database/migrations/0012_epic_catalog_item_index.sql`:

```sql
CREATE INDEX `EpicGame_catalogItemId_idx` ON `EpicGame` (`catalogItemId`);
```

Regenerate the snapshot the way earlier migrations did (`meta/0012_snapshot.json`, `meta/_journal.json`), matching the hand-written convention of the existing files.

### `server/providers/epic/service.ts`

In `updateOrCreateEpicGame`, existing-row branch: after the update, if any of `boxArtTallUrl`, `boxArtWideUrl`, `logoUrl` differ between `existing` and `fields`, call `deleteCachedArt({ provider: "epic", id: existing.catalogItemId })`. Import from `~~/server/services/art`.

### Docs

- `docs/11-Epic-Games.md`: note that art is keyed on `catalogItemId`, not `epicId`.
- `docs/30-Art-Sizing-And-Disk.md`: note orphaned numeric `data/art/epic/<n>/` dirs from before this change and the manual cleanup.

## Tests

- `shared/art.test.ts`: Epic URLs use the catalogue item id.
- `test/api/artHealth.e2e.test.ts`: `/art/epic/999999/poster` now 400s (numeric id invalid); add a 404 case with a well-formed unknown 32-hex id; add a 400 case for a traversal-shaped id.
- `server/services/art/sources.test.ts`: Epic source resolution by `catalogItemId`.
- `server/tasks/queueable/cacheArt.test.ts`: Epic rows enqueue by `catalogItemId`.
- Epic service test: updating a row with a changed `boxArtTallUrl` calls `deleteCachedArt` with the catalogue item id; unchanged URLs do not.

## Verification

```sh
pnpm typecheck && pnpm lint:ci && pnpm test
```

Manual, after merge: `pnpm db:migrate`, open an Epic game page, confirm the art URL is `/art/epic/<32 hex>/poster` and the image matches the game.

## Out of scope

- Renaming or wiping old cache directories.
- Changing `EpicGame`'s primary key or any non-art use of `epicId`.
- GOG or Steam invalidation changes.
