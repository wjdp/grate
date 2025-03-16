// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  modules: [
    "@prisma/nuxt",
    "nuxt-cron",
    "@nuxt/test-utils/module",
    "@nuxt/fonts",
  ],
  css: ["~/assets/css/main.css"],
  build: {
    transpile: ["trpc-nuxt"],
  },
  nitro: {
    plugins: ["bigint.ts"],
    experimental: { tasks: true },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // https://github.com/nuxt/nuxt/issues/24690#issuecomment-2254528534
        ".prisma/client/index-browser":
          "./node_modules/.prisma/client/index-browser.js",
      },
    },
  },
  app: {
    head: {
      link: [{ rel: "icon", href: "/icon.png", type: "image/png" }],
    },
  },
});
