# AGENTS.md

grate is a self-hosted game library, backlog and analytics tool. Its core feature is a **timeline of play**: it polls Steam/GOG/Epic on a schedule, derives play sessions from deltas in each store's cumulative playtime totals, and builds a history the stores don't provide. Single user per instance, no auth, deployed as an always-on Docker container.

Read `docs/17-Product-Goals.md` before feature or design work — it defines the vision, the game-state model and the planned playtime-driven state automation.

## Stack

Nuxt 4 (Vue, Nuxt UI, Tailwind) with a Nitro server, Drizzle ORM on better-sqlite3, Biome for lint/format, Vitest for tests. Node + pnpm.

- `app/` — Nuxt frontend
- `server/` — Nitro API routes, scheduled tasks, SSE
  - `database/` — Drizzle schema, hand-written migrations, DB client
  - `providers/` — server-side provider logic and clients (`steam/`, `gog/`, `epic/`)
  - `services/` — domain logic over the DB (games, aggregates, duplicates, activity, playtime timeline, settings)
  - `art/` — art fetching and caching
- `shared/` — code shared between app and server (game states in `shared/game-state.ts`)
- `test/` — shared test fixtures and factories
- `docs/` — working docs: numbered `NN-Title.md`, never renumbered; frontmatter `type: reference|review|task`. Start with `docs/00-Docs.md`; `docs/21-Providers.md` explains how providers work and how to add one

## Commands

- `pnpm test` — Vitest
- `pnpm lint` — Biome (writes fixes); `pnpm lint:ci` to check only
- `pnpm typecheck`
- `pnpm db:migrate` — apply migrations (not automatic in dev)
- `pnpm dev` — dev server on :3000, do not run dev server yourself, the user should have one running already

## Local dev database

`./dev.db` is a SQLite database containing the author's real game library. Query it for ground-truth data (real game titles, playtime records, provider ids, states):

```sh
sqlite3 dev.db '.tables'
sqlite3 dev.db "select name, playtimeForever from SteamGame order by playtimeForever desc limit 10"
```

Tables are PascalCase (`Game`, `SteamGame`, `GogGamePlaytime`, …) — a hangover from the Prisma era.

## Conventions

- British English in naming, copy and communication.
- Prefer self-documenting code over comments.
