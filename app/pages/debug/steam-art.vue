<script setup lang="ts">
import { STEAM_ART_TYPES } from "~~/server/art/types";
import type { SteamPicsMetadata } from "~~/db/schema";

type SerialisedPicsMetadata = {
  [K in keyof SteamPicsMetadata]: SteamPicsMetadata[K] extends Date | null
    ? string | null
    : SteamPicsMetadata[K];
};

const STORE_ITEM_ASSETS_BASE =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";
const COMMUNITY_ICON_BASE =
  "http://media.steampowered.com/steamcommunity/public/images/apps";

const appId = ref("");
const fetchedAppId = ref<number>();
const picsMetadata = ref<SerialisedPicsMetadata | null>();
const brokenArt = ref<Set<string>>(new Set());

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

const picsThumbnailUrl = (
  column: (typeof PICS_PATH_COLUMNS)[number],
  value: string,
) =>
  column === "iconHash"
    ? `${COMMUNITY_ICON_BASE}/${fetchedAppId.value}/${value}.jpg`
    : `${STORE_ITEM_ASSETS_BASE}/${fetchedAppId.value}/${value}`;

const fetchArt = async () => {
  const id = Number(appId.value);
  fetchedAppId.value = id;
  brokenArt.value = new Set();
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

    <p v-if="!fetchedAppId" class="text-muted">
      Enter a Steam app ID to preview every art URL grate uses.
    </p>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="type in STEAM_ART_TYPES" :key="type" class="space-y-2">
        <h2 class="text-muted font-mono text-xs">{{ type }}</h2>
        <img
          v-if="!brokenArt.has(type)"
          :src="`/art/steam/${fetchedAppId}/${type}`"
          :alt="`${type} art`"
          loading="lazy"
          class="bg-elevated border-default rounded-lg border"
          @error="brokenArt.add(type)"
        />
        <p
          v-else
          class="bg-elevated border-default text-muted rounded-lg border p-4 text-xs"
        >
          no art
        </p>
      </div>
    </div>

    <div v-if="fetchedAppId" class="space-y-2">
      <h2 class="font-display text-highlighted text-lg font-semibold">
        PICS metadata
      </h2>
      <p v-if="!picsMetadata" class="text-muted text-sm">no PICS row</p>
      <div
        v-else
        class="border-default bg-elevated space-y-4 rounded-lg border p-4"
      >
        <p class="text-muted font-mono text-xs">
          fetchedAt: {{ picsMetadata.fetchedAt }}
        </p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="column in PICS_PATH_COLUMNS"
            :key="column"
            class="space-y-2"
          >
            <h3 class="text-muted font-mono text-xs">{{ column }}</h3>
            <img
              v-if="picsMetadata[column]"
              :src="picsThumbnailUrl(column, picsMetadata[column] as string)"
              :alt="`${column} art`"
              loading="lazy"
              class="bg-elevated border-default max-h-32 rounded-lg border object-contain"
            />
            <p class="text-muted font-mono text-xs break-all">
              {{ picsMetadata[column] ?? "—" }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
