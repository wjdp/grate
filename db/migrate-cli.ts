import { databasePath, db, sqlite } from "../lib/db";
import { runMigrations } from "./migrate";

runMigrations(sqlite, db);
console.log(`Database migrated (${databasePath()})`);
