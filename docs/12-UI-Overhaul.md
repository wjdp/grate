---
type: task
status: done
---

# UI overhaul: Nuxt UI, light/dark, identity

Written 2026-08-30 against `14877b7`.

## Goal

Replace the POC screens with a coherent UI: Nuxt UI v4 on the existing Tailwind v4, light + dark modes, an information architecture the self-hosted crowd expects (Plex/Jellyfin/\*arr: sidebar, settings, status), with an identity built from game art and playtime — Steam's library feel, not its chrome. No RGB, no neon, no glow.

## Current state

Stack: Nuxt 3.21, Tailwind v4 via `@tailwindcss/vite` (not `@nuxtjs/tailwindcss`), `@nuxt/icon`, `@nuxt/fonts` (Inter only), Histoire 1.0-alpha (3 stories), tRPC still in place ([10](10-Drop-tRPC.md) todo).

Findings:

- Dark only, hard-coded: `layouts/default.vue` sets `bg-slate-900 text-white`; every component picks its own `slate`/`zinc`/`grey` shade. No semantic tokens, no colour-mode.
- `assets/css/main.css` does `--color-gray-*: initial` and defines `grey-*`. `pages/index.vue` still uses `text-gray-400`, `bg-gray-800` → those classes emit nothing (silently broken).
- Components (`components/`): `Button` (colour by class override, no variants), `SelectField`, `GameIcon`, `GameTile`, `GameStateControl`, `GameProviderRows`, `GameMergeDialog` (inline, not a modal), `PlayButton`, `TaskState`, `HistoryGrid` (renders random data — never wired up). All bespoke; all replaceable or thin wrappers.
- Pages: `index` (recent posters), `games` (stats as `<p>`s, two native `<select>`s, icon list), `organise` (triage card, 8 colour-coded buttons), `game/[id]` (raw playtime `<table>`, state select, merge/split), `providers/{steam,gog,epic}` (bare forms, no nav link), `debug/{tasks,components,sse,steam-art,trpc}`, `state.vue` (scratch).
- Nav: header with Games / Organise / Tasks / Components. Provider setup is unreachable from the UI. Setup-needed state is one yellow line on the home page.
- Game state colours exist only as ad-hoc button classes in `organise.vue`; nothing else uses them.
- Loading bar and favicon are already `#fed250` amber — the only trace of a brand colour.

## Stack decisions

- **Nuxt UI v4** (`@nuxt/ui@^4.11`). Needs Tailwind ^4 and Nuxt ≥3.17 — both satisfied. Built on Reka UI; ships `@nuxt/icon`, `@nuxt/fonts` and `@nuxtjs/color-mode` internally → remove those two from `modules`, keep `@nuxt/test-utils/module`. Keep `@tailwindcss/vite`; `main.css` becomes `@import "tailwindcss"; @import "@nuxt/ui";` plus `@theme` and `:root`/`.dark` overrides.
- **Theming via Nuxt UI tokens**, not raw Tailwind shades in templates. `app.config.ts` `ui.colors` maps `primary`/`neutral`/`success`/… to palettes; components use `text-muted`, `bg-elevated`, `border-default`, `text-highlighted` etc., which flip with colour mode automatically. This is what makes light mode a config change rather than a second pass over every file.
- **Colour mode**: `useColorMode()` from Nuxt UI (system default, toggle in the sidebar footer). Nuxt UI adds `@custom-variant dark (&:where(.dark, .dark *))` itself.
- **Fonts**: `@nuxt/fonts` inside Nuxt UI; declare families in `@theme` (`--font-sans`, `--font-display`, `--font-mono`).
- **Histoire**: alpha plugin, 3 stories, will fight Nuxt UI's app.config/Reka setup. Drop it and the `story:*` scripts; keep `/debug/components` as a lightweight gallery page (Nuxt UI has its own docs for its components). Revisit Storybook-style tooling only if component count warrants.
- Order: [10](10-Drop-tRPC.md) → [13](13-Nuxt-4-Upgrade.md) → this. Nuxt UI v4 runs on Nuxt 3, but the `app/` move should land before every client file is rewritten here.

## Design direction

Reference points: Steam library view (art-led grid, dark slate, playtime as the primary number), Jellyfin/Plex (sidebar, backdrop-blur hero), \*arr (dense tables, status pills, settings pages). Anti-references: Razer/ROG dashboards, angular "HUD" borders, neon accents, animated gradients.

### Tokens

Colour (dark is the primary design; light derived, not an afterthought):

