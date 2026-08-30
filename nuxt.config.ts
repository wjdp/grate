// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  modules: ["@nuxt/test-utils/module", "@nuxt/fonts", "@nuxt/icon"],
  css: ["~/assets/css/main.css"],
  build: {
    transpile: ["trpc-nuxt"],
  },
  nitro: {
    plugins: ["bigint.ts"],
    experimental: { tasks: true },
    scheduledTasks: {
      "0 * * * *": "scheduled:record-playtimes",
      "*/15 * * * *": "scheduled:update-steam-user",
      "30 * * * *": "scheduled:record-gog-playtimes",
      "5-59/15 * * * *": "scheduled:update-gog-user",
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ["*.db", "tmp/**"],
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
