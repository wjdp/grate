---
type: task
status: in-progress
---

# Test infrastructure

## Found 2026-08-30

- `test/db.ts` `flushDb` joined all deletes into one `$executeRawUnsafe` call; SQLite executes only the first statement, so only `SteamGamePlaytime` was ever cleared. Fixed: one statement per table.
- Test files ran in parallel against a single `test.db`; files flushed each other's rows mid-test. Fixed: `fileParallelism: false` in `vitest.config.ts`.
- Coverage before today: three `recordPlaytime` cases and a store snapshot. Now: `lib/games`, `lib/gameAggregates`, `lib/steam/service`, `lib/gog/service` characterised.

## Remaining

1. Per-file in-memory DB instead of a shared file, so parallelism can return. Blocked on [02](02-Prisma-To-Drizzle-Migration.md) — Prisma needs a file URL and its own migrate CLI; with better-sqlite3 it's `new Database(":memory:")` + `migrate()` in `beforeAll`.
2. `pnpm test:db:create` must be run manually before tests and after every migration. Until (1), add a vitest `globalSetup` that runs it.
3. HTTP-level tests for tRPC routers and Nitro routes (`/art/steam/...`, `/health`) via `@nuxt/test-utils` `setup()`. None exist.
4. Component tests: only `.story.vue` files exist; no assertions.
5. CI: no workflow runs tests. Add `lint:ci`, `typecheck`, `test --run`.
6. Fixture generators (`lib/*/fixtures/fake.ts`) duplicate the Prisma schema by hand; consider `@anatine/zod-mock`-style generation from the zod API schemas so API shape changes fail loudly.
