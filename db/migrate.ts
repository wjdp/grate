import { join } from "node:path";
import type { Database } from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type * as schema from "./schema";

type DrizzleDb = BetterSQLite3Database<typeof schema>;

export function migrationsFolder() {
  return join(process.cwd(), "db", "migrations");
}

// SQLite cannot alter a column's type, so drizzle-kit emits table rebuilds:
// copy into `__new_X`, drop the original, rename. Dropping a table other rows
// reference trips foreign keys, and the `PRAGMA foreign_keys=OFF` drizzle-kit
// writes into the migration is a no-op inside the migrator's transaction, as is
// `PRAGMA defer_foreign_keys=ON` once the deferred violation counter is raised.
// Disabling enforcement for the duration and checking integrity afterwards is
// what the SQLite manual prescribes for this class of migration.
function migrateWithoutForeignKeyEnforcement(db: DrizzleDb, sqlite: Database) {
  const [{ foreign_keys: wasEnabled }] = sqlite.pragma("foreign_keys") as [
    { foreign_keys: number },
  ];
  sqlite.pragma("foreign_keys = OFF");
  try {
    migrate(db, { migrationsFolder: migrationsFolder() });
    const violations = sqlite.pragma("foreign_key_check") as unknown[];
    if (violations.length > 0) {
      throw new Error(
        `Migration left ${violations.length} foreign key violations: ${JSON.stringify(violations)}`,
      );
    }
  } finally {
    if (wasEnabled) sqlite.pragma("foreign_keys = ON");
  }
}

export function runMigrations(sqlite: Database, db: DrizzleDb) {
  migrateWithoutForeignKeyEnforcement(db, sqlite);
}
