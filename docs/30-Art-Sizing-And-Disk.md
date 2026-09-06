---
type: task
status: open
---

# Art sizing and disk use

Written 2026-09-06 against `32063e8`, from a scroll-performance trace of the library wall and a survey of every image the app renders. Revises the "cache generously" principle in [14](14-Art-Caching.md): the LAN link is cheap but client decode, disk and first-paint are not, and no rendered slot needs more than ~2000 px.

## Problem

Two costs, one cause: art is cached at whatever size the CDN gives and served unchanged.

**Performance.** The trace of fast scrolling ~800 posters showed 68 MB of images and 3.5 s of decode for 600–1600 px sources painted at ~200 px. Fixed for the wall in `6ae79db`–`32063e8` (`?w=240|480` WebP variants, conditional headers, warmed by `cacheArt`). Everything else still ships originals:

| Site | Type | Rendered | Source on disk |
| --- | --- | --- | --- |
| `ArtHero` background (game page, organise) | steam `backdrop`, gog `background`, epic `background` | ≤ ~1280 CSS px, `brightness-50 scale-110` | 1920×620 steam; 2560×1440 epic/gog, 0.7–1.2 MB |
| `ArtHero` logo | `logo` | ≤ 128 px tall | up to 2580 px wide PNG |
| `GameIcon`, palette avatar | `icon` | 24–40 px | already small (steam 32 px, gog preset, epic derived 128 webp) |
| `GamePoster` | `poster` | 176–260 px | variants in place; original still on disk |

`organise.vue` cycles through games quickly, so the hero cost is paid repeatedly there.

**Disk.** `data/art` is 1.7 GB for 617 Steam + 240 Epic + 22 GOG games. Other users will have larger libraries and smaller disks. Breakdown:

| Type | Size | Rendered? |
| --- | --- | --- |
| steam `hero` | 338 MB | No. `backdrop` (which resolves to the same `library_hero.jpg` first) is what `ArtHero` shows |
| epic `hero` + `background` | 340 + 341 MB | Same `boxArtWideUrl` stored twice; only `background` rendered |
| epic `poster` | 294 MB | 1200×1600, only via 240/480 variants |
| steam `logo` | 134 MB | Yes, at ≤ 128 px tall |
| steam `poster` | 93 MB | Only via variants |
| steam `backgroundV6B`, `posterSmall`, `header`, `background` | 103 MB | No |
| `icon` | 3 MB | Yes |
| variants (`*.w240/w480.webp`) | 12 MB | Yes |

~1.1 GB is never rendered (unused types + duplicates); most of the rest is 5–10× larger than its slot.

Measured WebP output from current originals (sharp, `withoutEnlargement`):

| Source | → width, quality | Bytes |
| --- | --- | --- |
| epic poster 1200×1600 jpg 560 KB | 600, q80 | 59 KB |
| same | 240, q80 | 13 KB |
| epic hero 2560×1440 jpg 663 KB | 1920, q75 | 35 KB |
| same | 1280, q70 | 20 KB |
| steam backdrop 1920×620 jpg 192 KB | 1920, q75 | 51 KB |
| epic logo 1024 px png 120 KB | 800, q80 (alpha kept) | 74 KB |

### Trace after the wall changes (2026-09-06, `32063e8` deployed)

Same fast up-and-down scroll, DevTools cache enabled this time, so the two runs are not like for like on bytes. Main-thread and decode figures are.

| | Before (8.7 s) | After (10.0 s) |
| --- | --- | --- |
| Art requests / bytes | 1366 / 65 MB, all network | 1715 / 0 MB, all disk cache |
| Poster paints by source size | 600×800 and 1200×1600 | 240×320 (`?w=240` picked at DPR 0.9) |
| Image decode CPU | 3.5 s, 5.1 ms avg | 0.19 s, 1.1 ms avg |
| Scroll handler | 229 × 9.4 ms avg, max 74 ms | 395 × 4.2 ms avg, max 16 ms |
| GC | 0.5 s incl. one 336 ms major | 0.13 s |
| Tasks over 50 ms | 9 | 1 (the profiler starting) |
| Main thread idle | 3.4 s | 5.5 s |
| Vue patch/mount (`flushJobs` inclusive) | 1.8 s | 1.5 s |

Scroll is smooth at the frame level: no task long enough to drop a frame. What is left is proportional to posters mounted per second, and the profile names it: `NuxtIcon` setup is 0.47 s inclusive (each poster mounts one `UIcon` per provider plus one in `GameStateBadge`), and `runtime-dom` `patchProp`/`setAttribute` another 0.4 s. Browser extensions reacting to DOM mutations add 0.3 s. Candidates, in order: static `<span class="iconify i-simple-icons:steam">` markup instead of `UIcon` in `ProviderIcon` and `GameStateBadge` for list contexts; fewer attributes per poster. Neither is art work, so they are out of scope here and noted for a follow-up.

