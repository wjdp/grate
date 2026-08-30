---
type: task
status: todo
---

# Keep provider code out of the client bundle

`pages/providers/gog/index.vue` imported `getGogLoginUri` from `lib/gog/api.ts`, pulling the GOG client id/secret, zod schemas and fetch code into the browser bundle. The secret is the publicly-known Galaxy launcher one, so not a leak, but nothing stops a real secret going the same way.

## Steps

1. ~~Decide the boundary~~: `lib/` = server only; `shared/` = isomorphic (the Nuxt convention via `#shared`). Still undocumented outside this file.
2. ~~Move `getGogLoginUri`~~: done — `shared/providers/gog.ts` holds the public client id, redirect and login URI builder; the secret stays in `lib/gog/api.ts`. `shared/providers/epic.ts` does the same for Epic, and `shared/providers/index.ts` now holds the provider union, labels and the launch/store URL builders the client needs.
3. Audit other page imports from `lib/`: `app/pages/debug/steam-art.vue` still imports `lib/steam/art.ts` (pure, so harmless — the only `lib` string reaching the bundle is `steamcdn-a.akamaihd.net` — but it should move to `shared/` for consistency). `utils/createErrorFromSteamApiError.ts` and `utils/createUnknownError.ts` were deleted with tRPC ([10](10-Drop-tRPC.md)); routes map `lib` errors with `createError` server-side.
4. Enforce: ESLint `no-restricted-imports` for `~~/lib/**` in `app/` and `shared/`. There is still no ESLint config (prettier only), so adding one remains a prerequisite.
5. Move real secrets to `runtimeConfig` (server-side) rather than `process.env` reads in `lib/`.

Remaining: 3 (the `steam-art` import), 4 and 5.

## Verification

`nuxt build` then grep `.output/public/_nuxt/*.js` for `client_secret` / `api.steampowered.com` — no hits. Checked 2026-08-30: clean.
