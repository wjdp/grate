---
type: task
status: doing
---

# Normalised provider jobs, sync UX and task progress

Written 2026-08-31 against `3afbb45`, revised same day after review.

## Problem

Nine queueable tasks are the same three jobs × three providers (`updateSteamUser`/`updateGogUser`/`updateEpicUser`, `updateSteamGames`/`updateGogGames`/`updateEpicGames`, `recordPlaytimes`/`recordGogPlaytimes`/`recordEpicPlaytimes`), each a two-line wrapper around a service call. Six scheduled task files + six cron entries fan the same jobs out on staggered timers. Adding a provider means touching ~8 files; the tasks page shows nine buttons where three would do.

Bigger problem: a normal user has no sane way to drive any of this. Sync only happens if you know which of nine buttons to press in which order. `updateGames` never runs on a schedule, so a newly bought Steam game makes hourly `recordPlaytimes` throw (`Game X not found in db`) until someone manually syncs — and buy-then-immediately-play is the common case. The app should *just work*: playtime capture must never crash on an unknown game, and the game should be pulled into the library automatically.

Separately, most long-running tasks report no progress: only `cacheArt`, `updateSteamPicsMetadata` and `sleepWithProgress` use `updateInProgressTask`. `populateStoreData` (1.5s sleep per game), the games updates (per-game detail fetches for GOG/Epic) and the playtime recorders all run silently.

## Design

### 1. Provider job registry — `lib/providerJobs.ts`

```ts
export type ProviderId = "steam" | "gog" | "epic";

export interface ProviderJobs {
  provider: ProviderId;
  isActive(): Promise<boolean>;
  updateUser(): Promise<void>;
  updateGames(onProgress?: OnProgress): Promise<void>;
  recordPlaytimes(onProgress?: OnProgress): Promise<RecordPlaytimesResult>;
}

export interface RecordPlaytimesResult {
  gamesCreated: number; // steam: created inline; gog/epic: always 0
  unknownGames: number; // playtime source mentioned games not in DB
}

export type OnProgress = (update: {
  fraction?: number; // within this provider's job, 0–1
  message: string;
}) => void | Promise<void>;

export const PROVIDER_JOBS: ProviderJobs[];
```

- `isActive`: steam → `steamUser` row with non-null `apiKey`; gog → `gogUser` row exists; epic → `epicUser` row exists.
- Wraps the existing service functions, behaviour unchanged except playtime unknown-game handling (§2). GOG/Epic services keep their internal no-op-when-unlinked guards; steam's throw-when-unlinked is fine because the registry gates on `isActive` first.
- Lives in `lib/` so it cannot import server task machinery — progress and follow-up needs flow out through the callback / return value (pattern already established by `updatePicsMetadata`).

### 2. Playtime recording must never crash on an unknown game

`lib/steam/service.ts recordPlaytimes` currently throws when an owned game has no `steamGame` row (`service.ts:448`), losing the whole run. New purchase + immediate play is the normal case, so:

- **Steam** — the `getUserGames` response contains everything `updateOrCreateGame` needs. On a missing appid: create the game inline via `updateOrCreateGame(userGame)` (game row, steamGame row, aggregates), then record the playtime as normal. Count it in `gamesCreated`. Playtime is captured on the very first tick after purchase; nothing lost.
- **GOG/Epic** — their recorders iterate DB rows, so unknown games are silently invisible rather than crashing, and their playtime feeds lack the detail needed to create a game. Instead: diff the playtime feed's ids against DB rows and report the count as `unknownGames`. (Their playtime totals are cumulative, so nothing is lost once the game lands via a games sync.)
- **Queueable layer** reacts to the result: any `gamesCreated` → queue `updateSteamPicsMetadata` (library assets), `populateStoreData` (description etc.) and `cacheArt`; any `unknownGames` on gog/epic → queue `updateGames` for that provider. Services stay free of task imports.

### 3. Three normalised queueables replace nine, plus `sync`

Task infra gains payloads: `Task` gets optional `payload?: Record<string, unknown>`, `createTask(name, payload?)` stores it, the handler already hands the task object to the task function, and SSE `task` events include it (needed for the provider page UI, §5).

- `updateUsers` — for each active provider: `updateUser()`.
- `updateGames` — for each active provider: `updateGames(onProgress)`; after steam completes, queue `updateSteamPicsMetadata` (moves from the old `updateSteamGames` wrapper).
- `recordPlaytimes` — name reused, now covering all active providers; queues follow-ups per §2.
- `sync` — payload `{ provider?: ProviderId }`. Runs `updateUser` → `updateGames` → `recordPlaytimes` for the named provider, or for all active providers when omitted. This is the one button a normal user needs.

All four accept an optional `{ provider?: ProviderId }` payload filter via the shared runner; payload-less (as queued from the debug tasks page) means all active providers.

Shared runner semantics (small helper in the queueable layer):

