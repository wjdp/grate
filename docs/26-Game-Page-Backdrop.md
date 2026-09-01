---
type: task
status: open
---

# Game page backdrop

The game detail page (`ArtHero`) uses Steam's `page_bg_generated_v6b.jpg` as its backdrop. Steam bakes a heavy blue tint into that asset, so every Steam game's page looks the same. Use the library hero instead, falling back through Steam's older background assets when a game has no hero.

Preference order:

1. PICS `heroPath` (`library_hero.jpg` on the store_item_assets CDN), then the legacy `steamcdn-a` `library_hero.jpg`
2. `SteamAppInfo.backgroundRaw` — the untinted store background, already stored for every app whose app info has been fetched
3. `page_bg_generated.jpg` (existing `background` type)
4. `page_bg_generated_v6b.jpg` (existing `backgroundV6B` type)

Coverage in `dev.db` today: 561 of 614 Steam games have `heroPath`; every game probed so far has both `page_bg_*` variants, so the tail of the chain is a safety net rather than a common path.

## Approach

Resolve the fallback **server-side** as a new Steam art type, `backdrop`. The client keeps emitting a URL by convention (`/art/steam/<appId>/backdrop`), the art route tries candidates in order and caches the first hit under `backdrop.jpg`, exactly as `poster` already falls through `capsule2x → capsule → header`.

Why a new type rather than changing `background`: type names are load bearing (`server/art/types.ts`). Every `background.jpg` already on disk holds `page_bg_generated`; repurposing the name would serve stale tinted images until each cache entry was deleted by hand. A fresh name has no cached files, so the first render after deploy fetches the right image.

Why not client-side: the client does not receive PICS rows (`getGame` loads `appInfo` only), so it cannot know whether a hero exists, and a client `@error` chain re-implements what `resolveArtSources` already does.

Cost: for the ~560 games with a hero, `backdrop.jpg` duplicates the bytes of `hero.jpg` (1x hero is ~0.5 MB, so ~300 MB across the library). Acceptable; nothing in the UI currently renders `hero`, so if disk matters the better follow-up is to stop `cacheArt` pre-fetching `hero`, not to alias types.

## Changes

`server/art/types.ts`

```ts
export const STEAM_ART_TYPES = [
  …,
  "backgroundV6B",
  "backdrop",
  "icon",
] as const;
```

`server/art/sources.ts`, in `resolveSteamArtSources`, alongside the other PICS-backed cases:

```ts
case "backdrop": {
  const appInfoRow = db
    .select({ backgroundRaw: steamAppInfo.backgroundRaw })
    .from(steamAppInfo)
    .where(eq(steamAppInfo.appId, appId))
    .get();
  return orderedCandidates([
    picsAssetUrl(appId, picsRow?.heroPath ?? null),
    legacyUrls.hero,
    present(appInfoRow?.backgroundRaw),
    legacyUrls.background,
    legacyUrls.backgroundV6B,
  ]);
}
```

The `steamAppInfo` lookup lives inside the case so no other type pays for the query, and `backgroundRaw` is `notNull` but often empty, so it goes through `present()`. The early return for `background`/`backgroundV6B` stays as is. Use `heroPath`, not `hero2xPath`: the backdrop is rendered at `brightness-50` under a gradient and 1x (1920×620) is more than enough; 2x would double the cache cost for no visible gain.

`shared/art.ts`, in `getGameArtUrls` for Steam:

```ts
background: artUrl("steam", appId, "backdrop"),
```

`ArtUrls.background` is the provider-neutral "detail page backdrop" slot; GOG and Epic already map their own choice into it, so no client component changes.

`server/tasks/queueable/cacheArt.ts` — no change; it iterates `ART_TYPES_BY_PROVIDER` and picks the new type up.

`app/pages/debug/steam-art.vue` — iterates `STEAM_ART_TYPES`, picks the new type up. Check it renders sensibly.

## Tests

`server/art/sources.test.ts`:

- `backdrop` with a PICS row that has `heroPath` and an app info row: candidates are `[pics hero, legacy hero, backgroundRaw, page_bg_generated, page_bg_generated_v6b]`.
- `backdrop` with no PICS row and no app info row: `[legacy hero, page_bg_generated, page_bg_generated_v6b]`.
- `backdrop` with an app info row whose `backgroundRaw` is empty: the empty value is dropped.
- Existing "background types resolve from the legacy URL only" tests are unchanged.

`shared/art.test.ts`: Steam `background` URL is now `/art/steam/<appId>/backdrop`.

`test/api/artHealth.e2e.test.ts`: the "type belonging to another provider" case can keep using `backgroundV6B`; no change needed.

## Deploy

No migration. No cache invalidation needed because the type is new. Existing `background.jpg`/`backgroundV6B.jpg` files stay on disk unused by the UI; leave them, `cacheArt` still refreshes them and they are cheap.

## Aspect ratio

`library_hero` is 3.1:1, `page_bg_generated` is ~16:9. `ArtHero` uses `object-cover` with `min-h-48` on a full-width container, so both crop acceptably. If the hero crops badly on narrow viewports, adjust `object-position` in `ArtHero` rather than choosing a different asset.
