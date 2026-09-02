import { db, sqlite } from "~~/server/database/client";
import { runMigrations } from "~~/server/database/migrate";

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
