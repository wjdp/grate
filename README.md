# <img src="https://raw.githubusercontent.com/wjdp/grate/refs/heads/master/public/icon.png" height="26" /> grate

> [!WARNING]
> grate **is not stable yet**, the only image is a live build of the master branch. Use at your own risk!

A self-hosted game library, backlog and analytics tool. grate's core feature is tracking **when and for how long you play games**, a timeline of play, not just a total.

Steam, GOG and Epic only expose a live readout of total playtime. A timeline only exists if something sits in the background and logs the change over time. grate is that something: it polls your linked accounts on a schedule, derives play sessions from the deltas, and builds a history the stores will never give you. That history is irreplaceable, so grate is designed to run continuously: a small always-on Docker container is how you deploy it.

grate is single-user per instance, built by the author for the author and published for others to self-host.

## Features

- **Provider sync** — link Steam, GOG and Epic accounts. grate imports your full library from each and keeps it up to date on a schedule.
- **Playtime timeline** — hourly playtime capture, with sessions derived from the change in each store's cumulative totals. New purchases played immediately are picked up automatically.
- **Game states** — Backlog, Playing, Periodic, Shelved, Played, Completed, Retired, Abandoned, Ignored. The bulk of a large library sits stateless; Backlog is curated intent, not a dumping ground.
- **Dashboard** — what you're playing, what you've forgotten, what's on your backlog: the answer to "what should I play?".
- **Activity view** — your play history over days and weeks.
- **Organise tool** — work through your library deciding what's Backlog and what's Ignored.
- **Cross-provider duplicate matching** — the same game owned on two stores is detected and can be merged, so playtime and state live on one record.
- **Command palette** — keyboard-driven navigation and search.

On the roadmap (see [`docs/17-Product-Goals.md`](docs/17-Product-Goals.md)): playtime-driven state automation (games that go idle get a shelve suggestion, backlog games you start playing flip to Playing automatically), playthrough tracking for games replayed years apart, manual entry for consoles and unsupported stores, ratings and a per-game journal.

## Installation

grate is a Node server with a SQLite database. Everything it stores (database and cached artwork) lives in one data directory, which you mount as a volume. **Back this directory up**; your playtime history cannot be re-fetched.

### Docker Compose

Docker Compose is the only supported deployment method. Adapt the following for your stack:

```yaml
services:
  grate:
    image: ghcr.io/wjdp/grate:latest
    container_name: grate
    restart: unless-stopped
    volumes:
      - <path to local directory>:/app/data
    ports:
      - 3000:3000
    environment:
      - TZ=Europe/London
```

grate uses the container's `TZ` to decide which day a session belongs to (the day runs 06:00 to 06:00, so a 1am session counts towards the night before); it defaults to UTC when unset, and can be overridden per user in Settings.

Then pull and bring up the container

```bash
docker compose pull
docker compose up -d
```

Then open <http://your-host:3000>.

### Protecting your install

grate is designed as a single user service and has **no authentication at all**; if you expose it on an untrusted network **you** are responsible for protecting it.

In simple terms: use it on your home network, don't open it up to the internet. Use a VPN (e.g. Tailscale) for remote access.

### Linking your accounts

In the app, go to **Providers** and link each store:

- **Steam** — scan a QR code with the Steam mobile app (Steam Guard → scan QR). grate keeps a refresh token that renews itself while the instance runs; the token grants full account access, revoke it from Steam's [Authorised Devices page](https://store.steampowered.com/account/authorizeddevices).
- **GOG** and **Epic** — sign in via each store's website to obtain an authorisation code, which grate exchanges for tokens and refreshes automatically.

Once linked, grate syncs on a schedule: profile refresh every 15 minutes, playtime capture hourly, a full library sync daily. You can also trigger syncs manually from the UI.

## Development

Requires Node 24 and pnpm.

```sh
pnpm install
cp .env.example .env
pnpm db:migrate # Creates the local db, not automatic for dev
pnpm dev
```

Useful scripts: `pnpm test` (vitest), `pnpm lint` (biome), `pnpm typecheck`, `pnpm db:studio` (drizzle-kit studio).

The stack is Nuxt 4 (Vue, Nuxt UI, Tailwind) with a Nitro server, Drizzle ORM on better-sqlite3, and provider clients in `server/providers/`. Working docs — plans, reviews and reference material, including how providers work and how to add one — live in [`docs/`](docs/).
