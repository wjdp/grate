# Test fixtures

`prisma-at-gog_game.sqlite` — a Prisma database sitting at migration
`20250329000248_gog_game`, i.e. one migration behind `db/schema.ts` (built
from the Prisma migration SQL in `db/adopt/`), so the Drizzle adoption path in
`db/migrate.ts` can be tested without a real database. It contains synthetic
data only. Rebuild with:

```sh
node db/scripts/buildFixture.ts
```
