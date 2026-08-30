<script lang="ts" setup>
import type { GameState } from "#shared/game-state";
import { getGameArtUrls } from "#shared/art";
import { getPageTitle } from "#shared/title";
import {
  getEpicRowLinks,
  getGogRowLinks,
  getSteamRowLinks,
  ProviderLabels,
} from "#shared/providers";

const route = useRoute();
const id = parseIntRouteParam(route.params.id);
const { data, error: fetchError, refresh } = await useFetch(`/api/games/${id}`);

if (fetchError.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: "Game not found" });
}

const game = computed(() => data.value?.game);

if (game.value) useSeoMeta({ title: getPageTitle(game.value.name) });

const { data: playtimeData, refresh: refreshPlaytimes } = await useFetch(
  `/api/games/${id}/playtimes`,
);
const playtimes = computed(() => playtimeData.value?.playtimes ?? []);

const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-GB");

const state = ref(game.value?.state ?? null);
watch(
  () => game.value?.state,
  (updatedState) => {
    state.value = updatedState ?? null;
  },
);

const art = computed(() => game.value && getGameArtUrls(game.value));

// `useFetch` data is a shallowRef, so the optimistic update has to replace the
// object rather than write through it.
const applyGameState = (state: GameState | null) => {
  if (!data.value?.game) return;
  data.value = { ...data.value, game: { ...data.value.game, state } };
};

const updateGameState = async (state: GameState | null) => {
  if (!game.value) throw new Error("Game not loaded");
  const previousState = game.value.state;
  applyGameState(state);
  try {
    await $fetch(`/api/games/${id}/state`, {
      method: "PATCH",
      body: { state },
    });
  } catch (error) {
    console.error(error);
    applyGameState(previousState);
  }
};

const onMerged = async () => {
  await Promise.all([refresh(), refreshPlaytimes()]);
};

const steamGames = computed(() => game.value?.steamGames ?? []);
const gogGames = computed(() => game.value?.gogGames ?? []);
const epicGames = computed(() => game.value?.epicGames ?? []);

const description = computed(
  () =>
    steamGames.value[0]?.appInfo?.shortDescription ??
    gogGames.value[0]?.description ??
    epicGames.value[0]?.description ??
    null,
);

const providerCount = computed(
  () =>
    steamGames.value.length + gogGames.value.length + epicGames.value.length,
);

interface LaunchTarget {
  playtimeMinutes: number;
  playUrl: string;
}

const primaryLaunch = computed<LaunchTarget | null>(() => {
  const targets: LaunchTarget[] = [
    ...steamGames.value.map((steamRow) => ({
      playtimeMinutes: steamRow.playtimeForever ?? 0,
      playUrl: getSteamRowLinks(steamRow).playUrl,
    })),
    ...gogGames.value.map((gogRow) => ({
      playtimeMinutes: gogRow.playtimeMinutes ?? 0,
      playUrl: getGogRowLinks(gogRow).playUrl,
    })),
    ...epicGames.value.map((epicRow) => ({
      playtimeMinutes: epicRow.playtimeMinutes ?? 0,
      playUrl: getEpicRowLinks(epicRow).playUrl,
    })),
  ];
  return (
    targets.reduce<LaunchTarget | null>(
      (best, target) =>
        !best || target.playtimeMinutes > best.playtimeMinutes ? target : best,
      null,
    ) ?? null
  );
});

const playtimeColumns = [
  { accessorKey: "timestampStart", header: "Start" },
  { accessorKey: "timestampEnd", header: "End" },
  { accessorKey: "provider", header: "Provider" },
  { accessorKey: "providerName", header: "Name" },
  {
    accessorKey: "playtimeMinutes",
    header: "Playtime",
    meta: { class: { th: "text-right", td: "text-right font-mono" } },
  },
];

// Records are cumulative snapshots, newest first: a row whose total matches the
// next-older one records no new play.
const playtimeMeta = {
  class: {
    tr: (row: { index: number }) =>
      playtimes.value[row.index + 1]?.playtimeMinutes ===
      playtimes.value[row.index]?.playtimeMinutes
        ? "text-dimmed"
        : "",
  },
};
</script>

<template>
  <div v-if="game" class="space-y-6">
    <ArtHero
      :background="art?.background ?? null"
      :header="art?.header ?? null"
      :title="game.name"
    >
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <GameStateControl v-model="state" @change="updateGameState(state)" />
        <PlayButton v-if="primaryLaunch" :href="primaryLaunch.playUrl" />
      </div>
    </ArtHero>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Playtime"
        icon="i-lucide-clock"
        :value="formatPlaytime(game.playtimeMinutes) || 'None'"
      />
      <StatTile
        label="Last played"
        icon="i-lucide-calendar"
        :value="
          game.lastPlayedAt ? formatLastPlayed(game.lastPlayedAt) : 'Never'
        "
      />
      <StatTile
        label="Providers"
        icon="i-lucide-library"
        :value="providerCount"
      />
      <StatTile label="State" icon="i-lucide-tag">
        <GameStateBadge :state="game.state" />
      </StatTile>
    </div>

    <p v-if="description" class="text-muted max-w-prose">{{ description }}</p>

    <GameProviderRows :game="game" />

    <section class="space-y-3">
      <h2 class="font-display text-highlighted text-lg font-semibold">
        History
      </h2>
      <div v-if="playtimes.length" class="overflow-x-auto">
        <UTable
          :data="playtimes"
          :columns="playtimeColumns"
          :meta="playtimeMeta"
        >
          <template #timestampStart-cell="{ row }">
            <span class="font-mono text-xs">
              {{
                row.original.timestampStart
                  ? formatTimestamp(row.original.timestampStart)
                  : "—"
              }}
            </span>
          </template>
          <template #timestampEnd-cell="{ row }">
            <span class="font-mono text-xs">
              {{ formatTimestamp(row.original.timestampEnd) }}
            </span>
          </template>
          <template #provider-cell="{ row }">
            <span class="flex items-center gap-1.5">
              <ProviderIcon :provider="row.original.provider" />
              {{ ProviderLabels[row.original.provider] }}
            </span>
          </template>
          <template #playtimeMinutes-cell="{ row }">
            {{ formatPlaytime(row.original.playtimeMinutes) || "None" }}
          </template>
        </UTable>
      </div>
      <p v-else class="text-muted">No playtime recorded yet</p>
    </section>

    <section class="space-y-3">
      <h2 class="font-display text-highlighted text-lg font-semibold">
        Manage
      </h2>
      <p class="text-muted max-w-prose text-sm">
        Merge this game with another entry, or split a provider row into its own
        game from the provider cards above.
      </p>
      <GameMergeDialog :game="game" @merged="onMerged" />
    </section>
  </div>
</template>
