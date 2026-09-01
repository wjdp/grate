---
type: task
status: done
---

# Game context menu

Right-click (or long-press) a game in the library to act on it in place, mainly to set its state, without opening the game page. Covers both library views; the list is the primary target, the wall comes free because both render through one wrapper.

## Principles

- One menu component, wrapped around the existing row/poster link. No changes to the virtualisers.
- States live in a "Set state" submenu so the top level stays short as more actions (Play, Hide, …) arrive. Grouped and ordered exactly as `gameStateItemGroups` so the submenu reads the same as the state control, filter and palette.
- No success toast. The list is live and the badge changes in place; that is the feedback. Errors still toast.
- State changes go through one shared client mutation, reused by the command palette. No third copy of the PATCH logic.
- Optimistic: the library cache is patched before the request, reverted on failure. No refetch on success — the PATCH only changes `state`, so the local patch is already correct.
- Native `contextmenu` behaviour is replaced on the trigger only; browser context menu still works elsewhere on the page.

## Component

`app/components/GameContextMenu.vue`

```vue
<GameContextMenu :game="game">
  <NuxtLink …>…</NuxtLink>
</GameContextMenu>
```

- Wraps `UContextMenu` (Nuxt UI 4, `reka-ui` under the hood — handles right-click, long-press on touch, Shift+F10 / Menu key when the trigger is focused).
- Props: `game: GameWithProviders`. Default slot is the trigger.
- Uses `#item-leading` to colour state icons with `iconClass`, as `GameStateControl` does.
- `portal` left at default (true) so the menu escapes the list's `overflow-hidden`.

### Items

Built from `gameStateItemGroups` (`app/utils/gameStateItems.ts`) plus `getPrimaryLaunch(game)`.

```
[ { type: "label", label: game.name } ]
[ Set state ▸ ]                                ← children below
[ Play, Open store page ]                      ← only when getPrimaryLaunch(game) is non-null
[ Hide | Unhide ]                              ← label and icon follow game.hidden

Set state ▸
  [ Unsorted ]                                 ← gameStateItemGroups[0]
  [ Backlog, Shelved ]
  [ Playing, Stalled, Periodic ]
  [ Played, Completed, Retired, Abandoned ]
  [ Ignored ]
```

- "Set state": `icon: "i-lucide-tag"` (matches the palette action), `children: gameStateItemGroups.map(group => group.map(toMenuItem))` — nested arrays render as separated groups inside the submenu.
- State items: `type: "checkbox"`, `checked: item.value === (game.state ?? null)`, `icon`, `disabled` when current, `onSelect: () => setGameState(game, item.value)`.
- Hide / Unhide: `i-lucide-eye-off` / `i-lucide-eye`, calls `useSetGameHidden` with `!game.hidden`.
- Future items go in their own group at the top level; the state list never grows the top level.
- Play and Open store: `onSelect` calling the same open-url logic as `openLaunchUrl` in `AppCommandPalette.vue` (`_blank` for http, `_self` for protocol URLs). Move that helper to `app/utils/launch.ts` (or similar) and use it from both.
- No "Go to game" — the trigger is already the link.

### Wiring

- `GameRow.vue` and `GamePoster.vue`: wrap the root `NuxtLink` in `<GameContextMenu :game="game">`. Nothing else changes.
- `VirtualGameList` / `VirtualGameWall`: untouched. Rows are absolutely positioned but the menu portals to body, so positioning is unaffected.

## Shared library cache key

Every `useFetch("/api/games")` gets an explicit key so the mutation can reach the cached list:

```ts
useFetch("/api/games", { key: "games", … })
```

Files: `app/pages/games.vue`, `app/pages/index.vue`, `app/pages/organise.vue`, `app/components/AppCommandPalette.vue`, `app/components/GameMergeDialog.vue`. Keep each call's other options (`lazy`, `server: false`, `immediate: false`) as they are. Side effect, wanted: all five share one cache entry, so home, library and palette reflect a change instantly.

## Shared mutation

`app/composables/useSetGameState.ts`

```ts
export function useSetGameState() {
  const toast = useToast();
  const { data } = useNuxtData<{ games: GameWithProviders[] }>("games");
  return async function setGameState(game: GameWithProviders, state: GameState | null) { … };
}
```

- Patch `data.value.games` immutably (new array, new object for the changed game) so the virtualisers' `games` watcher fires. Then PATCH `/api/games/:id/state` with `{ state }`.
- On error: restore the previous `data.value` and toast "Could not set state" with `fetchErrorMessage`, as the palette does today. No success toast.
- No `refreshNuxtData()` on success.
- `AppCommandPalette.vue` switches to it, drops its own `setGameState` and its success toast. `app/pages/game/[id].vue` keeps its optimistic update against `/api/games/:id`; out of scope.
- With a state filter active the game drops out of the list immediately — expected.

`app/composables/useSetGameHidden.ts` is the same shape against `/api/games/:id/hidden`. It keeps a success toast ("Hidden from library" / "Shown in library"): a hidden game leaves the list, so the toast is the only feedback. The palette uses it too.

## Virtualiser scroll nudge

Setting a state from the list used to scroll it down a pixel or so. Both virtual views re-ran `virtualizer.measure()` whenever `games` changed, wiping TanStack's size cache; every rendered row above the fold then re-measured as a first measurement, and TanStack applies that estimate-to-actual delta to `scrollTop`. Row sizes are keyed by index and uniform, so the cache is only cleared when the wall's column count changes. The list's row dividers went at the same time so rows match their estimate; that turned out not to be the fix but does no harm.

## Follow-ups (not in this task)

- `commandPalette.ts` `GAME_STATE_COMMAND_GROUPS` duplicates `gameStateItemGroups` shape-for-shape. Collapse to the latter once the menu lands.

## Tests

`app/components/GameContextMenu.test.ts`, mocking `$fetch` and `refreshNuxtData` as `AppCommandPalette.test.ts` does:

- "Set state" submenu renders one item per entry in `gameStateItemGroups.flat()`, in order, with the current state checked and disabled.
- Play / Open store items present only when the game has a launchable provider row.
- Selecting a state PATCHes `{ state }` to `/api/games/:id/state`.
- Success shows no toast. Error path shows the failure toast and does not throw.
- Hide / Unhide label and icon follow `game.hidden`; selecting PATCHes `{ hidden }`.

`useSetGameState.test.ts` and `useSetGameHidden.test.ts`: cache patched before the request resolves; reverted on failure; no `refreshNuxtData` call. Palette test updated for the removed success toast, otherwise unchanged.
