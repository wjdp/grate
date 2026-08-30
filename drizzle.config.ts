import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:./dev.db";

export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: url.startsWith("file:") ? url.slice("file:".length) : url,
  },
});
