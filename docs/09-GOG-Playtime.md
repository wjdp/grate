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

## Remaining

1. `getGogGamePlaytime(gameId, userId, token)` → `GET gameplay.gog.com/games/{id}/users/{uid}/sessions` (`time_sum` minutes, `last_session_date`). Lenient zod schema; only Galaxy/Heroic-reported sessions are counted.
2. `recordGogPlaytimes` mirroring Steam `recordPlaytime` (extend last record when unchanged, else new record with `timestampStart` = previous end).
3. Both providers call `refreshGameAggregates` after updating their rows.
4. Nitro: `recordGogPlaytimes` queueable + scheduled task alongside `scheduled:record-playtimes`.
5. `lib/games.ts` + pages: read `Game.playtimeMinutes`/`lastPlayedAt`; include `gogGame`; `getGamePlaytimes` returns either provider's history; `GameIcon`/art from `GogGame.*Url`; "Open in GOG" (`goggalaxy://openGameView/{id}`).
6. Sync robustness items in [07](07-Sync-Robustness.md) that block correctness: `GogIgnoredProduct` use, transient-vs-404 distinction.
