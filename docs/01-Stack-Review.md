---
type: review
status: open
date: 2026-08-30
---

# Stack review

Assessed 2026-08-30 while adding GOG playtime sync (commit at time of review: `caddc60`). Snapshot; not updated.

Stack: Nuxt 3, Nitro tasks (experimental), tRPC v10 via trpc-nuxt, Prisma 6 on SQLite, vitest, pnpm, Docker with `prisma migrate deploy` on boot.

## What hurts

| #   | Problem                      | Evidence                                                                                                                                                                                                                                                                          | Task                                    |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | No working typecheck         | `pnpm typecheck` fails: no `vue-tsc`. `server/tasks/router.ts` can drift from `TASK_NAMES` unnoticed.                                                                                                                                                                             | [03](03-Enable-Typecheck.md)            |
| 2   | Prisma friction              | `@prisma/nuxt` 0.3.0 needs a vite alias hack for `.prisma/client/index-browser`; `prisma generate` step in Docker + openssl; `$executeRawUnsafe` silently ran only the first of several statements in `flushDb`; can't order/filter across optional relations (`getRecentGames`). | [02](02-Prisma-To-Drizzle-Migration.md) |
| 3   | Test infra                   | Single shared SQLite file for all test files, ran in parallel; `flushDb` was a no-op for most tables. Coverage was ~zero outside `recordPlaytime` until 2026-08-30.                                                                                                               | [05](05-Test-Infrastructure.md)         |
| 4   | `BigInt` for `appId`         | Forces `server/bigint.ts` JSON patch and `@ts-ignore`s. Steam appids fit `Number`; only `steamId` is 64-bit.                                                                                                                                                                      | [06](06-Drop-BigInt-AppId.md)           |
| 5   | Server code in client bundle | `pages/providers/gog/index.vue` imports `lib/gog/api.ts` (client secret, fetch code). Secret is the public launcher one, but the boundary is missing.                                                                                                                             | [04](04-Server-Only-Provider-Code.md)   |
| 6   | Sync robustness              | Serial per-game HTTP, no retry, transient errors treated as 404 and skipped; GOG refetches every DLC/404 id each run.                                                                                                                                                             | [07](07-Sync-Robustness.md)             |
| 7   | Duplicate `Game` rows        | Both providers always create a new `Game`; a title owned on Steam and GOG becomes two games with two states.                                                                                                                                                                      | [08](08-Cross-Provider-Game-Linking.md) |

## Recommended order

1. Finish GOG playtime on Prisma (in flight, [09](09-GOG-Playtime.md)).
2. 03 typecheck — cheap, catches the most.
3. 05 tests — largely done as part of GOG work; remainder is per-file in-memory DB, which lands naturally with 02.
4. 02 Drizzle — do once tests exist; they are the safety net.
5. 06, 04, 07, 08 in any order.