## Design

### 1. Masters replace originals

Stop keeping CDN originals. The cached file for a key is a **master**: a WebP capped at the largest width any slot will paint, from which smaller variants derive. Refetching from the CDN is cheap and rate limited already, so a future need for a bigger master is a refetch, not a reason to hoard.

| Type | Master width | Quality | Variants | Consumer |
| --- | --- | --- | --- | --- |
| `poster` | 600 | 80 | 240, 480 | `GamePoster` |
| `backdrop` / `background` | 1920 | 75 | 1280 | `ArtHero` background |
| `logo` | 800 | 80, lossless alpha | none | `ArtHero` logo |
| `icon` | 128 | 80 | none | `GameIcon`, palette |

`writeArtFile` runs the master transform at cache-fill time (the Epic icon derivation already does exactly this; generalise it). `CACHED_ART_EXTENSIONS` probing stays for files written before this change until the sweep in §5 has run.

Estimated disk for 800 games: ~800 × (60 + 50 + 40 + 5 + 30) KB ≈ 150 MB, from 1.7 GB.

### 2. Per-type width whitelist

`ART_VARIANT_WIDTHS` becomes a map keyed by type; the route rejects a width not listed for that type (a 1920 px poster or a 240 px backdrop is a bug, not a request). `ensureArtVariantsCached` and `cacheArt` warm from the same map, so adding a slot size is one edit.

### 3. Drop unrendered types

- Steam: remove `hero`, `header`, `posterSmall`, `background`, `backgroundV6B` from `STEAM_ART_TYPES`, `cacheArt` and the sources table. `backdrop` keeps its candidate chain (`heroPath` → `library_hero.jpg` → `backgroundRaw` → `page_bg_generated*`), which is where those URLs still matter.
- Epic and GOG: collapse `hero` into `background` (same source URL). `getGameArtUrls` already only emits `background` for the hero slot.
- `shared/art.ts` `resolveEpicImageUrl` is unused; delete. GOG `resolveGogImageUrl` stays (icon/logo presets are the only reason GOG icons are small today).
- The debug page `debug/steam-art.vue` lists Steam types; trim to match.

### 4. Client changes

- `ArtHero`: background `src` = `?w=1280`, `srcset` 1280w/1920w, `sizes="100vw"`; logo served as the 800 px master with no variant. `decoding="async"` on both.
- `GamePoster`: unchanged.
- Route: unchanged shape; `?w` optional, no `w` serves the master.

### 5. Migration sweep

One-off queueable task `migrateArtCache` (button on the tasks page, also run once on boot after the release):

1. For every `<provider>/<id>` dir, for each retained type with a legacy original: generate the master from the file on disk (no refetch), write, delete the original.
2. Delete files for dropped types and any `.missing` markers for them.
3. Delete stale duplicates (`poster.jpg` beside `poster.png` was seen in `epic/114`; the extension sweep in `removeStaleArtFiles` predates that entry).
4. Report bytes reclaimed in the task message.

Idempotent: a dir with only masters and variants is a no-op.

### 6. Out of scope

- Upstream resizing (Epic `?w=`/GOG presets): local resize covers it and keeps one code path.
- AVIF: WebP is universal and decodes faster; revisit if bytes matter again.
- Icon variants: sources are already ≤ 128 px.
- Accept-header negotiation: every supported browser takes WebP.

## Steps

1. Per-type width map + route validation (§2). Tests: 400 on a width not listed for the type.
2. Master transform in `writeArtFile` for the four retained types (§1); Epic icon derivation folds into it. Tests: master dimensions and format per type; variants derive from the master.
3. Drop unrendered types and dead helpers (§3); update `cacheArt`, sources, debug page, docs 14/21.
4. `ArtHero` variants (§4).
5. `migrateArtCache` task (§5) and a boot hook that queues it once (settings flag).
6. Warm `backdrop`/`background` variants in `cacheArt` alongside posters.

## Open items

- Master quality for logos: lossy WebP with alpha is fine for `brightness`-dimmed heroes but logos are shown crisp; check a few at q80 vs lossless before fixing the number.
- Whether to keep steam `hero` as an alias of `backdrop` for any external caller of `/art/steam/<id>/hero`. No known caller; lean delete.
- Boot-time migration vs manual only. Boot is friendlier for other users; needs a "done" marker so it never re-scans a large cache on every start.
