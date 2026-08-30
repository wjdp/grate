/// <reference types="@histoire/plugin-vue/components" />

declare namespace NodeJS {
  interface ProcessEnv {
    STEAM_API_KEY: string;
    STEAM_USER_ID: string;
    DATABASE_URL: string;
  }
}
