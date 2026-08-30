import { runMigrations } from "~~/db/migrate";
import { db, sqlite } from "~~/lib/db";

// Each test file gets its own module graph, hence its own :memory: database.
runMigrations(sqlite, db);
