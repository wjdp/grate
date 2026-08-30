<script setup lang="ts">
import { getSteamArtUrls } from "~~/lib/steam/art";
import type { SteamArtUrls } from "~~/lib/steam/art";

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

const fetchArt = () => {
  urls.value = getSteamArtUrls(Number(appId.value));
};
</script>

<template>
  <div class="space-y-6">
    <h1 class="font-display text-highlighted text-2xl font-semibold">
      Steam art
    </h1>

    <form class="flex flex-wrap items-center gap-2" @submit.prevent="fetchArt">
      <UInput
        v-model="appId"
        type="text"
        placeholder="App ID"
        icon="i-lucide-hash"
      />
      <UButton type="submit" icon="i-lucide-image" label="Fetch art" />
    </form>

    <p v-if="!urls" class="text-muted">
      Enter a Steam app ID to preview every art URL grate uses.
    </p>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="key in artKeys" :key="key" class="space-y-2">
        <h2 class="text-muted font-mono text-xs">{{ key }}</h2>
        <img
          :src="urls[key]"
          :alt="`${key} art`"
          loading="lazy"
          class="bg-elevated border-default rounded-lg border"
        />
      </div>
    </div>
  </div>
</template>
