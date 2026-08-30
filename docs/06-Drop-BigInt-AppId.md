---
type: task
status: done
---

# Drop `BigInt` for Steam appids

`SteamGame.appId`, `SteamAppInfo.appId`, `SteamGamePlaytime.steamAppId` are `BigInt`. Steam appids are 32-bit; `Number` is safe. Only `SteamUser.steamId` (64-bit SteamID) needs `BigInt`, and even that can be a `String` since it's never used arithmetically.

Cost today: `server/bigint.ts` patches `BigInt.prototype.toJSON` (lossy — parses to `Number` anyway), `appid: z.number().transform(BigInt)` in `lib/steam/api.ts`, `bigint` params threaded through `populateStoreData`, `getPlaytimeRecords`, art routes, `PlayButton` props typed `number | string`.

## Steps

1. Migration: change the three columns to `Int`; `steamId` to `String`. SQLite stores both as INTEGER so the table rewrite Prisma generates preserves values; for `steamId` → TEXT, SQLite casts on copy — verify on a DB copy.
2. Remove `.transform(BigInt)`, `bigint` types, `server/bigint.ts` and its `nitro.plugins` entry.
3. Fixtures: `faker.number.bigInt()` → `faker.number.int({ max: 2_000_000 })`.
4. Prefer doing this before [02](02-Prisma-To-Drizzle-Migration.md) so the Drizzle schema never needs `mode: "bigint"`.

## Under Drizzle (post-[02](02-Prisma-To-Drizzle-Migration.md))

Step 1 is now a TypeScript-type-only change for the three appid columns: `bigint()` → `integer()` in `db/schema.ts`. SQLite storage is identical, so no migration is needed. `steamId` can stay BIGINT, or become TEXT via a real migration.

## Outcome

Landed as Drizzle migration `0001_native_types` (see [02](02-Prisma-To-Drizzle-Migration.md)): the three appid columns are `integer`, `SteamUser.steamId` is `text`, and `server/bigint.ts` and every `bigint` signature are gone.

## Verification

Tests + typecheck green; `/art/steam/:appId/:type` and tRPC `game` responses unchanged for a known appid.
