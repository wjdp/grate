---
type: task
status: todo
---

# Correct the app structure to Nuxt conventions

## Problem

Nuxt 4 defines the layout: `app/` client, `server/` Nitro-only, `shared/` isomorphic (`#shared`), plus `public/`, `layers/`, `modules/`. grate adds two root directories Nuxt knows nothing about:

- `lib/` — a grab-bag: provider clients, domain services, the DB client, SSE types, test factories
- `db/` — Drizzle schema, migrations, migrate CLI

This invented a bespoke boundary ("`lib/` is server-only") when Nuxt already supplies one, and the cost shows:

- `nuxt.config.ts` `rootDirsOutsideNuxtProjects` bolts `lib/`, `db/` and `test/` into the *app* tsconfig so they get typechecked at all — under the DOM lib rather than Nitro's.
- Nothing enforces the boundary. `app/pages/debug/steam-art.vue` imports `~~/server/art/types` and `~~/db/schema`; eight `app/` files and `shared/types/Game.ts` type-import from `~~/lib/`. Harmless today (pure constants, `import type`), but the original incident — `getGogLoginUri` pulling `lib/gog/api.ts` with its client secret into the browser bundle — is the same shape.
- The idiomatic Drizzle-on-Nuxt layout (Nuxt docs, NuxtHub) is `server/database/schema.ts` + `server/database/migrations/`.

Already done from the earlier version of this task: `shared/providers/{gog,epic,index}.ts` hold the client-safe provider bits (public client ids, login URI builders, provider union, labels, launch/store URLs); secrets stay server-side.

## Non-issues

- **Secrets in `process.env`.** Only `DATA_DIR`, `DATABASE_URL`, `TZ` are read. Steam session refresh token lives in the `SteamUser` row; GOG/Epic client secrets are the public launcher constants. No `runtimeConfig` migration needed, and the DB client runs outside Nitro (drizzle-kit, migrate CLI) so `useRuntimeConfig` would not fit anyway.
- **ESLint.** Not used; Biome 2.5 has `style/noRestrictedImports` and lints `.vue`.

## Target layout

```
app/                       client (unchanged)
shared/                    isomorphic: types, schemas, pure helpers, client-safe provider bits
  sse.ts                   was lib/hooks.ts (SSE message types only)
  art/types.ts             ART_PROVIDERS, *_ART_TYPES (from server/art/types.ts)
server/
  api/ routes/ plugins/ tasks/ sse.ts …   Nitro-registered (unchanged)
  art/                     unchanged
  database/                was db/: schema.ts, migrations/, migrate.ts, migrate-cli.ts
    client.ts              was lib/db.ts
  providers/               server half of each provider; mirrors shared/providers/
    steam/ gog/ epic/      api.ts, service.ts, fixtures/, tests
    jobs.ts                was lib/providerJobs.ts
    rows.ts                was lib/gameProviders.ts
  services/                domain logic over the DB
    games.ts gameAggregates.ts duplicates.ts activity.ts playtimeTimeline.ts settings.ts
test/
  fixtures/game.ts         was lib/fixtures/game.ts
```

Why this shape:

- Only `server/{api,routes,middleware,plugins,tasks,utils}` are auto-registered by Nitro, so `database/`, `providers/`, `services/` are plain modules with no auto-import side effects.
- **Not `server/utils/`**: Nitro auto-imports top-level files there, so `games.ts` exporting `getGames` would become a global — collides with the explicit-import style used throughout.
- `providers/` under `server/` and `shared/` share names, so each provider has an obvious server half and client half. `docs/21-Providers.md` gets simpler.
- `services/` is generic but honest; `domain/` or `games/` would not fit `settings.ts`. Putting them loose at `server/` root (beside `sse.ts`, `files.ts`, `constants.ts`) is legal but crowded next to seven directories.
- Provider `fixtures/` stay co-located; nothing in prod imports them and Nitro bundles by import graph.

Rule: `app/` and `shared/` never import `~~/server/**`. Anything the client needs lives in `shared/`.

