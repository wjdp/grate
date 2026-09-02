---
type: task
status: done
---

# Enable typecheck

`pnpm typecheck` (`nuxt typecheck`) fails: no `vue-tsc` installed. Nothing currently type-checks `.vue` files or `server/`.

## Steps

1. `pnpm add -D typescript vue-tsc`.
2. Run `pnpm typecheck`; fix errors. Expect: `server/tasks/router.ts` vs `TASK_NAMES`, existing `@ts-ignore`s (`server/providers/steam/api.ts:116` env vars, `server/routes/art/steam/[appId]/[type].ts`, `nuxt.config.ts` tailwind plugin), untyped `data` in `getGogUserGames`.
3. Env vars: add `env.d.ts` `ProcessEnv` declarations for `STEAM_API_KEY`, `STEAM_USER_ID`, `DATABASE_URL` instead of `@ts-ignore`.
4. Add `pnpm typecheck` to CI alongside `lint:ci` and `test`. Add to `lint-staged`? No — too slow; CI only.
5. Stop `nuxt typecheck` attempting a DB migrate (observed "Not migrating the database" output from `@prisma/nuxt`); goes away with [02](02-Prisma-To-Drizzle-Migration.md).

## Outcome

- `vue-tsc` needs TypeScript 5 (TS 7 / tsgo has no `lib/tsc` export), so `typescript` is pinned `^5`.
- The mass `@prisma/client has no exported member` errors came from the explicit `output = "../node_modules/.prisma/client"` in `schema.prisma`: under pnpm, `@prisma/client` resolves `.prisma/client` from the store and so saw a stub. Removed `output`; Prisma now generates to the default (store) location and the `index-browser` vite alias is no longer needed.
- `GameWithSteam` now derives from the tRPC router output, not the Prisma model (superjson-less serialisation turns Dates into strings, BigInt into `never`).
- CI already ran typecheck; only the step name was wrong.
- The "Not migrating the database" noise comes from `@prisma/nuxt` and stays until [02](02-Prisma-To-Drizzle-Migration.md).

## Verification

`pnpm typecheck` exits 0; CI runs it.
