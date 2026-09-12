---
type: task
status: open
---

# Generating and importing playtime corrections

Written 2026-09-12 against the `playtime-correction` branch. Builds on the model in [31](31-Playtime-Corrections.md). Question: how does a user get corrections *into* grate at scale, when the evidence lives outside it and differs per game?

## What we learnt from Cyberpunk

One game, one script (`tmp/cyberpunk-save-sessions.py`), 84 saves → 45 sessions, imported by posting each to the corrections API.

- Cyberpunk saves are unusually rich: wall-clock timestamp plus two monotonic counters (`playTime`, `playthroughTime`) and a `playthroughID`. Session start can be inferred, sittings split on counter stalls, playthroughs separated. Most games give less.
- Matching a session to a snapshot row needed the raw history (ids, delta windows) and a tolerance. That logic belongs server-side, not in every script.
- The document had to be in the server's timezone; the setting was unset and every delta match was rejected until fixed.
- Store minutes exceed save minutes by launch overhead; a lone correction now absorbs the whole delta ([31](31-Playtime-Corrections.md)).
- A relaunch inside the script's 10-minute sitting gap merged two store deltas into one session. Sitting detection is the generator's problem; the importer should report the cap rather than silently drop.
- Re-running the script double-posted. Import must be idempotent.

## Evidence sources

Ordered by how generic they are. A user will have several; none is universal.

| Source | Gives | Coverage | Notes |
| --- | --- | --- | --- |
| Launcher logs | Exact launch and exit per game | Steam `logs/console_log.txt` ("Game process added/removed", includes non-Steam shortcuts, so Heroic launches via Steam appear); Heroic per-game logs; Lutris | Best generic source. Logs rotate, so older launches may already be gone. Catches sessions the store lost. |
| Save file mtimes | Session end, sitting clusters | Nearly every game | Start unknown; rotating autosaves hide short sittings. Cloud-save folders (GOG, Steam `userdata/<id>/<app>/remote`) too. |
| Save file contents | Playtime counters, playthrough ids, quest/level | Per game: Cyberpunk, Witcher 3, Skyrim/Fallout headers, Stardew, BG3, RimWorld… | Highest value, needs a parser per format. |
| Achievement unlocks | Instants inside a session; bounds pre-history | Steam, GOG, Epic APIs | Grate can fetch these itself once achievement sync exists; proposes, never applies ([31](31-Playtime-Corrections.md)). |
| Screenshots | Instants inside a session | Steam screenshot folder, user capture dirs | Same role as achievements, local. |
| Other trackers | Whole sessions | Playnite, GOG Galaxy local DB, Lutris | One-off migration, mostly pre-history. |
| Memory / diary | Rough ranges | Everything else | The manual form; the fuzzy-date grammar exists for this. |

Two roles emerge: **sessions** (launcher logs, parsed saves, trackers) that become corrections directly, and **instants** (mtimes, achievements, screenshots) that bound or corroborate a session. Instants alone can still date pre-history: "achievements between 12 and 30 Oct 2020" is a range correction.

## The contract: a corrections document

One JSON shape, whatever produced it. `tmp/cyberpunk-save-sessions.py` already emits a draft; promote it.

```
{
  schema: "grate.playtime-corrections/1",
  generator, generatedAt,
  timezone: IANA name the fuzzy dates are written in
  game: { grateGameId | { provider, providerId } | name }
  sessions: [{
    sourceRef:   stable id from the evidence (save name + time, log line hash)
    playedFrom, playedTo:  fuzzy dates per [31]
    minutes:     evidence's own figure (may be omitted: whole delta)
    kind:        "session" | "prehistory" | "manual" | "auto"   (see matching)
    note, source ("save-file" | "launcher-log" | …)
    evidence:    free object (quests, level, playthroughId, save names) kept verbatim
  }]
}
```

- `timezone` is required. The importer converts to the server's zone; no more silent UTC.
- `sourceRef` is the idempotency key: `(provider, providerId, sourceRef)`. Re-import updates or skips, never duplicates. Needs a `sourceRef` column on `PlaytimeCorrection`.
- `evidence` is stored in `note` for now (quest names are useful today); a JSON column later if playthroughs want it.

## Import: server does the matching

`POST /api/games/:id/corrections/import` with `{ document, dryRun }`. Per session, in order:

1. `kind: manual` → additive correction, no snapshot.
2. `kind: prehistory`, or `playedTo` at or before the baseline bound → baseline correction, capped by the undated remainder.
3. Otherwise find snapshot rows whose delta window contains `playedTo` within a tolerance (start at 30 min) and whose capacity fits `minutes` (or, with no minutes, take the whole delta). One match → correction on that row. Several sessions matching one row → split, sum ≤ capacity, residual reported.
4. No match → `kind: auto` becomes manual with a flag; `kind: session` is reported as unmatched, not created. The user decides whether the store lost it.

Result per session: `created | updated | skipped (same sourceRef, unchanged) | capped (n minutes dropped) | unmatched | rejected (message)`. Dry run returns the same table without writing. Aggregates refresh once at the end, not per row.

The existing per-row endpoints stay for the form. The importer is the only place matching lives; the Cyberpunk script drops its own matching code.

## Front-ends over the import endpoint

Cheapest first; all are thin.

1. **In-app paste.** Textarea on the game page, dry-run table, confirm. Covers "ask an LLM for the JSON, paste it". No tooling.
2. **CLI.** `grate corrections import file.json [--server URL] [--dry-run]`, shipped in the repo (`bin/`). Run by hand; idempotent, so a re-run after fixing a generator is safe.
3. **Generic generators**, also in `bin/`: `save-mtimes` (any save directory → sitting clusters with end times), `steam-console-log` (launch/exit pairs for every app the Steam client ran, including shortcuts). These two cover most games without a parser.
4. **Game parsers** as separate scripts in `bin/parsers/<game>.py`, each emitting the document. Cyberpunk is the first. Keep them out of the server: they read the user's filesystem, grate runs in Docker.
5. **MCP server.** Tools: `list_games`, `get_timeline`, `get_raw_history`, `import_corrections` (with dry run), `create/patch/delete_correction`. A wrapper over the HTTP API, for the "LLM reads my saves and fixes my history" loop to be repeatable. Streamable-HTTP inside Nitro avoids a second process; localhost-only, since grate has no auth. Do this after the import endpoint proves out; without it the LLM just writes the document and the user pastes it (option 1).

Not doing: parsers inside the server, auto-applying anything from achievements, a plugin system before there are three parsers, scheduled or watched-folder imports. Imports are one-off actions the user runs deliberately; nothing polls for corrections.

## Order

1. `sourceRef` column, `timezone` in the document, import endpoint with dry run, matching moved server-side. Tests against the Cyberpunk document as a fixture.
2. Rewrite `tmp/cyberpunk-save-sessions.py` as `bin/parsers/cyberpunk.py`: emit only, no DB access, split sittings on a playthrough stall of a few minutes.
3. In-app paste with dry-run table.
4. `bin/steam-console-log.py` and `bin/save-mtimes.py`.
5. CLI wrapper, then MCP.

## Unanswered questions

- Store `evidence` as JSON now, or keep stuffing `note`?
- Should a `session` with no match ever auto-create a manual correction, or always require the user to flip it?
- Tolerance and "whole delta when minutes omitted": confirm against a second game's data before fixing.
