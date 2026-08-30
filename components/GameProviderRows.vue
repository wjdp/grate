<script lang="ts" setup>
import type { GameDetail } from "#shared/types/Game";

const props = defineProps<{ game: GameDetail }>();

interface ProviderRow {
  key: string;
  provider: "steam" | "gog" | "epic";
  providerLabel: string;
  providerId: number;
  name: string;
  playtimeMinutes: number;
  lastPlayed: string | number | null;
  openUrl: string;
  playUrl: string;
}

const epicLaunchUrl = (epicRow: GameDetail["epicGames"][number]) =>
  `com.epicgames.launcher://apps/${encodeURIComponent(`${epicRow.namespace}:${epicRow.catalogItemId}:${epicRow.appName}`)}?action=launch&silent=true`;

const rows = computed<ProviderRow[]>(() => [
  ...props.game.steamGames.map((steamRow) => ({
    key: `steam-${steamRow.appId}`,
    provider: "steam" as const,
    providerLabel: "Steam",
    providerId: steamRow.appId,
    name: steamRow.name,
    playtimeMinutes: steamRow.playtimeForever ?? 0,
    lastPlayed: steamRow.rTimeLastPlayed || null,
    openUrl: `steam://nav/games/details/${steamRow.appId}`,
    playUrl: `steam://run/${steamRow.appId}`,
  })),
  ...props.game.gogGames.map((gogRow) => ({
    key: `gog-${gogRow.gogId}`,
    provider: "gog" as const,
    providerLabel: "GOG",
    providerId: gogRow.gogId,
    name: gogRow.name,
    playtimeMinutes: gogRow.playtimeMinutes ?? 0,
    lastPlayed: gogRow.lastPlayedAt
      ? new Date(gogRow.lastPlayedAt).toISOString()
      : null,
    openUrl: `goggalaxy://openGameView/${gogRow.gogId}`,
    playUrl: `goggalaxy://runGame/${gogRow.gogId}`,
  })),
  ...props.game.epicGames.map((epicRow) => ({
    key: `epic-${epicRow.epicId}`,
    provider: "epic" as const,
    providerLabel: "Epic",
    providerId: epicRow.epicId,
    name: epicRow.name,
    playtimeMinutes: epicRow.playtimeMinutes ?? 0,
    lastPlayed: epicRow.lastPlayedAt
      ? new Date(epicRow.lastPlayedAt).toISOString()
      : null,
    openUrl: epicRow.storeSlug
      ? `https://store.epicgames.com/p/${epicRow.storeSlug}`
      : epicLaunchUrl(epicRow),
    playUrl: epicLaunchUrl(epicRow),
  })),
]);

const canSplit = computed(() => rows.value.length > 1);

const openUrl = (url: string) => {
  window.open(url, "_self");
};

const splittingKey = ref<string | null>(null);
const error = ref<string | null>(null);

const split = async (row: ProviderRow) => {
  splittingKey.value = row.key;
  error.value = null;
  try {
    const { game } = await $fetch("/api/games/split", {
      method: "POST",
      body: { provider: row.provider, providerId: row.providerId },
    });
    await navigateTo(`/game/${game.id}`);
  } catch (splitError) {
    console.error(splitError);
    error.value = "Could not split this provider row.";
  } finally {
    splittingKey.value = null;
  }
};
</script>

<template>
  <section class="my-4">
    <h2 class="text-lg font-bold">Provider rows</h2>
    <p v-if="error" class="my-2 text-red-400">{{ error }}</p>
    <div
      v-for="row in rows"
      :key="row.key"
      class="my-2 border border-slate-600 p-2"
    >
      <div class="flex flex-wrap items-baseline gap-x-3">
        <span class="font-semibold">{{ row.providerLabel }}</span>
        <span>{{ row.name }}</span>
        <span class="text-grey-400">#{{ row.providerId }}</span>
        <span class="text-grey-400">
          {{ formatPlaytime(row.playtimeMinutes) || "No playtime" }}
        </span>
        <span v-if="row.lastPlayed" class="text-grey-400">
          Last played {{ formatLastPlayed(row.lastPlayed) }}
        </span>
      </div>
      <div class="mt-2 flex flex-wrap gap-2">
        <Button @click="openUrl(row.openUrl)">
          Open in {{ row.providerLabel }}
        </Button>
        <PlayButton :href="row.playUrl" />
        <Button
          v-if="canSplit"
          class="bg-slate-600"
          :disabled="splittingKey === row.key"
          @click="split(row)"
        >
          Split
        </Button>
      </div>
    </div>
  </section>
</template>
