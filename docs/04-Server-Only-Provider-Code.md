---
type: task
status: todo
---

# Keep provider code out of the client bundle

`pages/providers/gog/index.vue` imports `getGogLoginUri` from `lib/gog/api.ts`, pulling the GOG client id/secret, zod schemas and fetch code into the browser bundle. The secret is the publicly-known Galaxy launcher one, so not a leak, but nothing stops a real secret going the same way.

## Steps

1. Decide the boundary: `lib/` = server only; `shared/` = isomorphic (already the Nuxt convention via `#shared`). Document in `docs/00-Docs.md` or a `CONTRIBUTING` note.
2. Move `getGogLoginUri` (pure URL builder, only needs the public client id) to `shared/gog.ts`; keep secret in `lib/gog/api.ts`.
3. Audit other page imports from `lib/`: `pages/debug/steam-art.vue` imports `lib/steam/art.ts` (pure, fine, but move to `shared/` for consistency); `utils/createErrorFromSteamApiError.ts` imports `SteamApiError` class from `lib/steam/api.ts` — move error classes to `shared/errors.ts` or have tRPC map them server-side.
4. Enforce: ESLint `no-restricted-imports` for `~/lib/**` in `pages/`, `components/`, `composables/`, `utils/`, `shared/`. There is no ESLint config yet; adding one is a prerequisite (prettier only today).
5. Move real secrets to `runtimeConfig` (server-side) rather than `process.env` reads in `lib/`.

## Verification

`nuxt build` then grep `.output/public/_nuxt/*.js` for `client_secret` / `api.steampowered.com` — no hits.