## Steps

0. **Delete the Prisma adoption path.** `db/adopt/` holds the old Prisma migration SQL for adopting a pre-Drizzle database ([02](02-Prisma-To-Drizzle-Migration.md)). Every install is on Drizzle now, so remove:
   - `db/adopt/`
   - in `db/migrate.ts`: `adoptPrismaDatabase`, `adoptSqlPath`, `appliedPrismaMigrations`, `recordPrismaMigration`, `recordDrizzleBaseline`, `PRISMA_MIGRATIONS_COVERED_BY_BASELINE`, `FINAL_PRISMA_MIGRATION`, and the `_prisma_migrations` branch in `runMigrations`. Keep `migrateWithoutForeignKeyEnforcement`.
   - adoption cases in `db/migrate.test.ts` (`fixtureAtPrismaHead` and anything reading `db/adopt`) and the "adoption of a real database" describe in `db/realDb.test.ts`
   - `db/scripts/buildFixture.ts`, `test/fixtures/prisma-at-gog_game.sqlite`, `test/fixtures/README.md` (all exist only to exercise adoption)
   - Dockerfile `COPY … /app/db/adopt`
   Do this before the moves so the renames touch less.
1. **Move `db/` → `server/database/`.** `git mv`, plus `lib/db.ts` → `server/database/client.ts`. Rewrite `~~/db/` → `~~/server/database/` and `~~/lib/db` → `~~/server/database/client`. Update `drizzle.config.ts` (`schema`, `out`), `package.json` `db:migrate`, Dockerfile `COPY` line for `migrations`.
2. **Move providers.** `lib/{steam,gog,epic}/` → `server/providers/`; `lib/providerJobs.ts` → `server/providers/jobs.ts`; `lib/gameProviders.ts` → `server/providers/rows.ts`. Rewrite imports.
3. **Move services.** `lib/{games,gameAggregates,duplicates,activity,playtimeTimeline,settings}.ts` + tests → `server/services/`. Rewrite imports.
4. **Move client-needed types to `shared/`.**
   - `lib/hooks.ts` → `shared/sse.ts` (it is only types; `server/sse.ts` keeps the hookable bus)
   - `DailyPlaytime` from `activity.ts` → `shared/types/`
   - `ART_PROVIDERS`, `*_ART_TYPES` and their types → `shared/art/types.ts`; `server/art/types.ts` re-exports or is deleted
   - `steam-art.vue`: replace the `~~/db/schema` type import with a `shared/` type
   - `shared/types/Game.ts` derives its types from `getGame`/`getGames` return types via `import type`. Keep; exempt `shared/types/**` in the lint rule.
5. **Move test factories.** `lib/fixtures/game.ts` → `test/fixtures/game.ts`. Delete `lib/`.
6. **Config and docs.** `nuxt.config.ts` include list keeps only `../test/**/*`. Update `CLAUDE.md` layout section, `docs/21-Providers.md`, `lib/steam/README.md` location, any other docs naming `lib/` or `db/` paths.
7. **Enforce with Biome.** Override for `app/**` and `shared/**`: `style/noRestrictedImports` with `patterns: [{ group: ["~~/server/**"], message: "Client and shared code must not import server code; move what you need to shared/" }]`. Second override exempting `shared/types/**`. Biome flags `import type` as well, hence step 4 first.
8. **Verify.** `pnpm typecheck`, `pnpm test`, `pnpm lint:ci`, `pnpm db:migrate` against a scratch DB, `docker build`. Then `nuxt build` and grep `.output/public/_nuxt/*.js` for `client_secret` / `api.steampowered.com` — no hits.

Steps 1–3 and 5 are mechanical (`git mv` + sed, ~80 files); do them as one commit each so history stays readable.

## Open questions

- `server/database/migrate-cli.ts` is run with `tsx` outside Nitro. Confirm it needs nothing from the Nitro tsconfig after the move (it should not, it is plain Node).
- `server/art/` is arguably a service too. Leave it; it is already inside `server/` and cohesive.
