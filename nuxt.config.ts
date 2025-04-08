// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  modules: [
    "@prisma/nuxt",
    "@nuxt/test-utils/module",
    "@nuxt/fonts",
    "@nuxt/icon",
  ],
  css: ["~/assets/css/main.css"],
  build: {
    transpile: ["trpc-nuxt"],
  },
  nitro: {
    plugins: ["bigint.ts"],
    experimental: { tasks: true },
    scheduledTasks: {
      "0 * * * *": "scheduled:record-playtimes",
      "0/15 * * * *": "scheduled:update-steam-user",
    },
  },
  vite: {
    plugins: [
      // @ts-ignore, not sure why this is throwing all the errors
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // https://github.com/nuxt/nuxt/issues/24690#issuecomment-2254528534
        ".prisma/client/index-browser":
          "./node_modules/.prisma/client/index-browser.js",
      },
    },
    server: {
      watch: {
        ignored: ["prisma/dev.db*"],
      },
    },
  },
  app: {
    head: {
      title: "grate",
      link: [{ rel: "icon", href: "/icon.png", type: "image/png" }],
    },
  },
});
