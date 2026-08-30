import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    setupFiles: ["test/setup.ts"],
    exclude: ["**/node_modules/**", ".claude/**"],
    env: {
      DATABASE_URL: ":memory:",
    },
  },
});
