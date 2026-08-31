import { runMigrations } from "~~/db/migrate";
import { db, sqlite } from "~~/lib/db";

export default defineNitroPlugin(() => {
  if (import.meta.dev) return;
  try {
    runMigrations(sqlite, db);
    console.log("Database migrated");
  } catch (error) {
    console.error("Database migration failed", error);
    throw error;
  }
});