- Providers run sequentially, task progress = `(providerIndex + withinFraction) / activeCount`, messages prefixed with the provider (`"GOG: updated 12/22 games"`).
- Per-provider try/catch: one provider failing must not stop the others. Failures are collected; after all providers ran, if any failed the task throws an aggregate error naming them (task shows failed, successful providers keep their results).
- Inactive providers are skipped with a progress message, not an error.

Old per-provider queueables, their `TASK_NAMES` entries and router rows are deleted. Per-provider debugging is covered by the per-provider sync buttons (§5) plus per-provider log output and the aggregate error naming the failing provider.

### 4. Scheduling collapses 6 → 3; the chain is fully automatic

```
"*/15 * * * *": "scheduled:update-users",
"0 * * * *":    "scheduled:record-playtimes",
"0 6 * * *":    "scheduled:update-games",
```

- Replaces the three staggered user updates and three playtime recorders (the stagger existed only to spread jobs that now run sequentially in one task).
- `update-games` is newly scheduled daily at 6am: §2 catches a bought-and-played game immediately, the daily sweep catches games bought but not yet played, plus metadata drift.
- `update-steam-pics-metadata` (monthly) is untouched.

With this, a normal user never has to touch a task: users refresh every 15 min, playtime hourly (self-healing on new games), library daily.

### 5. Provider page becomes the user-facing sync surface

`app/pages/providers/index.vue`:

- Each connected provider card gains a **Sync** button → `POST /api/tasks` `{ name: "sync", payload: { provider } }`.
- Page header gains **Sync all** → `sync` with no payload.
- Cards show live sync state: subscribe via `useSseClient` to `task` events, match tasks named `sync` whose payload names the card's provider (or has no provider — sync-all covers every card), plus the scheduled/normalised jobs' provider-prefixed progress. Show queued / progress bar + message / done / failed. Reuse or adapt the existing `TaskState` component.
- Extract a `ProviderSyncButton` (button + state) component and place it on the three provider detail pages as well as the index cards.
- Disable/queue-dedupe: a card whose sync is already pending or running shows state instead of a second button press queueing a duplicate.

### 6. Tasks page becomes a debug view

- Keep the page and its derive-buttons-from-`TASK_NAMES` behaviour — useful for debugging and power users.
- Move its sidebar link from the main nav into the existing `debugLinks` group in `AppSidebar.vue`; route can stay `/tasks`.
- Reframe copy as a debug tool ("Debug: task queue" or similar).

### 7. Progress for the remaining silent tasks

Rule: a queueable that loops over per-item network work reports per-item progress; DB-only loops report milestone messages. Services gain optional `onProgress` params (lib never imports server):

- `populateStoreData` — worst offender (1.5s+ per game, can run for many minutes): per-game `fraction` + message. The loop is already in the queueable, so no service change needed.
- `lib/gog/service.ts updateGogGames` — per-game detail fetch loop: per-game progress.
- `lib/epic/service.ts updateEpicGames` — per-record loop: per-record progress.
- `lib/steam/service.ts updateGames` — one API call then DB upserts: milestone messages (fetched / upserted counts) are enough.
- Playtime recorders (all three) — one API call (or none) then DB loops: milestone messages, including created/unknown game counts from §2.
- Existing `console.log` lines in those loops stay; progress supplements, it doesn't replace logging.

## Testing

- Registry runner: unit test the sequencing/error-isolation helper with stub providers (one fails → others still run, aggregate error thrown, progress fractions correct, inactive skipped, provider payload filter respected).
- Steam `recordPlaytimes` unknown-game path: owned game absent from DB → game created, playtime recorded, `gamesCreated` reported, no throw. GOG/Epic: feed id absent from DB → `unknownGames` reported.
- Queueable follow-up queueing: `gamesCreated` → enrichment tasks queued; `unknownGames` → provider games update queued.
- Task payload round-trip: stored, passed to task function, present in SSE events.
- Per-provider service functions are already tested; `onProgress` additions get a callback-capture assertion each.
- Existing service tests must pass unchanged apart from the steam unknown-game behaviour change.

## Migration notes

- Files deleted: 9 queueables, 6 scheduled files. Files added: 4 queueables (`updateUsers`, `updateGames`, `recordPlaytimes`, `sync`), 3 scheduled files, `lib/providerJobs.ts`, `ProviderSyncButton.vue`.
- `shared/tasks.ts`, `server/tasks/router.ts`, `server/tasks/queue.ts` (payloads), `server/api/tasks/index.post.ts` (accept payload), `nuxt.config.ts`, `AppSidebar.vue`, providers pages updated in step.
- `recordPlaytimes` keeps its name but changes meaning (steam-only → all providers); any queued-task history rows referring to old names are just display strings, no migration needed.

## Unanswered questions

None — daily sync at 6am, new steam games queue all three enrichment tasks (pics only takes a few seconds), sync buttons on both index and detail pages.
