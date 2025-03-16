// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  modules: [
    "@prisma/nuxt",
    "nuxt-cron",
    "@nuxtjs/tailwindcss",
    "@nuxt/test-utils/module",
    "@nuxt/fonts",
  ],
  build: {
    transpile: ["trpc-nuxt"],
  },
  nitro: {
    plugins: ["bigint.ts"],
    experimental: { tasks: true },
  },
  vite: {
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
