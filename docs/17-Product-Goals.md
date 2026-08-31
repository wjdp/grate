---
type: reference
---

# Product goals

What grate is for. Reference for future feature and design decisions.

## Vision

A self-hosted game library, backlog and analytics tool. The core feature is tracking **when and for how long you play games** — a timeline of play, not just a total.

The motivating problem: gamers with large libraries are overwhelmed by choice and forget what they'd started. Grate won't solve that, but it can help: surface what you're playing, what you've forgotten, what's next.

## Audience

- **Single user per instance.** Multi-user is out of scope.
- Built by the author for the author; published for others to self-host. No growth goals — a small userbase is a feature, not a failure. Others using it is welcome; maintaining something too popular is not.

## Why self-hosted

- Full control over your data; no lock-in to one tool.
- Necessary, not just ideological: Steam/GOG/Epic only expose a **live readout** of total playtime. A timeline only exists if something sits in the background and logs the change over time. Grate is that something — which means it must run continuously and its history is irreplaceable data.

## The USP: playtime-driven state automation

Backlog trackers already exist. Grate's differentiator is that logged playtime lets state transitions be **automated or suggested** rather than manually maintained.

### States

Defined in `shared/game-state.ts`.

| State     | Meaning                                                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(none)_  | Default for library imports. The bulk of a large library sits stateless; Backlog is curated intent, not a dumping ground.                                                                                         |
| Backlog   | Curated: I intend to play this.                                                                                                                                                                                   |
| Playing   | Actively working through it.                                                                                                                                                                                      |
| Periodic  | Dip-in/dip-out games (roguelikes, live-service, party games). Completion isn't the goal; inactivity gaps are normal, so idle nudges don't apply.                                                                  |
| Shelved   | Set down, intend to return. The key automation target.                                                                                                                                                            |
| Played    | Done with it, didn't finish, fine with that.                                                                                                                                                                      |
| Completed | Finished it — credits rolled.                                                                                                                                                                                     |
| Retired   | Done with a Periodic game (which can't be "completed").                                                                                                                                                           |
| Abandoned | Bounced off it / actively dropped.                                                                                                                                                                                |
| Ignored   | Never played, don't intend to. The organise tool's alternative to Backlog: answered, stop asking. Excluded from backlog stats and suggestions. Distinct from Abandoned (played, then dropped). Manual-only entry. |

Completed is not strictly terminal — replays return a game to Playing (see Playthroughs and replays).

### Classes of play

Games get played in different regimes, and the same game can sit in different regimes for different users:

- **Playthrough games** (Bioshock) — you decide to do a playthrough, then finish, shelve or abandon it.
- **Long-running saves** (RimWorld, Factorio) — looser playthroughs. Some users run them as projects (idle nudges welcome, perhaps on a longer clock); others treat them as Periodic.
- **Short-session games** (Beat Saber, roguelikes, arcade) — play to completion, or pick up on a whim.
- **Ongoing multiplayer / live-service** (Rocket League, MMOs) — no completion; "done" is drifting away, i.e. Retired. Cadence often external (seasons, friends).
- **Social/fixture games** (Jackbox, Mario Kart) — come out when the occasion arises; months of silence means nothing.

Classes are deliberately **not a stored field** — they don't pollute the states. They are the rationale for the state model and for per-game automation preferences: Periodic is how a user declares "no completion goal, don't nag me" (covers the last three classes), and Playing vs Periodic is the user's declaration of which regime a game is currently in. Automation thresholds being tweakable per game covers the in-between cases.

### Playthroughs and replays

Some games get replayed years apart (Skyrim, Cyberpunk, The Witcher, Deus Ex). Grate should show a game's distinct playthroughs: when the last one was, how many there have been, with notes on what you did so the next run can differ.

- **Derived + promotable**: playthroughs are inferred from timeline gaps by default; the user can confirm and name one to make it a real record. Grate suggests a new playthrough when play resumes on a Completed or long-idle game.
- A promoted playthrough carries its own outcome (run 1 completed, run 2 abandoned); the game's state reflects the latest.
- **Caution**: the entity only earns its keep if the user marks it up — half-maintained playthroughs are noise. Implement carefully; everything must degrade gracefully to the plain timeline when the user doesn't engage.
- **Backfill is a goal**: manually record pre-grate playthroughs ("Skyrim, 2013, completed") with rough dates — part of the every-game-you've-ever-played ambition.
- Journal entries attach naturally here — "where I left off" and "what I did last time".

### Automation rules

Transitions come in two layers. Note the transition graph has cycles (Shelved → Playing, Completed → Playing on replay) — it is a state machine, not a DAG.

**Manual transitions: unconstrained.** Any state → any state when the user does it. The user is the authority; enforcing "legal" manual moves adds friction for no benefit in a single-user tool.

**Automated/suggested transitions: an explicit edge list.** Each edge carries a trigger, a threshold and a mode (automatic vs suggested). This table is the contract:

| Edge                          | Trigger                                       | Mode      | Default threshold       | Suppressed by                                                |
| ----------------------------- | --------------------------------------------- | --------- | ----------------------- | ------------------------------------------------------------ |
| Backlog → Playing             | Cumulative recent playtime passes threshold   | Automatic | ~20 min                 | — (2-min boot-and-quit stays under threshold)                |
| Playing → Shelved             | No playtime for N weeks                       | Suggested | ~3 weeks                | Periodic state; per-game longer clock                        |
| Shelved → Playing             | Real playtime (over threshold) resumes        | Automatic | Same ~20 min guard      | New-playthrough prompt takes over for long idles (see below) |
| Any active → Periodic         | Play pattern looks dip-in/dip-out over months | Suggested | TBD (pattern heuristic) | User previously dismissed for this game                      |
| Completed/long-idle → Playing | Real playtime resumes                         | Suggested | Same ~20 min guard      | — (this is the new-playthrough prompt)                       |
| Ignored → Playing             | Real playtime appears after all               | Automatic | Same ~20 min guard      | — (playtime trumps the declaration)                          |

Thresholds are user-tweakable within sensible limits, globally and per game (a RimWorld-as-project can have a longer idle clock than a Bioshock). Terminal states (Played/Completed/Retired/Abandoned) are only ever entered manually — only the user knows they're done.

**Edge precedence on the same event.** Play resuming on an idle game can match multiple edges; resolve deliberately:

- Shelved + short idle → automatic Shelved → Playing, no prompt.
- Shelved + long idle (playthrough-gap territory) → flip to Playing, but attach the new-playthrough suggestion.
- Completed + playtime → never silently flip to Playing; always via the new-playthrough prompt.
- At most one suggestion per game per event — automation must never stack prompts.

## Dashboard

The answer to "what should I play?" for the overwhelmed:

- You are playing these games.
- You've forgotten about these (Playing but idle — nudge to resume or shelve).
- These are on your backlog.

## Analytics

All four matter:

- Play timeline/history — sessions over days/weeks.
- Yearly/period reviews — "your 2026 in games".
- Completion/backlog stats — backlog size trends, completion rates.
- Per-game deep dives — a game's full play history and stats page.

## Full-library ambition and manual entry

Grate should be able to host **every game you have ever played**, including consoles, emulators and unsupported stores. That requires manual entry (of games and of playtime) — an optional feature users can ignore, and a games metadata API (e.g. IGDB) to draw non-store games from.

## Personal layer

Private to the user (no social features, so no sharing concerns):

- **Rating system** — build a personal ranking of favourites.
- **Journal/diary** — per-game log; "where I left off" notes are the killer use for games picked up a year later.
- **Generic notes with image upload** — e.g. community-made maps for large open-world games.
- **Screenshot upload** — manual, but nice to look back on plays. (Want, not commitment.)

## Out of scope

- Multi-user / households.
- Social features — friends, sharing, comparing libraries.
- Purchase/deal tracking — wishlists, price tracking, buying advice.

## Open questions

- Which games metadata API for manual entry (IGDB the obvious candidate).
- Precise defaults for automation thresholds (20 min activation, idle weeks before shelve nudge).
- Playthrough inference: what gap counts as a split, and a promotion UX that avoids nagging or noise.
- Periodic detection: what pattern heuristic counts as dip-in/dip-out.
