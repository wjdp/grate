---
type: task
status: todo
---

# Provider sync robustness

Applies to `server/providers/steam/service.ts` and `server/providers/gog/service.ts`.

## Problems

- Serial per-game HTTP with no retry/backoff. A transient failure in `getGogGameDetail` is treated like a 404 and the game silently skipped; a failure in `populateStoreData` throws and aborts the task.
- No rate-limit handling (Steam store API is aggressively limited; GOG `api.gog.com` less so but unknown).
- GOG sync refetches every owned product id each run, including DLC/packs and permanent 404s. `GogIgnoredProduct` table exists (added 2026-08-30) to cache those; wire it in.
- `GogUser.checksumGames` stored but unused; GOG provides it to detect library changes — skip the owned-games fetch when unchanged.
- One bad row in `createGame`/`updateGame` aborts the whole GOG sync (only fetch errors are caught).
- `updateGame` (both providers) updates the provider row's `name` but never `Game.name`.
- Removed/refunded games are never removed or flagged.

## Steps

1. Shared `fetchWithRetry` in `server/providers/http.ts`: exponential backoff on 429/5xx/network, honour `Retry-After`, small concurrency limit (e.g. 3) via `p-limit`.
2. Distinguish error classes as `server/providers/steam/store.ts` already does (`retriable`); apply to GOG API.
3. GOG: consult `GogIgnoredProduct` before fetching; insert `NOT_FOUND` on 404, `DLC`/`PACK` on product type; replace hardcoded `GOG_IGNORED_PRODUCT_IDS` with `MANUAL` rows.
4. Use `checksumGames` to short-circuit `updateGogGames`.
5. Per-game try/catch around create/update with a summary of failures reported through the task's progress/state rather than console.
6. Sync `Game.name` on update (or decide `Game.name` is user-owned and stop copying it).
7. Mark games missing from the provider's owned list as `removed` (new nullable `removedAt` on provider tables) rather than deleting.

## Verification

Tests with mocked API: 429 then 200 → success; 404 → ignored row created and not refetched next run; one throwing row does not stop others.
