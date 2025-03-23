import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    env: {
      DATABASE_URL: "file:./test.db",
    },
  },
});
