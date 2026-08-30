---
type: task
status: done
priority: high
---

# Prisma → Drizzle migration

## Goal

Replace Prisma with Drizzle ORM + `better-sqlite3`, keeping the existing production database file and all rows intact. No data export/import step for users; the app must boot on an existing `data/db.sqlite` and keep working.

## Why

See [01](01-Stack-Review.md) §2. Drizzle removes the generate step, the `@prisma/nuxt` alias hack, the openssl dependency in Docker, and gives SQL-shaped queries (joins/ordering across relations) and trivial in-memory test DBs.

## Current breakage (2026-08-30) — why this is urgent

Local dev fails on boot after the pnpm 11 reinstall:

```
Named export 'GameState' not found. The requested module '…/.pnpm/@prisma+client@6.5.0…/@prisma/client/default.js' is a CommonJS module
```

Cause, verified:

- `@prisma/client/default.js` is `module.exports = { ...require('.prisma/client/default') }`. Under pnpm's isolated layout that resolves to `node_modules/.pnpm/@prisma+client@…/node_modules/.prisma/client/`.
- `prisma/schema.prisma` sets `output = "../node_modules/.prisma/client"`, so `prisma generate` (and the `@prisma/client` postinstall) write the real client to **top-level** `node_modules/.prisma/client`, which `@prisma/client` cannot see. The `.pnpm` location keeps Prisma's 2 KB placeholder stub (`PrismaClient`/`Prisma` only, no models, no enums) — hence no `GameState`.
- The custom `output` and the `nuxt.config.ts` vite alias `".prisma/client/index-browser" → "./node_modules/.prisma/client/index-browser.js"` were added together in `12eacef` ("Try and fixup prisma") to work around nuxt/nuxt#24690; the pair only worked while pnpm 10 happened to make the top-level path resolvable.
- Tests pass regardless because vitest goes through Vite's resolver, not Node's CJS resolution.

Workaround shown to make `import { GameState } from "@prisma/client"` resolve in Node (not applied; abandoned in favour of this migration): delete the `output` line so Prisma generates beside the real package (it logs `Generated Prisma Client … to ./node_modules/.pnpm/@prisma+client@…/@prisma/client`), and compute the browser alias in `nuxt.config.ts` from `dirname(createRequire(import.meta.url).resolve("@prisma/client")) + "/../../.prisma/client/index-browser.js"`. Dev-server boot with that change was not verified.

Drizzle has no generate step and no `.prisma` resolution dance, which removes this class of failure entirely.

## Constraints

- Preserve current data. The SQLite file in `data/` (Docker volume `./data:/app/data`, `DATABASE_URL=file:/app/data/db.sqlite`) is the only copy. Migration must be additive and reversible for at least one release.
- Keep `run.sh` semantics: migrate on boot, then start.
- Keep table and column names identical so the Drizzle schema maps onto the existing tables with no data movement. Only `_prisma_migrations` becomes obsolete.
- Datetime columns: **corrected** — Prisma wrote `DATETIME` as unix _milliseconds_ INTEGER, not ISO text. The one exception is the `20260830020956_gog_playtime` backfill, whose raw SQL wrote ISO text (`2026-08-30T02:09:56.000Z`) into `Game.lastPlayedAt`. SQLite sorts integers before text, so mixed rows would break `getRecentGames`. `db/customTypes.ts` reads both forms and writes milliseconds; adoption rewrites the text rows in place.
- `BigInt` columns (`SteamUser.steamId`, `SteamGame.appId`, `SteamAppInfo.appId`, `SteamGamePlaytime.steamAppId`): Prisma stores as INTEGER. Use `integer({ mode: "bigint" })` or do [06](06-Drop-BigInt-AppId.md) first (preferred — fewer types to carry over).
- `Json` columns (`tags`, `properties`, `developers`, `publishers`, `categories`, `genres`, `screenshots`): Prisma stores JSON text in `JSONB`-declared columns; Drizzle `text({ mode: "json" })` reads them as-is.
- Enums (`GameState`, `SteamAppInfoState`) are stored as TEXT; Drizzle `text({ enum: [...] })`.

## Steps

1. Land [05](05-Test-Infrastructure.md)/[03](03-Enable-Typecheck.md) first so the swap is verified by tests + types.
2. Add `drizzle-orm`, `better-sqlite3`, `drizzle-kit`. Write `db/schema.ts` mirroring `prisma/schema.prisma` exactly (names, nullability, defaults, FKs, unique indexes).
3. `drizzle-kit introspect` against a copy of a real DB; diff the generated schema against the hand-written one until identical. This is the data-preservation check.
4. Baseline migration: `drizzle-kit generate` produces `0000_*.sql` that creates all tables. For existing databases this must not run. Options: (a) on boot, if `_prisma_migrations` exists and is fully applied, insert the baseline row into `__drizzle_migrations` and skip; (b) ship a one-off `scripts/adopt-drizzle.ts` run by `run.sh` once. Prefer (a): idempotent, no operator action.
5. Replace `lib/prisma.ts` with `lib/db.ts`. Port query files one at a time, keeping tests green: `lib/games.ts`, `lib/gameAggregates.ts`, `lib/steam/service.ts`, `lib/gog/service.ts`, `server/tasks/queue.ts`, `server/trpc/**`, fixtures in `lib/*/fixtures/fake.ts`, `test/db.ts`. Types currently imported from `@prisma/client` (`Game`, `SteamGame`, `GogUser`, `GameState`…) become `typeof schema.game.$inferSelect` etc. exported from `db/schema.ts`; `shared/types/Game.ts` is the only client-side consumer.
6. Nuxt/Nitro: remove `@prisma/nuxt`, the vite alias in `nuxt.config.ts`, `pnpm prisma generate` and openssl from `Dockerfile`; `run.sh` runs `drizzle-kit migrate` (or programmatic `migrate()` in a Nitro plugin before tasks start).
7. Run against a copy of production data: boot, open every page, run every task. Compare row counts per table before/after.
8. Remove Prisma packages and `prisma/` directory in a follow-up release once a production deploy has been confirmed good. Keep `_prisma_migrations` table; harmless.

## Outcome

Shipped:

- `db/schema.ts` mirrors the Prisma tables one-for-one; verified against `drizzle-kit introspect` on a real database copy.
- `db/customTypes.ts` for datetimes (reads unix ms or ISO text, writes ms), bigints and JSON columns.
- `db/migrate.ts` adopts an existing Prisma database: refuses anything older than the baseline, applies the final Prisma migration from `db/adopt/` if missing, normalises `Game.lastPlayedAt` to unix ms, then records the Drizzle baseline. Idempotent.
- `server/plugins/migrate.ts` migrates on boot, so `run.sh` no longer shells out to the Prisma CLI and the Docker image needs neither openssl nor `prisma generate`.
- Tests get an in-memory database per file (`test/setup.ts`, `DATABASE_URL=":memory:"`), so file parallelism is back.

Verified on a copy of the production database in the release image: adoption ran, all 615 games readable, `lastPlayedAt` entirely INTEGER, restart is a no-op.

Remaining: step 8 only.

## Rollback

Until step 8 the Prisma schema and migrations still exist and the tables are untouched, so reverting the release restores the old app on the same file. After step 8 rollback needs the DB file backup taken in step 7.

## Verification

- `pnpm test --run` green (tests now use `:memory:` per file).
- `pnpm typecheck` green.
- Row counts per table identical before and after on a production copy.
- Fresh install (no DB file) boots and migrates from zero.
