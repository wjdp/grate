---
type: task
status: done
---

# Command palette (Ctrl+K)

Written 2026-08-31 against `96f4fbd`.

## Problem

No quick way to jump to a game or page, or act on a game, without mouse + scrolling the library. Want a VSCode/Linear-style combined search-and-action modal.

## Design

### Component

`UModal` + `UCommandPalette` (Nuxt UI 4, built-in fuzzy search via fuse.js) in a new `AppCommandPalette.vue`, mounted once in `default.vue` layout. Global state via `useCommandPalette()` composable (open/close, pane stack, active game).

### Triggers

- `Ctrl+K` / `Cmd+K` and `/` via `defineShortcuts` (`/` must not fire while typing in inputs — Nuxt UI's `usingInput` handles this).
- Search icon button in sidebar, above main nav.

### Panes

Simple stack, Linear-style. `UCommandPalette` has no native nesting; palette holds a `pane` state, Backspace on empty query pops, Esc closes.

1. **Root** — search + browse.
2. **Game actions** — actions for one game.
3. **Set state** — state list.

### Root pane

Empty query:

- **Recently viewed** group: game pages visited, tracked client-side in localStorage (id + timestamp, cap ~10), most recent first. New tiny composable `useRecentlyViewedGames()`; game page records on mount.
- **Navigation** group: Library, Organise, Duplicates (badge with count), Activity, Providers, Tasks — same icons/labels as `AppSidebar`. Debug pages (Components, Events, Steam art) included at bottom.

With query, fuzzy over:

- **Games**: match on name. Leading graphic = `GameIcon` art; trailing = state badge. Enter → navigate to `/game/[id]`. `Tab`/`→` → push game-actions pane for highlighted game.
- Navigation items as above.

### Game actions pane

Entered via `Tab`/`→` on a result, or root pane shows these actions directly (above nav) when palette is opened on `/game/[id]` for that page's game.

- **Go to game** — navigate to `/game/[id]`.
- **Set state…** — push set-state pane.
- **Play** — primary provider only, same rule as game page (provider row with most playtime); only when a launch target exists. Opens `playUrl` as `PlayButton` does.
- **Open store page** — primary provider's `openUrl`; only when available.

Extract the `primaryLaunch` logic currently inline in `app/pages/game/[id].vue:90` into a shared helper so palette and page share it; same for store link.

### Set state pane

States from `GameStateControl` groups (Unsorted / Backlog / Playing… with icons + hue classes), current state indicated. Enter → `PATCH /api/games/[id]/state`.

### Post-action

Close palette + success toast. Play just closes. Pages showing stale state (e.g. games list `useFetch` cache) refresh via `refreshNuxtData` on the games key.

### Data

Full library already ships client-side (`/api/games`, as games.vue). Palette lazily fetches on first open (`useFetch` shared key so it dedupes with games page); fuzzy search client-side. No new endpoints.

## Steps

1. `useRecentlyViewedGames()` composable + record visits from `game/[id].vue`.
2. Extract shared `primaryLaunch`/store-link helper from `game/[id].vue` into `shared/providers`.
3. `useCommandPalette()` composable: open state, pane stack, active game.
4. `AppCommandPalette.vue`: modal + `UCommandPalette`, root pane (nav + recents + game search), mounted in layout; `Ctrl+K` + `/` shortcuts; sidebar search button.
5. Game-actions pane + open-on-game-page context.
6. Set-state pane + PATCH + toast + `refreshNuxtData`.
7. Tests: pane stack logic, recents composable, action item building (launch/store availability).