| Token          | Dark                        | Light                       | Notes                                                                       |
| -------------- | --------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| `neutral`      | custom `grey` (cool, ~260°) | same                        | reuse the existing `grey-*` scale; drop the `gray` reset                    |
| bg             | `grey-950`                  | `grey-100` (not white)      | Steam-dark vs warm-paper; body always painted                               |
| bg elevated    | `grey-900`                  | `grey-50`                   | cards, sidebar                                                              |
| `primary`      | amber `#fed250` family      | darker amber for contrast   | already the brand colour; used sparingly — active nav, play, focus          |
| `success` etc. | Nuxt UI defaults            |                             | task states, sync status                                                    |
| game states    | 8 fixed hues                | same hue, adjusted lightnss | one place: `shared/game-state.ts` gains `GameStateColours`; used everywhere |

Rule: amber is the only saturated colour on chrome. Everything else saturated on screen is game art or a state/status colour with meaning.

Type:

- Display: **Archivo** (variable width; headings set semi-condensed, tight tracking) — has an athletic/industrial feel without being a "gamer" face. Alternatives: Barlow, Sora.
- Body: **Inter** (already loaded).
- Mono: **JetBrains Mono** for ids, timestamps, task log.

Layout: left sidebar (collapsible to icons on `md`, drawer on mobile) — Library, Organise, Activity, Providers, Tasks, Settings; colour-mode toggle + version in the footer. Content area `max-w-7xl`. Sidebar is the \*arr/Jellyfin cue that says "this is a self-hosted service".

Signature: **art-led surfaces**. Game detail and Organise open with the game's `background` art, blurred and darkened, under a header/logo image — the Steam library page move. Library is a poster wall. Everything else is quiet. Motion: poster hover lift (already there), page transitions off, `prefers-reduced-motion` respected.

## Information architecture

| Route                  | Page                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Home: setup banner if no provider connected; "Continue playing" row; Organise nudge (N games unsorted); sync status strip |
| `/games`               | Library: poster wall (default) / list toggle; search; filter (state, provider, played); sort; stat tiles                  |
| `/game/:id`            | Detail: art hero, name, state control, playtime + last played, provider rows, playtime history, merge                     |
| `/organise`            | Triage: same card, state buttons grouped and coloured from tokens, keyboard shortcuts                                     |
| `/activity`            | `HistoryGrid` wired to real playtime data; recent sessions list                                                           |
| `/providers`           | Steam / GOG / Epic cards: connected-as, last sync, connect/disconnect, sync-now                                           |
| `/providers/:provider` | Existing forms, restyled                                                                                                  |
| `/tasks`               | Existing debug tasks page promoted: task table, live log                                                                  |
| `/debug/*`             | Keep `components`, `sse`, `steam-art`; delete `trpc` (with 10) and `pages/state.vue`                                      |

## Component plan

| Current            | Becomes                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `Button`           | `UButton` (`color`/`variant`); delete                                                          |
| `SelectField`      | `USelect`/`USelectMenu`; delete                                                                |
| `GameStateControl` | `USelectMenu` with state colour dot + label from `GameStateNames`                              |
| `TaskState`        | `UBadge` with `color` per state                                                                |
| `PlayButton`       | `UButton color="primary" icon=…`; keep as wrapper for the `window.open` behaviour              |
| `GameTile`         | Two: `GamePoster` (wall) and `GameRow` (list)                                                  |
| `GameMergeDialog`  | `UModal` + `UCommandPalette` for search                                                        |
| `GameProviderRows` | `UCard` per provider with provider icon (`simple-icons:steam`/`gog-dot-com`/`epicgames`)       |
| `GameIcon`         | keep; add `UAvatar` fallback                                                                   |
| `HistoryGrid`      | keep, take real data, colour scale from `primary`                                              |
| new                | `AppSidebar` (`UNavigationMenu` vertical), `ArtHero`, `StatTile`, `ProviderCard`, `SyncStatus` |
| `layouts/default`  | `UApp` + sidebar shell                                                                         |

Playtime history on game detail: `UTable` with the "unchanged row" dimming kept.

## Steps

1. Install `@nuxt/ui`, wire `main.css`, `app.config.ts` colours, remove `@nuxt/icon`/`@nuxt/fonts` modules, `UApp` in `app.vue`. Remove Histoire. Verify build + typecheck.
2. Tokens: `@theme` fonts, `grey` → `neutral`, amber → `primary`, `GameStateColours`. Colour-mode toggle. Fix `gray-*` leftovers.
3. Layout: `AppSidebar`, responsive collapse, route highlighting, colour-mode + version in footer.
4. Library page (`/games`): poster wall + list, `UInput` search, filter/sort in `USelectMenu`s, stat tiles.
5. Game detail: `ArtHero`, state control, provider cards, playtime table, merge modal.
6. Organise: rebuild on tokens, keyboard shortcuts (`defineShortcuts`).
7. Home, Providers index, Tasks promotion, Activity page with real `HistoryGrid` data (needs a `GET /api/games/:id/playtimes`-style aggregate per day — small server addition).
8. Sweep: delete `Button`, `SelectField`, `state.vue`, stories; `rg "slate-|zinc-|gray-"` returns nothing in `pages/`/`components/`.

