---
type: task
status: todo
---

# Prisma → Drizzle migration

## Goal

Replace Prisma with Drizzle ORM + `better-sqlite3`, keeping the existing production database file and all rows intact. No data export/import step for users; the app must boot on an existing `data/db.sqlite` and keep working.

## Why

See [01](01-Stack-Review.md) §2. Drizzle removes the generate step, the `@prisma/nuxt` alias hack, the openssl dependency in Docker, and gives SQL-shaped queries (joins/ordering across relations) and trivial in-memory test DBs.

## Constraints

- Preserve current data. The SQLite file in `data/` (Docker volume `./data:/app/data`, `DATABASE_URL=file:/app/data/db.sqlite`) is the only copy. Migration must be additive and reversible for at least one release.
- Keep `run.sh` semantics: migrate on boot, then start.
- Keep table and column names identical so the Drizzle schema maps onto the existing tables with no data movement. Only `_prisma_migrations` becomes obsolete.
- Datetime columns: Prisma writes SQLite `DATETIME` as ISO-8601 text (`2026-08-30T02:09:56.000Z`) — verified in `20260830020956_gog_playtime` backfill. Drizzle `integer({ mode: "timestamp" })` expects unix seconds; use `text()` with a custom type (or `customType`) that parses/serialises ISO strings so existing rows read correctly. Don't convert data in place until Prisma is gone.
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

## Rollback

Until step 8 the Prisma schema and migrations still exist and the tables are untouched, so reverting the release restores the old app on the same file. After step 8 rollback needs the DB file backup taken in step 7.

## Verification

- `pnpm test --run` green (tests now use `:memory:` per file).
- `pnpm typecheck` green.
- Row counts per table identical before and after on a production copy.
- Fresh install (no DB file) boots and migrates from zero.
