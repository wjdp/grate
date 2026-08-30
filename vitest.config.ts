import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    // Test files share a single SQLite database and flush it between tests,
    // so they must not run concurrently.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
    },
  },
});
