---
type: task
status: todo
---

# Enable typecheck

`pnpm typecheck` (`nuxt typecheck`) fails: no `vue-tsc` installed. Nothing currently type-checks `.vue` files or `server/`.

## Steps

1. `pnpm add -D typescript vue-tsc`.
2. Run `pnpm typecheck`; fix errors. Expect: `server/tasks/router.ts` vs `TASK_NAMES`, existing `@ts-ignore`s (`lib/steam/api.ts:116` env vars, `server/routes/art/steam/[appId]/[type].ts`, `nuxt.config.ts` tailwind plugin), untyped `data` in `getGogUserGames`.
3. Env vars: add `env.d.ts` `ProcessEnv` declarations for `STEAM_API_KEY`, `STEAM_USER_ID`, `DATABASE_URL` instead of `@ts-ignore`.
4. Add `pnpm typecheck` to CI alongside `lint:ci` and `test`. Add to `lint-staged`? No — too slow; CI only.
5. Stop `nuxt typecheck` attempting a DB migrate (observed "Not migrating the database" output from `@prisma/nuxt`); goes away with [02](02-Prisma-To-Drizzle-Migration.md).

## Verification

`pnpm typecheck` exits 0; CI runs it.
