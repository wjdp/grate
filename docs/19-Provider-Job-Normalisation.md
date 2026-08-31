---
type: task
status: todo
---

# Normalised provider jobs and task progress

Written 2026-08-31 against `3afbb45`.

## Problem

Nine queueable tasks are the same three jobs × three providers (`updateSteamUser`/`updateGogUser`/`updateEpicUser`, `updateSteamGames`/`updateGogGames`/`updateEpicGames`, `recordPlaytimes`/`recordGogPlaytimes`/`recordEpicPlaytimes`), each a two-line wrapper around a service call. Six scheduled task files + six cron entries fan the same jobs out on staggered timers. Adding a provider means touching ~8 files; the tasks page shows nine buttons where three would do.

Separately, most long-running tasks report no progress: only `cacheArt`, `updateSteamPicsMetadata` and `sleepWithProgress` use `updateInProgressTask`. `populateStoreData` (1.5s sleep per game), the games updates (per-game detail fetches for GOG/Epic) and the playtime recorders all run silently.

## Design

### 1. Provider job registry — `lib/providerJobs.ts`

```ts
export interface ProviderJobs {
  provider: "steam" | "gog" | "epic";
  isActive(): Promise<boolean>;
  updateUser(): Promise<void>;
  updateGames(onProgress?: OnProgress): Promise<void>;
  recordPlaytimes(onProgress?: OnProgress): Promise<void>;
}

export type OnProgress = (update: {
  fraction?: number; // within this provider's job, 0–1
  message: string;
}) => void | Promise<void>;

export const PROVIDER_JOBS: ProviderJobs[];
```

- `isActive`: steam → `steamUser` row with non-null `apiKey`; gog → `gogUser` row exists; epic → `epicUser` row exists.
- Wraps the existing service functions unchanged in behaviour. GOG/Epic services keep their internal no-op-when-unlinked guards; steam's throw-when-unlinked is fine because the registry gates on `isActive` first.
- Lives in `lib/` so it cannot import server task machinery — progress flows out through the callback (pattern already established by `updatePicsMetadata`).

### 2. Three normalised queueables replace nine

- `updateUsers` — for each active provider: `updateUser()`.
- `updateGames` — for each active provider: `updateGames(onProgress)`; after steam completes, queue `updateSteamPicsMetadata` (moves from the old `updateSteamGames` wrapper).
- `recordPlaytimes` — name reused, now covering all active providers.

Shared runner semantics (small helper in the queueable layer):

- Providers run sequentially, task progress = `(providerIndex + withinFraction) / activeCount`, messages prefixed with the provider (`"GOG: updated 12/22 games"`).
- Per-provider try/catch: one provider failing must not stop the others. Failures are collected; after all providers ran, if any failed the task throws an aggregate error naming them (task shows failed, successful providers keep their results).
- Inactive providers are skipped with a progress message, not an error.

Old per-provider queueables, their `TASK_NAMES` entries and router rows are deleted — the tasks page derives its buttons from `TASK_NAMES`, so it collapses to the three jobs automatically. Single-provider debugging loses its dedicated buttons; acceptable, the aggregate error names the failing provider and log output is per-provider anyway.

### 3. Scheduling collapses 6 → 2

```
"*/15 * * * *": "scheduled:update-users",
"0 * * * *":    "scheduled:record-playtimes",
```

Replaces `update-steam-user`/`update-gog-user`/`update-epic-user` (the stagger existed only to spread the three jobs; one task now runs them sequentially anyway) and `record-playtimes`/`record-gog-playtimes`/`record-epic-playtimes`. The six scheduled files are deleted, two new ones created. `update-steam-pics-metadata` (monthly) is untouched. Games updates remain unscheduled/manual, as today.

### 4. Progress for the remaining silent tasks

Rule: a queueable that loops over per-item network work reports per-item progress; DB-only loops report milestone messages. Services gain optional `onProgress` params (lib never imports server):

- `populateStoreData` — worst offender (1.5s+ per game, can run for many minutes): per-game `fraction` + message. The loop is already in the queueable, so no service change needed.
- `lib/gog/service.ts updateGogGames` — per-game detail fetch loop: per-game progress.
- `lib/epic/service.ts updateEpicGames` — per-record loop: per-record progress.
- `lib/steam/service.ts updateGames` — one API call then DB upserts: milestone messages (fetched / upserted counts) are enough.
- Playtime recorders (all three) — one API call (or none) then DB loops: milestone messages.
- Existing `console.log` lines in those loops stay; progress supplements, it doesn't replace logging.

## Testing

- Registry runner: unit test the sequencing/error-isolation helper with stub providers (one fails → others still run, aggregate error thrown, progress fractions correct, inactive skipped).
- Per-provider service functions are already tested; `onProgress` additions get a callback-capture assertion each.
- Existing service tests must pass unchanged — behaviour of the underlying jobs is not altered.

## Migration notes

- Files deleted: 9 queueables, 6 scheduled files. Files added: 3 queueables, 2 scheduled files, `lib/providerJobs.ts`.
- `shared/tasks.ts`, `server/tasks/router.ts`, `nuxt.config.ts` updated in step.
- `recordPlaytimes` keeps its name but changes meaning (steam-only → all providers); any queued-task history rows referring to old names are just display strings, no migration needed.

## Unanswered questions

1. Steam `recordPlaytimes` throws when an owned game isn't in the DB yet (new purchase before a games sync), which under the normalised job fails the steam leg every hour until a sync runs. Fix here (skip + warn, or auto-queue `updateGames`) or separate task?
2. Should `updateGames` get a schedule now (e.g. daily) since it's the only remaining manual link in the chain?
3. Happy to lose the per-provider manual buttons, or keep the nine queueables registered (hidden from the page) for debugging?
