---
type: task
status: done
---

# Drop tRPC for Nuxt-native typed API

## Goal

Remove `@trpc/server`, `@trpc/client`, `trpc-nuxt` and `plugins/trpc.ts`; serve everything from Nitro `defineEventHandler` routes under `server/api/`, consumed with `useFetch`/`$fetch`, with end-to-end types inferred by Nuxt and input validated by zod. One API style across the app (SSE, art, setup and health are already Nitro).

## Why

See [01](01-Stack-Review.md) §8. tRPC's value here is typed procedures + zod input; Nuxt provides both natively, without the `build.transpile` hack, the plugin, batching links, or a second serialisation layer.

## How typing works without tRPC

- Nitro generates `.nuxt/types/nitro-routes.d.ts`; `$fetch("/api/games")` and `useFetch("/api/games")` infer the handler's return type. Route params typed via literal paths (`` `/api/games/${id}` `` matches `/api/games/:id`).
- Input: `getValidatedQuery(event, schema.parse)`, `readValidatedBody(event, schema.parse)`, `getValidatedRouterParams(event, schema.parse)`. Zod errors become 400s via `createError`.
- Dates: `$fetch` JSON-serialises `Date` → ISO string exactly as tRPC does today without superjson; keep the `formatLastPlayed` handling, or wrap responses with a small `serialise()` and a matching client `useApi` composable if richer types are wanted. `BigInt` goes away with [06](06-Drop-BigInt-AppId.md); do that first or keep `server/bigint.ts` until then.
- Requires [03](03-Enable-Typecheck.md) so route type inference is actually checked.

## Route map

| tRPC procedure               | Nitro route                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| `games`                      | `GET /api/games`                                             |
| `recentGames { limit }`      | `GET /api/games/recent?limit=`                               |
| `game { id }`                | `GET /api/games/:id`                                         |
| `gamePlaytimes { id }`       | `GET /api/games/:id/playtimes`                               |
| `setGameState { id, state }` | `PATCH /api/games/:id/state`                                 |
| `listTasks`                  | `GET /api/tasks`                                             |
| `runTask { taskName }`       | `POST /api/tasks` (await `createTask`; currently un-awaited) |
| `gogAuth { code }`           | `POST /api/providers/gog/auth`                               |
| `hello` (debug)              | delete, with `pages/debug/trpc.vue`                          |

Existing `/api/setup`, `/api/sse`, `/api/push`, `/health`, `/art/steam/**` unchanged.

## Steps

1. Add routes above, each a thin handler calling `server/services/*`/`server/providers/*` (no logic in handlers). Shared zod schemas for inputs in `shared/schemas/*.ts` so pages can reuse `GameState` enum etc.
2. Error mapping: `lib` errors → `createError({ statusCode, statusMessage })`; replace `utils/createErrorFromSteamApiError.ts`/`createUnknownError.ts` usage accordingly.
3. Client: replace `$client.x.useQuery()` with `useFetch`, `$client.x.mutate()` with `$fetch(..., { method })`. Delete `composables/useGames.ts`, `useGame.ts`, `useRecentGames.ts` (fixed `useAsyncData` keys; `useFetch` keys on URL). Pages: `index`, `games`, `organise`, `game/[id]`, `debug/tasks`, `providers/gog/index`.
4. Remove `server/trpc/**`, `server/api/trpc/[trpc].ts`, `plugins/trpc.ts`, `build.transpile` in `nuxt.config.ts`, the three packages.
5. Tests: `@nuxt/test-utils` `setup()` + `$fetch` for each route (see [05](05-Test-Infrastructure.md) §3) — this is where API tests get written for the first time.

## Verification

- `pnpm typecheck` green with route inference (`$fetch("/api/games")` result typed as `GameWithProviders[]`).
- Route tests green; existing lib tests untouched.
- `rg trpc` over the repo (excluding lockfile) returns nothing.
- Manual: every page loads, set state, run task, GOG auth flow.

## Done

Implemented as planned. The route map grew to cover every procedure, not just
the ones listed above: `mergeGames`, `splitGame`, `steamStatus`, `steamAuth`,
`epicStatus` and `epicAuth` also became routes.

Deviations:

- `GET /api/games/:id` lives at `server/api/games/[id]/index.get.ts` so it sits
  alongside `playtimes.get.ts` and `state.patch.ts` in one directory.
- `shared/types/Game.ts` exports `GameWithProviders` and `GameDetail` derived
  from `server/services/games` return types, mapped through a local `Serialised<T>` so the
  Date fields read as the ISO strings the client actually receives. The tRPC
  types lied about this.
- The provider pages use `try`/`catch` rather than `tryCatch`. Passing a
  `$fetch` call into a generic function makes TypeScript give up on Nitro's
  route-matching types with "Excessive stack depth"; awaiting it directly is
  fine. Worth watching if more routes are added.
- Client-side error text comes from `utils/fetchErrorMessage.ts`, which reads
  ofetch's `error.data.message`.
- `utils/createErrorFromSteamApiError.ts`, `utils/createUnknownError.ts` and
  `utils/createErrorFromRequestValidation.ts` were already unused and are gone.
- Route tests live in one file, `test/api/routes.e2e.test.ts`, rather than one
  per resource: two files mean two concurrent `nuxt dev` servers writing the
  same `.nuxt` directory, which is flaky. `@nuxt/test-utils`' own
  `setup({ server: true })` could not be used — building Nuxt inside vitest
  fails with "MagicString is not a constructor" — so `test/api/devServer.ts`
  spawns a Nuxt server and the suite runs `setup({ host })` against it. That
  server needs `NODE_ENV=development` (vitest sets `test`, under which
  `nuxt dev` silently refuses to boot) and `NUXT_IGNORE_LOCK=1` (so it can run
  beside a developer's own dev server).
- `runTask` now returns the created task instead of nothing.
