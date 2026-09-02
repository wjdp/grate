import { databasePath, db, sqlite } from "./client";
import { runMigrations } from "./migrate";

runMigrations(sqlite, db);
console.log(`Database migrated (${databasePath()})`);
