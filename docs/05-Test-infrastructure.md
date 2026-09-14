---
type: task
status: done
---

# Test infrastructure

## Found 2026-08-30

- `test/db.ts` `flushDb` joined all deletes into one `$executeRawUnsafe` call; SQLite executes only the first statement, so only `SteamGamePlaytime` was ever cleared. Fixed: one statement per table.
- Test files ran in parallel against a single `test.db`; files flushed each other's rows mid-test. Fixed: `fileParallelism: false` in `vitest.config.ts`.
- Coverage before today: three `recordPlaytime` cases and a store snapshot. Now: `server/services/games`, `server/services/gameAggregates`, `server/providers/steam/service`, `server/providers/gog/service` characterised.

## Update 2026-08-30

Coverage since grown: `server/providers/epic/service`, `server/services/activity`, `server/providers/steam/store`, `server/database/migrate`, `server/database/realDb`, `shared/steam-profile` all tested. tRPC replaced by Nitro `/api` routes.

## Remaining

1. ~~Per-file in-memory DB instead of a shared file, so parallelism can return.~~ Done: `DATABASE_URL=":memory:"` plus `test/setup.ts` running `runMigrations`; each file has its own module graph, hence its own database. `fileParallelism` is back to the default.
2. ~~`pnpm test:db:create` must be run manually before tests and after every migration.~~ Done: script removed, no database file to create.
3. ~~HTTP-level tests for tRPC routers and Nitro routes via `@nuxt/test-utils` `setup()`. None exist.~~ Done: `test/api/routes.e2e.test.ts` covers `/api/games`, `/api/games/:id`, `PATCH /api/games/:id/state`, `/api/tasks`; `test/api/artHealth.e2e.test.ts` covers `/health` and `/art/steam/...`, with `DATA_DIR` made env-overridable so the art route can be pointed at a fixture directory.
4. ~~Component tests: none. (`.story.vue` files removed in the UI overhaul.)~~ Done for the logic-bearing components: `app/components/{HistoryGrid,GameStateControl,GameProviderRows}.test.ts`, colocated as server-side tests are. `happy-dom` plus a per-file `// @vitest-environment nuxt` pragma and `mountSuspended` from `@nuxt/test-utils/runtime` gets auto-imports and Nuxt UI components; everything else stays on the node environment. `HistoryGrid` covers the leap-year/weekday-offset grid, cell titles and the amber buckets; `GameStateControl` drives the real `USelectMenu` and asserts the emitted state (including the null unsorted case); `GameProviderRows` covers row ordering across providers, playtime/last-played fallbacks, the protocol URLs, the split control being hidden for a single row, and split success/failure with `/api/games/split` stubbed via `registerEndpoint` and `navigateTo` mocked.
5. ~~CI: no workflow runs tests.~~ Done: `main.yml` gates release on `lint:ci`, `typecheck`, `vitest`.
6. ~~Fixture generators (`server/providers/*/fixtures/fake.ts`, now steam/gog/epic) duplicate the Drizzle schema by hand; consider `@anatine/zod-mock`-style generation from the zod API schemas so API shape changes fail loudly.~~ Done: the fixtures now parse through the exported zod API schemas, so a shape change fails loudly. Caveat: the Epic and Steam schemas are loose, so renaming an optional field still passes silently.
