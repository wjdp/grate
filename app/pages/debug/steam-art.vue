<script setup lang="ts">
import { getSteamArtUrls } from "~~/lib/steam/art";
import type { SteamArtUrls } from "~~/lib/steam/art";
import type { SteamPicsMetadata } from "~~/db/schema";

type SerialisedPicsMetadata = {
  [K in keyof SteamPicsMetadata]: SteamPicsMetadata[K] extends Date | null ?
    string | null
  : SteamPicsMetadata[K];
};

const appId = ref("");
const urls = ref<SteamArtUrls>();
const picsMetadata = ref<SerialisedPicsMetadata | null>();
const artKeys: Array<keyof SteamArtUrls> = [
  "logo",
  "header",
  "hero",
  "posterSmall",
  "poster",
  "background",
  "backgroundV6B",
];

// Path/hash columns are what feeds resolveSteamArtSources; the rest of the
// row (review scores, tags, etc.) isn't art-relevant here.
const PICS_PATH_COLUMNS: Array<keyof SerialisedPicsMetadata> = [
  "capsulePath",
  "capsule2xPath",
  "heroPath",
  "hero2xPath",
  "heroBlurPath",
  "logoPath",
  "logo2xPath",
  "headerPath",
  "header2xPath",
  "iconHash",
];

const fetchArt = async () => {
  const id = Number(appId.value);
  urls.value = getSteamArtUrls(id);
  const result = await $fetch(`/api/providers/steam/pics/${id}`);
  picsMetadata.value = "picsMetadata" in result ? result.picsMetadata : null;
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

    <div v-if="urls" class="space-y-2">
      <h2 class="font-display text-highlighted text-lg font-semibold">
        PICS metadata
      </h2>
      <p v-if="!picsMetadata" class="text-muted text-sm">no PICS row</p>
      <div v-else class="border-default bg-elevated space-y-1 rounded-lg border p-4">
        <p class="text-muted font-mono text-xs">
          fetchedAt: {{ picsMetadata.fetchedAt }}
        </p>
        <p
          v-for="column in PICS_PATH_COLUMNS"
          :key="column"
          class="text-muted font-mono text-xs"
        >
          {{ column }}: {{ picsMetadata[column] ?? "—" }}
        </p>
      </div>
    </div>
  </div>
</template>
