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

4. Nitro: `recordGogPlaytimes` queueable + scheduled task alongside `scheduled:record-playtimes`.
5. `lib/games.ts` + pages: read `Game.playtimeMinutes`/`lastPlayedAt`; include `gogGame`; `getGamePlaytimes` returns either provider's history; `GameIcon`/art from `GogGame.*Url`; "Open in GOG" (`goggalaxy://openGameView/{id}`).
