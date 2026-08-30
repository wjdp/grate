// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

const relaxedIndexAccess = () => ({
  compilerOptions: { noUncheckedIndexedAccess: false },
});

export default defineNuxtConfig({
  compatibilityDate: "2026-08-30",
  buildDir: ".nuxt",
  typescript: {
    tsConfig: relaxedIndexAccess(),
    nodeTsConfig: relaxedIndexAccess(),
    sharedTsConfig: relaxedIndexAccess(),
  },
  devtools: { enabled: true },
  modules: ["@nuxt/test-utils/module", "@nuxt/fonts", "@nuxt/icon"],
  css: ["~/assets/css/main.css"],
  nitro: {
    typescript: { tsConfig: relaxedIndexAccess() },
    experimental: { tasks: true },
    scheduledTasks: {
      "0 * * * *": "scheduled:record-playtimes",
      "*/15 * * * *": "scheduled:update-steam-user",
      "30 * * * *": "scheduled:record-gog-playtimes",
      "5-59/15 * * * *": "scheduled:update-gog-user",
      "45 * * * *": "scheduled:record-epic-playtimes",
      "10-59/15 * * * *": "scheduled:update-epic-user",
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
