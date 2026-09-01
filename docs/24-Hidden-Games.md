---
type: task
status: open
---

# Hidden games

Let the user hide library items they don't want to see — tooling, launchers, soundtracks, benchmarks, anything a store lists as a game that isn't one to them — without losing the game, its provider rows or its playtime history. Rationale and the state-vs-flag distinction in `docs/17-Product-Goals.md` (Hidden games).

## Principles

- `hidden` is a boolean on `Game`, orthogonal to `state`. A hidden game may have any state or none.
- Hiding never deletes or unlinks anything. Sync keeps recording playtime for hidden games exactly as before.
- Hidden games are out of every default list, stat and automation. One toggle ("Show hidden") brings them back into a view; it never leaks into other views.
- Not to be confused with `GogIgnoredProduct` / `EpicIgnoredItem`, which stop non-games being imported at all. Those stay as they are.

## Schema

`db/schema.ts`, on `game`:

```ts
hidden: boolean().notNull().default(false),
```

Migration `db/migrations/0009_game_hidden.sql`:

```sql
ALTER TABLE `Game` ADD `hidden` integer DEFAULT false NOT NULL;
```

Update `meta/` snapshot and journal as for previous migrations; add the column to the migration tests' expected schema.

## API

- `PATCH /api/games/:id/hidden` with body `{ hidden: boolean }`; schema in `shared/schemas/games.ts`. Returns `{ game }` like `state.patch.ts`.
- `lib/games.ts`: `setGameHidden(id, hidden)`. No history table — a hidden flag is not a decision worth a timeline entry.
- `GET /api/games` continues to return all games including hidden; the flag is on each row and the client filters. Rationale: the palette, game page and merge dialog need hidden games available, and the library is already fetched whole.
- `GET /api/games/recent` excludes hidden.
- `GET /api/games/duplicates`: exclude pairs where either side is hidden.
- `lib/activity.ts` (`getDailyPlaytime`) and any other aggregate: exclude hidden games' playtime.

## Merge and split

- `mergeGames`: result keeps the target's `hidden`. Sources' flags are discarded.
- `splitGame`: the new game inherits `hidden` from the game it was split from.

## UI

- **Library** (`app/pages/games.vue`): hidden games excluded by default. Add a `hidden` query param filter alongside the existing ones (`all` default meaning "not hidden", `hidden` meaning "only hidden"). Hidden rows show an eye-off icon next to the name.
- **Home** (`app/pages/index.vue`): unsorted count and recent list exclude hidden.
- **Game page** (`app/pages/game/[id].vue`): reachable regardless. Hidden games show a banner ("Hidden from your library") with an Unhide button. Add Hide/Unhide to the game's actions next to the state control.
- **Organise** (`app/pages/organise.vue`): skip hidden games in `gamesToOrganise`. Add "Hide" as an answer alongside the state groups, with its own shortcut key, styled with the eye-off icon rather than a state hue. Hiding counts as organised for the progress count.
- **Command palette** (`app/utils/commandPalette.ts`, `AppCommandPalette.vue`): game search excludes hidden by default; a game's action list gets a Hide/Unhide command. Hidden games are still findable when opened directly from their page.
- **Sidebar/nav**: no new page. Hidden games are found via the library filter.

## Tests

- Migration tests: column present, default `0`.
- `lib/games` tests: `setGameHidden`; merge keeps target flag; split inherits.
- `getRecentGames`, duplicates, `getDailyPlaytime` exclude hidden.
- `commandPalette.test.ts`: hidden games absent from search; Hide/Unhide commands present.
- Organise: hidden games skipped; Hide action marks organised.

## Out of scope

- A `hiddenReason` column. Add if a real need appears.
- Reading Steam's own per-user hidden list — not exposed by `GetOwnedGames`.
- Bulk hide from the library list. Possible follow-up once multi-select exists.

## Open questions

- Should "Show hidden" on the library also reveal hidden playtime in activity/stats, or should stats always exclude? Default: stats always exclude.
