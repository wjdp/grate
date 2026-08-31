// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

import { version } from "./package.json";

const relaxedIndexAccess = () => ({
  compilerOptions: { noUncheckedIndexedAccess: false },
});

// `lib/`, `db/` and `test/` sit outside every project Nuxt generates, so their
// files are only checked where an app or server file happens to import them.
const rootDirsOutsideNuxtProjects = [
  "../lib/**/*",
  "../db/**/*",
  "../test/**/*",
];

export default defineNuxtConfig({
  compatibilityDate: "2026-08-30",
  buildDir: ".nuxt",
  typescript: {
    tsConfig: {
      ...relaxedIndexAccess(),
      include: rootDirsOutsideNuxtProjects,
    },
    nodeTsConfig: relaxedIndexAccess(),
    sharedTsConfig: relaxedIndexAccess(),
  },
  devtools: { enabled: true },
  modules: ["@nuxt/test-utils/module", "@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    public: { version },
  },
  fonts: {
    families: [
      { name: "Inter", provider: "google" },
      { name: "Archivo", provider: "google" },
      { name: "JetBrains Mono", provider: "google" },
    ],
  },
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
      "20 4 1 * *": "scheduled:update-steam-pics-metadata",
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
