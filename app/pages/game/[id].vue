<script lang="ts" setup>
import { getGameArtUrls } from "#shared/art";
import type { GameState } from "#shared/game-state";
import { getPrimaryLaunch } from "#shared/providers";
import { getPageTitle } from "#shared/title";

const route = useRoute();
const id = parseIntRouteParam(route.params.id);
const { data, error: fetchError, refresh } = await useFetch(`/api/games/${id}`);

if (fetchError.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: "Game not found" });
}

const game = computed(() => data.value?.game);

if (game.value) useSeoMeta({ title: getPageTitle(game.value.name) });

const { data: timelineData, refresh: refreshTimeline } = await useFetch(
  `/api/games/${id}/timeline`,
);
const sessions = computed(() => timelineData.value?.sessions ?? []);

const state = ref(game.value?.state ?? null);
watch(
  () => game.value?.state,
  (updatedState) => {
    state.value = updatedState ?? null;
  },
);

const art = computed(() => game.value && getGameArtUrls(game.value));

const { recordView } = useRecentlyViewedGames();
onMounted(() => {
  if (game.value) recordView(id);
});

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
  await Promise.all([refresh(), refreshTimeline()]);
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

const primaryLaunch = computed(() =>
  game.value ? getPrimaryLaunch(game.value) : null,
);

</script>

<template>
  <div v-if="game" class="space-y-6">
    <ArtHero
      :background="art?.background ?? null"
      :logo="art?.logo ?? null"
      :title="game.name"
    >
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <GameStateControl v-model="state" @change="updateGameState(state)" />
        <PlayButton v-if="primaryLaunch" :href="primaryLaunch.playUrl" />
      </div>
    </ArtHero>

    <div
      class="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8 lg:space-y-0"
    >
      <div
        class="grid grid-cols-2 gap-3 lg:order-last lg:grid-cols-1 lg:gap-2.5"
      >
        <StatTile
          class="lg:p-3"
          label="Playtime"
          icon="i-lucide-clock"
          :value="formatPlaytime(game.playtimeMinutes) || 'None'"
        />
        <StatTile
          class="lg:p-3"
          label="Last played"
          icon="i-lucide-calendar"
          :value="
            game.lastPlayedAt ? formatLastPlayed(game.lastPlayedAt) : 'Never'
          "
        />
        <StatTile
          class="lg:p-3"
          label="Providers"
          icon="i-lucide-library"
          :value="providerCount"
        />
        <StatTile class="lg:p-3" label="State" icon="i-lucide-tag">
          <GameStateBadge :state="game.state" />
        </StatTile>
      </div>

      <div class="min-w-0 space-y-6">
        <CollapsibleText
          v-if="description"
          :text="description"
          class="text-muted max-w-prose"
        />

        <GameProviderRows :game="game" />

        <section class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-display text-highlighted text-lg font-semibold">
              History
            </h2>
            <PlaytimeRawHistoryModal :game-id="id" />
          </div>
          <PlaytimeSessionList :sessions="sessions" />
        </section>

        <section class="space-y-3">
          <h2 class="font-display text-highlighted text-lg font-semibold">
            Manage
          </h2>
          <p class="text-muted max-w-prose text-sm">
            Merge this game with another entry, or split a provider row into its
            own game from the provider cards above.
          </p>
          <GameMergeDialog :game="game" @merged="onMerged" />
        </section>
      </div>
    </div>
  </div>
</template>
