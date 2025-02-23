// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@prisma/nuxt'],
  nitro: {
    plugins: ['bigint.ts']
  },
  vite: {
  resolve: {
    alias: {
      // https://github.com/nuxt/nuxt/issues/24690#issuecomment-2254528534
      ".prisma/client/index-browser": "./node_modules/prisma/prisma-client/index-browser.js"
    }
  },
}
})
