<script lang="ts" setup>
import type { GameDetail } from "#shared/types/Game";
import {
  getEpicRowLinks,
  getGogRowLinks,
  getSteamRowLinks,
  ProviderLabels,
  type Provider,
} from "#shared/providers";

const props = defineProps<{ game: GameDetail }>();

interface ProviderRow {
  key: string;
  provider: Provider;
  providerLabel: string;
  providerId: number;
  name: string;
  playtimeMinutes: number;
  lastPlayed: string | number | null;
  openUrl: string;
  playUrl: string;
}

const rows = computed<ProviderRow[]>(() => [
  ...props.game.steamGames.map((steamRow) => ({
    key: `steam-${steamRow.appId}`,
    provider: "steam" as const,
    providerLabel: ProviderLabels.steam,
    providerId: steamRow.appId,
    name: steamRow.name,
    playtimeMinutes: steamRow.playtimeForever ?? 0,
    lastPlayed: steamRow.rTimeLastPlayed || null,
    ...getSteamRowLinks(steamRow),
  })),
  ...props.game.gogGames.map((gogRow) => ({
    key: `gog-${gogRow.gogId}`,
    provider: "gog" as const,
    providerLabel: ProviderLabels.gog,
    providerId: gogRow.gogId,
    name: gogRow.name,
    playtimeMinutes: gogRow.playtimeMinutes ?? 0,
    lastPlayed: gogRow.lastPlayedAt
      ? new Date(gogRow.lastPlayedAt).toISOString()
      : null,
    ...getGogRowLinks(gogRow),
  })),
  ...props.game.epicGames.map((epicRow) => ({
    key: `epic-${epicRow.epicId}`,
    provider: "epic" as const,
    providerLabel: ProviderLabels.epic,
    providerId: epicRow.epicId,
    name: epicRow.name,
    playtimeMinutes: epicRow.playtimeMinutes ?? 0,
    lastPlayed: epicRow.lastPlayedAt
      ? new Date(epicRow.lastPlayedAt).toISOString()
      : null,
    ...getEpicRowLinks(epicRow),
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
  <section class="space-y-3">
    <h2 class="font-display text-highlighted text-lg font-semibold">
      Providers
    </h2>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :description="error"
    />

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <UCard v-for="row in rows" :key="row.key">
        <template #header>
          <div class="flex items-center gap-2">
            <ProviderIcon :provider="row.provider" class="size-5 shrink-0" />
            <span class="text-muted">{{ row.providerLabel }}</span>
            <span class="text-dimmed font-mono text-xs">
              #{{ row.providerId }}
            </span>
          </div>
          <p class="text-highlighted mt-1 font-medium">{{ row.name }}</p>
        </template>

        <dl class="space-y-1 text-sm">
          <div class="flex justify-between gap-2">
            <dt class="text-muted">Playtime</dt>
            <dd class="font-mono">
              {{ formatPlaytime(row.playtimeMinutes) || "None" }}
            </dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt class="text-muted">Last played</dt>
            <dd>
              {{ row.lastPlayed ? formatLastPlayed(row.lastPlayed) : "Never" }}
            </dd>
          </div>
        </dl>

        <template #footer>
          <div class="flex flex-wrap gap-2">
            <PlayButton :href="row.playUrl" />
            <UButton
              variant="outline"
              color="neutral"
              icon="i-lucide-external-link"
              :label="`Open in ${row.providerLabel}`"
              @click="openUrl(row.openUrl)"
            />
            <UButton
              v-if="canSplit"
              variant="ghost"
              color="neutral"
              icon="i-lucide-split"
              label="Split off"
              :loading="splittingKey === row.key"
              @click="split(row)"
            />
          </div>
        </template>
      </UCard>
    </div>
  </section>
</template>
