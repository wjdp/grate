---
type: task
status: open
---

# Library navigation and surfaces

Written 2026-09-07 against `a8652f5`. Restructures the library page (the app's main screen) so the state filter lives in the sidebar, the filter bar stays put while scrolling, and chrome sits on a different surface from the poster wall.

## Problem

1. **Filters scroll away.** `games.vue` renders title, stat strip and filter row at the top of the scrolling panel body. Any filter change from deep in an 800-game wall means scrolling back up.
2. **State is buried.** State is the primary way the library is organised (the whole of [17](17-Product-Goals.md) is about it) but reaching "Played" or "Abandoned" is: scroll up, open a 12-item select, pick. No overview of how the library is split.
3. **No surface hierarchy.** Sidebar, panel body, stat strip, filter inputs and empty states all sit on `--ui-bg`. The only `bg-elevated` use on the page is poster card backgrounds. Bordered boxes on the same colour as their surroundings (stat strip, inputs) read as outlines, not surfaces, and nothing frames the art. [12](12-UI-Overhaul.md) planned "bg elevated: cards, sidebar" but the sidebar never got it.

## Current state

- `layouts/default.vue` owns the one `UDashboardPanel`; pages render into its `#body`, which is the scroll container (`overflow-y-auto p-4 sm:p-6`). The `#header` slot is a non-scrolling `shrink-0` region above the body — currently only `AppNavbar` on `lg:hidden`. This is the natural home for a fixed toolbar, but pages can't reach it.
- `AppSidebar.vue`: `UDashboardSidebar` with three `UNavigationMenu`s. `UDashboardSidebar` has no background of its own; the active nav item is painted with `before:bg-elevated`.
- Below `lg` the sidebar is a drawer (`content: lg:hidden`), opened from `AppNavbar`.
- `games.vue` filters are URL query params (`state`, `provider`, `played`, `hidden`, `q`, `sort`) via `queryParam()`; `useScrollMemory` keys scroll position on `route.fullPath`, so every filter combination already remembers its own offset.
- State items (label, icon, hue) come from `gameStateItemGroups` in `app/utils/gameStateItems.ts`, shared with `GameStateControl`. `unsorted` is the query value for `state IS NULL`.
- All pages share the library under `useFetch` key `games`; `useSetGameState`/`useSetGameHidden` patch that cache optimistically, so anything derived from it (counts) stays live without refetching.
- Distribution in `dev.db`, visible games: 533 unsorted, 67 shelved, 59 completed, 52 played, 40 backlog, 33 playing, 20 periodic, 14 abandoned, 3 stalled, 1 retired, 0 ignored. Sidebar will show ~10 rows.
- Colour tokens (`main.css`): dark bg `grey-950`, elevated `grey-900`; light bg `grey-100`, elevated `grey-50`. The light pair is almost indistinguishable (L 0.967 vs 0.985).

## Solution

### 1. Pages own their panel

Move `UDashboardPanel` out of the layout and into pages, the Nuxt UI dashboard convention. Layout becomes `UDashboardGroup` + `AppSidebar` + `<slot />` + `AppCommandPalette`.

New `AppPanel.vue` wraps `UDashboardPanel`:

- `#header` slot, default content = `UDashboardNavbar` with the existing mobile toggle (`lg:hidden`) and a `title` prop. Pages that want a persistent toolbar fill the slot.
- `#body` = `PageContainer` with the page's `max-w`/spacing classes forwarded, so the 16 existing pages change from `<PageContainer class="…">` to `<AppPanel title="…" class="…">` and nothing else. `AppNavbar.vue` folds into `AppPanel`.

### 2. Library toolbar in the panel header

`games.vue` fills `AppPanel #header` with two fixed rows on `bg-elevated`, `border-b border-default`:

- `UDashboardNavbar`: mobile toggle, title (see below), `#right` = wall/list toggle.
- `UDashboardToolbar`: search, provider, played, hidden, sort. Inputs keep `bg-default` so they sit recessed in the elevated chrome. The state select stays in this row but `lg:hidden` (see Mobile).
- Filter summary: a slim third row (~32 px, `text-xs`) under the toolbar, still in the fixed header.

Title reflects the sidebar selection: "Library" for all, else the state name ("Played", "Unsorted"). Removes the `h1` from the body.

**Filter summary** replaces the stat strip. The strip today describes the whole library regardless of filters; the sidebar now carries state counts, so the strip's job becomes describing the current result set: `412 games · 84d 3h total · 337 played · 75 unplayed`. Computed from `filteredGames` (post state/provider/played/hidden/search, pre sort). Sits under the filters so it reads as their output. Values animate nothing; they just change. On phones it collapses to the game count only.

### 3. States in the sidebar

New `AppSidebarLibraryStates.vue`, rendered by `AppSidebar` under the Library item only while `route.path === '/games'` (drawer included). Vertical `UNavigationMenu`, `level 1` indentation, items:

- "All" (`i-lucide-layers`) then each group from `gameStateItemGroups` as a `type: 'label'`-less run with the same group breaks (small gap, not labels). Icon and `iconClass` hue per state, count as `badge`.
- Only states with ≥1 visible game are shown, plus "All" and "Unsorted" always, plus whichever state is currently selected even at 0 (so moving the last game out of a state doesn't remove the row the user is standing on). Counts are whole-library (visible games), not faceted by the other filters — stable numbers, no surprise.
- Counts from `useNuxtData('games')`, `!hidden` games; `useFetch('/api/games', { key: 'games' })` in the component as well so a direct load of `/games` doesn't depend on setup order. The list is a `computed` over that cache, and `useSetGameState`/`useSetGameHidden` patch the cache optimistically, so a state used for the first time appears the instant the context menu or state control commits it — no refetch. Test this explicitly.
- `to: { path: '/games', query: { ...route.query, state } }` (omit `state` for all) — switching state keeps search/provider/sort. Set `active` explicitly from `route.query.state`; NuxtLink's exact matching on query is not reliable enough for the "all" case where the key is absent.
- Collapsed sidebar: items render as icons with `tooltip`; the coloured state icons are distinct enough to be usable at 16 px.
- Library nav item stays active for any state.

Keyboard: none in this task. Digits are taken by `organise.vue`; a `g` then digit chord is a follow-up.

### 4. Surfaces

Give chrome a surface and keep the wall on the base colour so art is the brightest thing on the darkest ground:

| Element | Now | After |
| --- | --- | --- |
| Sidebar root | inherits `--ui-bg` | `bg-elevated border-e border-default` |
| Panel header (navbar + toolbar) | n/a | `bg-elevated border-b border-default` |
| Sidebar active nav item | `before:bg-elevated` (invisible on elevated) | `before:bg-accented` via `ui.link` on all three menus |
| Stat strip | `border` on `--ui-bg` | `bg-elevated`, no border |
| Empty states | dashed border on `--ui-bg` | `bg-elevated` dashed border |
| Light `--ui-bg-elevated` | `grey-50` | `white` — base stays `grey-100`; dark keeps `grey-900` |
| Poster card, list row hover | `bg-elevated` | unchanged |

Rule from [12](12-UI-Overhaul.md) stands: amber only on chrome as accent; state hues only with meaning. No blur, no glow.

### 5. Mobile (below `lg`)

Sidebar is a drawer, so it is not a quick-switch surface. Keep the state `USelectMenu` in the toolbar at `< lg`, driven by the same `gameStateItemGroups`; it disappears at `lg` where the sidebar takes over. The drawer still lists states (same component) for completeness.

Toolbar height budget on a phone: navbar 49 px + toolbar 49 px fixed. `UDashboardToolbar` is `overflow-x-auto`, so the filter row scrolls horizontally rather than wrapping; search gets a fixed `w-48`. If that proves cramped, a follow-up collapses provider/played/hidden/sort behind a "Filters" `UDrawer`.

### 6. Mobile tab bar

The drawer is the weak half of the mobile story: every page change is toggle → drawer → tap. A bottom tab bar on phones fixes primary navigation without adding to the toolbar budget, and is the phone convention Plex/Jellyfin/Steam apps use. Phones only (`md:hidden`): tablets between `md` and `lg` keep the drawer, a bottom bar is clunky at that size.

- `AppTabBar.vue` in the layout, `fixed bottom-0 inset-x-0 md:hidden`, `bg-elevated border-t border-default`, `pb-[env(safe-area-inset-bottom)]`. Panel body gets bottom padding of the bar's height below `md`.
- Nuxt UI has no tab-bar component; use a horizontal `UNavigationMenu` with `variant: 'link'`, icon over label, `justify-around`, or a plain `NuxtLink` row. Active item in `--ui-primary`, matching the sidebar accent.
- Five slots, matching sidebar order: Home, Library, Organise, Activity, More. More opens the existing drawer, which keeps its full nav because tablets (`md`–`lg`) have no tab bar and depend on it. Search stays a navbar button.
- Library tab tapped while on `/games` scrolls to top (iOS convention); a second tap could reset filters, but that is easy to hit by accident — leave it at scroll-to-top.
- The navbar's sidebar toggle becomes redundant on the tabbed pages; keep it only as the "More" entry point or drop it once the tab bar lands.

State switching on mobile stays in the toolbar select. A state "chip strip" between navbar and wall (horizontal scroll of coloured state pills) was considered; it costs another 40 px of fixed height for a filter that changes less often than search does. Revisit if the select proves slow in practice.

Ships as step 6 so the rest of the task is not gated on it.

## Steps

1. `AppPanel.vue`; layout drops the panel; migrate all pages (mechanical, one commit). Verify `useScrollParent` still finds the panel body — it walks up for `overflow-y: auto`, so it should.
2. Surfaces: sidebar/panel-header backgrounds, active-link fix, light `--ui-bg-elevated`. Check `/debug/components` and the game page hero against the new sidebar colour.
3. `AppSidebarLibraryStates.vue` + tests (counts, used-state filtering, query preservation, active detection).
4. `games.vue`: header rows, title from state, `lg:hidden` state select, filter summary row replacing the stat strip.
5. Manual: dark + light, collapsed sidebar tooltips, drawer on mobile width, scroll memory across state switches, state change from the context menu updates the sidebar count.
6. `AppTabBar.vue`, body bottom padding below `md`. Check the wall's last row clears the bar and `useScrollParent` margins are unaffected.

## Decisions

- Sidebar counts are whole-library totals, not faceted.
- Sidebar shows used states + All + Unsorted (+ the selected state at 0). Must update instantly on state change.
- Stat strip becomes a filter summary under the toolbar: count, total playtime, played/unplayed of the current result set. Covers the result-count question.
- Light elevated = white.
- Tab bar: Organise keeps its tab. Phones only, not tablets.

## Questions

- Filter summary in the fixed header (always visible, +32 px) or top of the scrolling body (free, but out of view when changing a filter from deep in the wall)? Proposed: fixed, collapsed to count-only on phones.
