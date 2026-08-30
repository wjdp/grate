import { resolve } from "node:path";
import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    // Test files share a single SQLite database and flush it between tests,
    // so they must not run concurrently.
    fileParallelism: false,
    exclude: ["**/node_modules/**", ".claude/**"],
    env: {
      // Absolute so Prisma (relative to prisma/) and better-sqlite3 (relative
      // to cwd) open the same file while both are in use.
      DATABASE_URL: `file:${resolve(import.meta.dirname, "prisma/test.db")}`,
    },
  },
});
