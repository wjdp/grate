---
type: task
status: in-progress
---

# GOG playtime sync

Started 2026-08-30. Goal: parity with Steam — games, playtime, last played, history, scheduled.

## Done

- OAuth login, token refresh, user upsert, owned games → `GogGame` (pre-existing).
- Schema: `GogGame.playtimeMinutes/lastPlayedAt/productType`, `GogGamePlaytime` history, `GogIgnoredProduct`, `Game.playtimeMinutes/lastPlayedAt` aggregates with backfill from Steam.
- `lib/gameAggregates.ts` `refreshGameAggregates`.
- Characterisation tests for `lib/games`, Steam and GOG services.
- `getGogGamePlaytime` + `recordGogPlaytime`/`recordGogPlaytimes` (items 1, 2).
- `refreshGameAggregates` called after GOG game and playtime writes (item 3).
- Sync robustness: `GogIgnoredProduct` cache (manual, 404, non-GAME product types), retriable-vs-permanent `GogApiError`, per-game failures logged and skipped (item 6).

## Remaining

None in scope. Unverified without a running app: GOG image `{formatter}` presets used in `shared/art.ts` (`glx_logo_2x`, `product_card_v2_mobile_slider_639`, `glx_bg_top_padding_7`, `glx_icon_square`), `goggalaxy://` links — check against a real account on first deploy.

Verified 2026-08-30 — `gameplay.gog.com` sessions:

- Per-game `GET gameplay.gog.com/games/{id}/users/{galaxyUserId}/sessions` returns only `{"time_sum": <minutes>}`. Requires `galaxyUserId`; `gogUserId` gives 403 "Wrong user".
- Bulk `GET gameplay.gog.com/users/{galaxyUserId}/sessions` returns `{"total_sum", "game_time": [{"game_id","time_sum"}]}`, only games with playtime > 0. Sync now uses this (bc2cfb4).
- `last_session_date` not returned by either endpoint with the launcher client id; was speculative. `/users/{id}/stats` needs the `gameplay` scope, which third-party clients don't get. No per-session or per-date breakdown available. Grounding path in `recordGogPlaytime` (25201e7) kept but only exercised by tests; GOG `lastPlayedAt` effectively derived from observed playtime changes.
- `GogGame.lastPlayedAt` is now inferred via `inferredLastPlayedAt` over `GogGamePlaytime` history when GOG gives none (doc 22).
- Many products lack `gogReleaseDate`/`globalReleaseDate`; both optional, `releaseDate` null (9944c7c).

## Done in wave 3

4. Nitro: `recordGogPlaytimes` queueable + scheduled task alongside `scheduled:record-playtimes`.
5. `lib/games.ts` + pages: read `Game.playtimeMinutes`/`lastPlayedAt`; include `gogGame`; `getGamePlaytimes` returns either provider's history; `GameIcon`/art from `GogGame.*Url`; "Open in GOG" (`goggalaxy://openGameView/{id}`).
6. Switched playtime sync to the bulk sessions endpoint; grounded initial import on GOG's last session (bc2cfb4, 25201e7).
