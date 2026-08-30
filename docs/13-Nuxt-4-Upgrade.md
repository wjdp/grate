---
type: task
status: done
---

# Nuxt 4 upgrade

Written 2026-08-30 against `14877b7`. Nuxt 3.21 → 4.5. Do after [10](10-Drop-tRPC.md) (removes `trpc-nuxt` + `build.transpile`, the most likely breakage) and before [12](12-UI-Overhaul.md) (every client file gets rewritten there; move them once).

## What changes for us

- **`app/` directory.** `app.vue`, `app.config.ts`, `assets/`, `components/`, `composables/`, `layouts/`, `pages/`, `plugins/`, `utils/` move under `app/`. `server/`, `shared/`, `db/`, `lib/`, `test/`, `public/`, `nuxt.config.ts` stay at root.
- **Aliases.** `~`/`@` → `app/`; `~~`/`@@` → root. Today `~/lib` (58 uses), `~/server` (21), `~/shared` (4), `~/test` (3), `~/utils` (8) resolve to root; after the move they must become `~~/lib`, `~~/server`, `#shared/…`, `~~/test`, and `~/utils` (now correct). `~/composables`, `~/assets` stay `~/`. Convention going forward: `~~/` for root dirs, `#shared/` for shared, `~/` only for `app/`.
- **Data fetching.** `useAsyncData`/`useFetch` `data` is `shallowRef` and defaults to `undefined` (was `null`); `pending` is derived from `status`. Our 6 call sites use `status` already and never compare to `null`. `pages/game/[id].vue` mutates `game.value.state` in place for the optimistic update — with `shallowRef` that no longer re-renders; pass `deep: true` or replace the object (page is rebuilt in 12 anyway).
- **TypeScript.** v4 generates separate `tsconfig.app.json`/`tsconfig.server.json`/`tsconfig.node.json`/`tsconfig.shared.json` under `.nuxt/`, and root `tsconfig.json` becomes a references file. `server/tsconfig.json` already extends `.nuxt/tsconfig.server.json`; keep. `pnpm typecheck` (`nuxt typecheck`) covers all projects.
- **Misc.** `compatibilityDate` bump. Vite 7 / Nitro 2.12 come with it — `vite.server.watch.ignored` unchanged. `scheduledTasks`/`experimental.tasks` unchanged. `@nuxt/test-utils` 3.23 supports v4; `vitest.config.ts` `setupFiles: ["test/setup.ts"]` is root-relative, unchanged. Dockerfile copies `.output`, `db/`, `run.sh` — none move.
- **Histoire.** Alpha Nuxt plugin; not expected to survive the `app/` move. 12 drops it; if it breaks here, drop it here (3 stories, `story:*` scripts, three `@histoire`/`histoire` packages).

## Steps

1. `npx nuxi upgrade --dedupe` to latest 4.x; bump `compatibilityDate` to today.
2. `npx codemod@latest nuxt/4/migration-recipe` (does the `app/` move and most renames); review the diff — do not trust it blindly.
3. Fix aliases per the table above: `rg '"~/(lib|server|shared|test)'` → nothing.
4. `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm dev` — every page loads.
5. If Histoire breaks: remove it.

## Verification

- `pnpm typecheck`, `pnpm test`, `pnpm build` green.
- `rg '"~/(lib|server|shared|test)'` returns nothing.
- Docker build runs and `/health` responds.
- Manual: `/`, `/games`, `/game/:id` (state change re-renders), `/organise`, `/debug/tasks` (SSE live), provider pages.

## Done

Done 2026-08-30 on top of `5de08f6`, in three commits: `5456afb` (upgrade),
`5e634e3` (drop Histoire), `800ee5f` (the `app/` move and aliases).

Final versions: Nuxt 4.5.2, Nitro 2.13.4, Vite 7.3.6, Vue 3.5.42,
vue-router 5.3.0, Vitest 4.1.11, @nuxt/test-utils 4.2.0. @nuxt/icon 1.11.0,
@nuxt/fonts 0.11.4, vue-tsc 3.3.11 and TypeScript 5.9.3 all work unchanged;
`pnpm peers check` is clean.

`pnpm typecheck`, `pnpm test --run` (206 passed, 2 skipped), `pnpm build` and
`pnpm lint:ci` are green, and neither `nuxt prepare` nor `nuxt build` prints a
single warning or deprecation notice.

### Deviations

- **Vitest 4.** @nuxt/test-utils 3.23 cannot start its Vite server under Vite
  7 — every test file dies before collection with `Unknown Error: [object
Object]`. @nuxt/test-utils 4.x fixes it but requires `vitest ^4`, so both
  moved together. No test needed changing.
- **`buildDir` pinned to `.nuxt`.** v4 defaults it to
  `node_modules/.cache/nuxt/.nuxt`, and from there the generated
  `tsconfig.server.json` and `tsconfig.node.json` carry `"exclude":
["../../.."]` — which is `node_modules`, the directory now containing the
  build dir and its own nitro type files. Every server auto-import
  (`defineEventHandler`, `defineTask`, …) then fails to resolve. Pinning the
  build dir back outside `node_modules` sidesteps it and keeps the tsconfig
  references readable.
- **`noUncheckedIndexedAccess` turned back off** (via `typescript.tsConfig`,
  `nodeTsConfig`, `sharedTsConfig` and `nitro.typescript.tsConfig`). v4 enables
  it by default; it surfaces 45 pre-existing errors, mostly `rows[0].x` in
  tests but also `shared/steam-profile.ts`, `app/utils/formatDateIso.ts`,
  `app/utils/parseIntRouteParam.ts`, `app/components/HistoryGrid.vue` and two
  pages. Worth a task of its own — see the follow-up below.
- **Histoire removed**, as anticipated: under Vite 7 the story collector throws
  `__vite_ssr_exportName__ is not defined`.
- **Three helpers moved out of the client tree** rather than into `app/`:
  `composables/useSse.ts` → `server/sse.ts` (it is h3 code with no client
  half, imported only by `server/`), and `utils/tryCatch.ts` + `utils/sleep.ts`
  → `shared/utils/` (used by `server/` and `lib/`; `shared/utils` is
  auto-imported on both sides, which keeps `organise.vue`'s bare `sleep()`
  working). Leaving them under `app/` would have had Nitro importing from the
  client project.
- **The codemod was not used.** `npx codemod@latest nuxt/4/migration-recipe`
  answers "No command provided" whatever it is given; the move was done with
  `git mv` and a scripted alias rewrite.
- **`typescript.tsConfig.include` extended** with `../lib/**/*`, `../db/**/*`
  and `../test/**/*`. With `srcDir` now `app/`, none of the four generated
  projects covers them, so they would only have been checked where an app file
  happened to import them; `lib/**/*.test.ts` and `test/**` would have lost
  type checking entirely.
- `server/tsconfig.json` is unchanged and still valid; root `tsconfig.json` is
  now a `files: []` + `references` file over the four generated projects, which
  is what makes `nuxt typecheck` run `vue-tsc -b`.

### Follow-up

Re-enable `noUncheckedIndexedAccess` and fix the 45 sites. Mostly mechanical in
tests; the handful in `shared/` and `app/utils/` are real unguarded indexing.

### Manual checks still outstanding

Nothing was exercised in a browser. Worth a look: `/`, `/games` (filter and
sort), `/game/:id` — especially that the state control still re-renders after
the optimistic update — `/organise`, `/debug/tasks` and `/debug/sse` (the SSE
stream now comes from `server/sse.ts`), and the three provider pages. Also a
Docker build and a `/health` probe.