Each step is a commit; app usable throughout.

## Verification

- `pnpm build`, `pnpm typecheck` green.
- Both colour modes screenshot-checked on every route; no unpainted/transparent surfaces; contrast ≥ 4.5:1 for body text in both.
- Mobile (375px): sidebar becomes drawer, poster wall 2-up, no horizontal scroll.
- Keyboard: focus visible, Organise shortcuts, merge palette navigable.
- `rg "slate-|zinc-|gray-|text-white" pages components layouts` → nothing.
- `rg histoire` → nothing.

## Open questions

All answered before implementation:

1. ~~Display face: Archivo vs Barlow vs stay Inter-only?~~ Archivo (variable), with Inter for body and JetBrains Mono for ids and timestamps.
2. ~~Light mode: tinted warm neutral or pure cool grey?~~ Cool grey, reusing the existing `grey-*` scale; light background is `grey-100`.
3. ~~Do 10 before this?~~ Decided: 10 → 13 → 12.
4. ~~Activity page in scope now, or defer?~~ In scope; the per-day aggregate endpoint landed with it.
5. ~~Keep any Histoire stories, or fully drop?~~ Fully dropped (in [13](13-Nuxt-4-Upgrade.md)).

## Done

Shipped 2026-08-30, `d34e336`..`8c5b65c`.

Per step:

1. **Nuxt UI.** `@nuxt/ui@4`, `UApp` in `app.vue`, `@nuxt/icon`/`@nuxt/fonts` dropped from `modules` (Nuxt UI ships both), `@iconify-json/lucide` and `@iconify-json/simple-icons` added, `main.css` reduced to `@import "tailwindcss"; @import "@nuxt/ui";` plus overrides. Histoire was already gone from 13.
2. **Tokens.** `@theme static` carries the `grey` and custom `amber` scales and the three font families; `:root`/`.dark` override `--ui-bg*`, `--ui-border*` and `--ui-primary`. `app/app.config.ts` maps `primary: amber`, `neutral: grey`. `shared/game-state.ts` gained `GameStateHues` and `GameStateIcons` — the single source for the eight state colours.
3. **Layout.** `UDashboardGroup`/`UDashboardSidebar` shell with `AppSidebar`: Library, Organise, Activity, Providers, Tasks, plus a Debug group; colour-mode toggle and app version (`runtimeConfig.public.version`) in the footer.
4. **Library** (`/games`): poster wall or list (view choice in a cookie), search, state/provider/played filters and sort in the URL query, stat tiles.
5. **Game detail**: `ArtHero` from the game background art, state control, stat tiles, provider cards with play/open/split, playtime history in a `UTable`, merge in a `UModal` + `UCommandPalette`.
6. **Organise**: art-led triage card, state buttons from the shared hues, `defineShortcuts` for 1–8 and `s`.
7. **Home, Providers, Tasks, Activity**: setup banner and continue-playing row on `/`; provider cards with connect/disconnect/sync and toasts (plus a GOG status route to match Steam and Epic); tasks list with live SSE progress; Activity year selector over a real per-day playtime aggregate endpoint.
8. **Sweep**: `Button.vue`, `SelectField.vue` and `pages/state.vue` deleted, `debug/steam-art.vue` rebuilt on Nuxt UI, provider launch URLs and labels consolidated into `shared/providers/index.ts`, `StatTile` given a slot, `GameStateBadge` a size.

Decisions taken along the way:

- Display face **Archivo**, body Inter, mono JetBrains Mono.
- Light mode is **cool grey** (`grey-100` ground, `grey-50` cards), not white.
- **Activity** stayed in scope, with the per-day aggregate endpoint written for it.
- **Histoire** dropped rather than ported; `/debug/components` is the gallery.
- Light-mode primary is pinned to **amber-800**: `#fed250` at shade 500 cannot carry white button text.
- The sidebar collapses at **`lg`**, not `md` — the content area is too cramped between the two.
- Playtime history is a **`UTable`** (keeping the unchanged-row dimming); the tasks page is a **list**, not a table, because a task row has a log and a progress bar.

## Follow-ups

- Light-mode primary: amber-800 is a compromise. The alternative is a button theme override that puts dark text on bright amber, keeping the brand colour in both modes.
- Re-enable `noUncheckedIndexedAccess` (45 errors at the time of writing, carried from [13](13-Nuxt-4-Upgrade.md)).
- The state filter trigger on `/games` shows the state name but no colour dot; the dot only appears in the open menu.
- `test/api/routes.e2e.test.ts` spawns its own `nuxt dev`, which is fragile alongside a dev server already running.
- Remaining items in [04](04-Server-Only-Provider-Code.md): ESLint `no-restricted-imports` for `lib/` from client code, `debug/steam-art.vue` still importing `lib/steam/art.ts`, and secrets via `runtimeConfig`.
