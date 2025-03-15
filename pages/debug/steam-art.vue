<script setup lang="ts">
import { getSteamArtUrls } from "~/lib/steam/art";
import type { SteamArtUrls } from "~/lib/steam/art";

const appId = ref("");
const urls = ref<SteamArtUrls>();
const artKeys: Array<keyof SteamArtUrls> = [
  "logo",
  "header",
  "hero",
  "posterSmall",
  "poster",
  "background",
  "backgroundV6B",
];

const fetchArt = async () => {
  const appIdNumber = BigInt(appId.value);
  urls.value = await getSteamArtUrls(appIdNumber);
};
</script>

<template>
  <main>
    <h1>Steam Art Tester</h1>
    <div>
      <form @submit.prevent="fetchArt">
        <input
          type="text"
          v-model="appId"
          class="bg-slate-600"
          placeholder="App ID"
        />
        <Button type="submit">Fetch</Button>
      </form>
    </div>
    <div class="grid grid-cols-4 gap-4">
      <div v-for="key in artKeys" :key="key">
        <h2>{{ key }}</h2>
        <img v-if="urls" :src="urls[key]" alt="art" />
      </div>
    </div>
  </main>
</template>
